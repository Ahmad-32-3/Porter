package proxy

import (
	"context"
	"crypto/rand"
	"embed"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html/template"
	"io"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"porter/internal/collapse"
	"porter/internal/config"
	"porter/internal/metrics"
	"porter/internal/queue"
)

//go:embed wait.html
var waitFS embed.FS

var waitHTML = mustReadWait()

func mustReadWait() string {
	b, err := waitFS.ReadFile("wait.html")
	if err != nil {
		panic(err)
	}
	return string(b)
}

var waitTmpl = template.Must(template.New("wait").Parse(waitHTML))

type waitData struct {
	Position    int
	WaitHint    string
	PollMin     int
	PollJitter  int
	Ready       bool
	OpenURL     string
	PollURLJSON template.JS
	OpenURLJSON template.JS
}

type Proxy struct {
	cfg     config.Config
	origin  *url.URL
	store   queue.Store
	rp      *httputil.ReverseProxy
	client  *http.Client
	coll    *collapse.Group
	metrics *metrics.M
	log     *log.Logger
}

func New(cfg config.Config, store queue.Store, logger *log.Logger) (*Proxy, error) {
	if logger == nil {
		logger = log.Default()
	}
	u, err := url.Parse(cfg.Origin)
	if err != nil {
		return nil, fmt.Errorf("origin url: %w", err)
	}
	p := &Proxy{
		cfg:     cfg,
		origin:  u,
		store:   store,
		client:  &http.Client{Timeout: 30 * time.Second},
		coll:    collapse.New(),
		metrics: metrics.New(),
		log:     logger,
	}
	rp := httputil.NewSingleHostReverseProxy(u)
	orig := rp.Director
	rp.Director = func(req *http.Request) {
		orig(req)
		req.Host = u.Host
	}
	rp.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		p.log.Printf("origin error path=%s err=%v", r.URL.Path, err)
		http.Error(w, "origin unavailable", http.StatusBadGateway)
	}
	p.rp = rp
	return p, nil
}

func (p *Proxy) Metrics() *metrics.M { return p.metrics }

func (p *Proxy) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/metrics", p.metrics.Handler())
	mux.HandleFunc("/__porter/ready", p.ready)
	mux.HandleFunc("/__porter/status", p.status)
	mux.HandleFunc("/", p.dispatch)
	return mux
}

func (p *Proxy) dispatch(w http.ResponseWriter, r *http.Request) {
	route, ok := p.cfg.Match(r.URL.Path)
	if !ok {
		p.forward(w, r)
		return
	}
	switch route.Mode {
	case config.ModePass:
		p.pass(w, r, route)
	case config.ModeWait:
		p.wait(w, r, route)
	case config.ModeCollapse:
		p.collapse(w, r, route)
	default:
		p.forward(w, r)
	}
}

func (p *Proxy) pass(w http.ResponseWriter, r *http.Request, route config.Route) {
	p.countOrigin(route.Prefix)
	p.forward(w, r)
}

func (p *Proxy) wait(w http.ResponseWriter, r *http.Request, route config.Route) {
	_ = r.ParseForm()
	ticket := p.ticket(w, r)
	if ticket == "" {
		// ticket() already wrote a 500 (ticket RNG failed); do not continue
		// with an empty ticket, which would corrupt the queue and double-write.
		return
	}
	ctx := r.Context()
	overflowReq := r.FormValue("overflow") == "1"
	wantJSON := strings.Contains(r.Header.Get("Accept"), "application/json")

	if wantJSON && !overflowReq {
		res, err := p.store.Peek(ctx, route.Prefix, ticket)
		if err != nil {
			p.waiting(w, r, route, queue.Result{Position: 1})
			return
		}
		p.waiting(w, r, route, res)
		return
	}

	var res queue.Result
	var err error
	if overflowReq {
		res, err = p.store.OverflowTry(ctx, route.Prefix, ticket, route.OverflowActive)
	} else {
		res, err = p.store.JoinOrAdmit(ctx, route.Prefix, ticket, route.MaxActive)
	}

	if err != nil {
		if errors.Is(err, queue.ErrUnavailable) && p.cfg.Fail.RedisDownWait == "closed" {
			p.log.Printf("queue down; staying in room path=%s", r.URL.Path)
		} else {
			p.log.Printf("queue error path=%s err=%v", r.URL.Path, err)
		}
		p.waiting(w, r, route, queue.Result{Position: 1})
		return
	}

	if !res.Admitted {
		p.metrics.Queued.Inc()
		p.waiting(w, r, route, res)
		return
	}

	if res.Overflow {
		p.metrics.Overflow.Inc()
	} else {
		p.metrics.Admitted.Inc()
	}

	p.countOrigin(route.Prefix)
	defer func() {
		if err := p.store.Release(context.Background(), route.Prefix, ticket); err != nil {
			p.log.Printf("release ticket err=%v", err)
		}
	}()
	if overflowReq {
		// The form POST is Porter's overflow signal, not an origin mutation.
		r.Method = http.MethodGet
		r.Body = http.NoBody
		r.ContentLength = 0
		r.Header.Del("Content-Length")
		r.Header.Del("Content-Type")
		r.Form = nil
		r.PostForm = nil
	}
	p.forward(w, r)
}

func (p *Proxy) waiting(w http.ResponseWriter, r *http.Request, route config.Route, res queue.Result) {
	ready := p.originReady(r.Context())
	w.Header().Set("Cache-Control", "no-store")
	pos := res.Position
	if !res.Admitted && pos < 1 {
		pos = 1
	}
	if strings.Contains(r.Header.Get("Accept"), "application/json") {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"position": pos,
			"admitted": res.Admitted,
			"ready":    ready,
			"poll_ms":  p.cfg.Poll.MinMS,
			"message":  fmt.Sprintf("You are in position %d.", pos),
		})
		return
	}
	open := route.Prefix
	if open == "" {
		open = "/grades"
	}
	pollPath := "/__porter/status?path=" + url.QueryEscape(open)
	pollURL, _ := json.Marshal(pollPath)
	openJSON, _ := json.Marshal(open)
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	data := waitData{
		Position:    pos,
		WaitHint:    fmt.Sprintf("%d times the poll interval", pos),
		PollMin:     p.cfg.Poll.MinMS,
		PollJitter:  p.cfg.Poll.JitterMS,
		Ready:       ready,
		OpenURL:     open,
		PollURLJSON: template.JS(pollURL),
		OpenURLJSON: template.JS(openJSON),
	}
	if err := waitTmpl.Execute(w, data); err != nil {
		p.log.Printf("wait template: %v", err)
	}
}

func (p *Proxy) collapse(w http.ResponseWriter, r *http.Request, route config.Route) {
	key := collapse.Key(r)
	fetch := func() (collapse.Entry, error) {
		p.countOrigin(route.Prefix)
		resp, err := p.fetchOrigin(r)
		if err != nil {
			return collapse.Entry{}, err
		}
		return collapse.ReadEntry(resp)
	}
	entry, shared, err := p.coll.Do(key, r, fetch)
	if err != nil {
		http.Error(w, "origin unavailable", http.StatusBadGateway)
		return
	}
	if shared {
		p.metrics.Collapsed.Inc()
	}
	collapse.Write(w, entry)
}

func (p *Proxy) fetchOrigin(r *http.Request) (*http.Response, error) {
	out := r.Clone(r.Context())
	out.RequestURI = ""
	out.URL.Scheme = p.origin.Scheme
	out.URL.Host = p.origin.Host
	out.Host = p.origin.Host
	if out.Body == nil {
		out.Body = http.NoBody
	}
	return p.client.Do(out)
}

func (p *Proxy) forward(w http.ResponseWriter, r *http.Request) {
	p.rp.ServeHTTP(w, r)
}

func (p *Proxy) ready(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	ready := p.originReady(r.Context())
	_ = json.NewEncoder(w).Encode(map[string]bool{"ready": ready})
}

func (p *Proxy) status(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	path := r.URL.Query().Get("path")
	if path == "" {
		path = "/grades"
	}
	route, ok := p.cfg.Match(path)
	if !ok || route.Mode != config.ModeWait {
		_ = json.NewEncoder(w).Encode(map[string]any{"position": 0, "admitted": true, "ready": p.originReady(r.Context())})
		return
	}
	ticket := ""
	if c, err := r.Cookie(p.cfg.Cookie.Name); err == nil && validTicket(c.Value) {
		ticket = c.Value
	}
	res := queue.Result{}
	if ticket != "" {
		var err error
		res, err = p.store.Peek(r.Context(), route.Prefix, ticket)
		if err != nil {
			res = queue.Result{Position: 1}
		}
	}
	pos := res.Position
	if !res.Admitted && pos < 1 {
		pos = 1
	}
	_ = json.NewEncoder(w).Encode(map[string]any{
		"position": pos,
		"admitted": res.Admitted,
		"ready":    p.originReady(r.Context()),
		"message":  fmt.Sprintf("You are in position %d.", pos),
	})
}

func validTicket(v string) bool {
	if len(v) != 32 {
		return false
	}
	for i := 0; i < len(v); i++ {
		c := v[i]
		if (c < '0' || c > '9') && (c < 'a' || c > 'f') {
			return false
		}
	}
	return true
}

func (p *Proxy) originReady(ctx context.Context) bool {
	u := *p.origin
	u.Path = "/ready"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return false
	}
	resp, err := p.client.Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	var parsed struct {
		Ready bool `json:"ready"`
	}
	if json.Unmarshal(body, &parsed) != nil {
		return resp.StatusCode == 200
	}
	return parsed.Ready
}

func (p *Proxy) ticket(w http.ResponseWriter, r *http.Request) string {
	if c, err := r.Cookie(p.cfg.Cookie.Name); err == nil && validTicket(c.Value) {
		return c.Value
	}
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		p.log.Printf("ticket rng failed: %v", err)
		http.Error(w, "could not issue ticket", http.StatusInternalServerError)
		return ""
	}
	id := hex.EncodeToString(b[:])
	ck := &http.Cookie{
		Name:     p.cfg.Cookie.Name,
		Value:    id,
		Path:     "/",
		HttpOnly: p.cfg.Cookie.HTTPOnlyEnabled(),
		SameSite: sameSite(p.cfg.Cookie.SameSite),
	}
	http.SetCookie(w, ck)
	return id
}

func sameSite(v string) http.SameSite {
	switch strings.ToLower(v) {
	case "strict":
		return http.SameSiteStrictMode
	case "none":
		return http.SameSiteNoneMode
	default:
		return http.SameSiteLaxMode
	}
}

func (p *Proxy) countOrigin(prefix string) {
	switch {
	case strings.HasPrefix(prefix, "/grades"):
		p.metrics.Grades.Inc()
	case strings.HasPrefix(prefix, "/tax"):
		p.metrics.Tax.Inc()
	}
}
