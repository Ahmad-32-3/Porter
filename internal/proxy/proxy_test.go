package proxy

import (
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"porter/internal/campus"
	"porter/internal/config"
	"porter/internal/queue"
)

func testCfg(origin string) config.Config {
	cfg, err := config.Parse([]byte(`
origin: ` + origin + `
listen: :0
routes:
  - prefix: /grades
    mode: wait
    max_active: 1
    overflow_active: 1
  - prefix: /tax
    mode: pass
  - prefix: /transcript
    mode: pass
  - prefix: /static
    mode: collapse
  - prefix: /api/grades-status
    mode: collapse
  - prefix: /private
    mode: collapse
fail:
  redis_down_pass: open
  redis_down_wait: closed
cookie:
  name: porter_ticket
  http_only: true
  same_site: Lax
poll:
  min_ms: 1500
  jitter_ms: 800
`))
	if err != nil {
		panic(err)
	}
	return cfg
}

type env struct {
	t      *testing.T
	origin *campus.Origin
	porter *httptest.Server
	cfg    config.Config
	client *http.Client
}

func start(t *testing.T, store queue.Store, mutate func(*config.Config, *campus.Origin)) *env {
	t.Helper()
	o := campus.New()
	o.GradesDelay = 200 * time.Millisecond
	origin := httptest.NewServer(o.Handler())
	t.Cleanup(origin.Close)
	cfg := testCfg(origin.URL)
	if mutate != nil {
		mutate(&cfg, o)
	}
	p, err := New(cfg, store, nil)
	if err != nil {
		t.Fatal(err)
	}
	ps := httptest.NewServer(p.Handler())
	t.Cleanup(ps.Close)
	jar, _ := cookiejar.New(nil)
	return &env{
		t: t, origin: o, porter: ps, cfg: cfg,
		client: &http.Client{Jar: jar, Timeout: 5 * time.Second},
	}
}

func (e *env) get(path string, hdr map[string]string) *http.Response {
	e.t.Helper()
	req, err := http.NewRequest(http.MethodGet, e.porter.URL+path, nil)
	if err != nil {
		e.t.Fatal(err)
	}
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	resp, err := e.client.Do(req)
	if err != nil {
		e.t.Fatal(err)
	}
	return resp
}

func readBody(t *testing.T, resp *http.Response) string {
	t.Helper()
	defer resp.Body.Close()
	b, err := io.ReadAll(resp.Body)
	if err != nil {
		t.Fatal(err)
	}
	return string(b)
}

func TestWaitCapsOriginAndShowsPosition(t *testing.T) {
	e := start(t, queue.NewMemory(), nil)
	const n = 8
	var waiting atomic.Int64
	var grades atomic.Int64
	var wg sync.WaitGroup
	wg.Add(n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			jar, _ := cookiejar.New(nil)
			c := &http.Client{Jar: jar, Timeout: 5 * time.Second}
			resp, err := c.Get(e.porter.URL + "/grades")
			if err != nil {
				t.Errorf("get: %v", err)
				return
			}
			body := readBody(t, resp)
			if strings.Contains(body, "grades for") {
				grades.Add(1)
				return
			}
			if strings.Contains(body, "You are in position") {
				waiting.Add(1)
				if resp.Header.Get("Cache-Control") != "no-store" {
					t.Errorf("waiting room must be no-store")
				}
				if !strings.Contains(resp.Header.Get("Set-Cookie"), "HttpOnly") {
					t.Errorf("ticket cookie must be HttpOnly")
				}
				return
			}
			t.Errorf("unexpected body %q", body)
		}()
	}
	wg.Wait()
	if e.origin.MaxInflight.Load() > 1 {
		t.Fatalf("origin inflight max=%d want 1", e.origin.MaxInflight.Load())
	}
	if grades.Load() < 1 {
		t.Fatal("expected at least one admitted grades response")
	}
	if waiting.Load() < 1 {
		t.Fatal("expected waiting HTML")
	}
}

func TestTaxStaysFastDuringGradesWait(t *testing.T) {
	e := start(t, queue.NewMemory(), nil)
	done := make(chan struct{})
	go func() {
		resp, err := http.Get(e.porter.URL + "/grades")
		if err == nil {
			_, _ = io.Copy(io.Discard, resp.Body)
			resp.Body.Close()
		}
		close(done)
	}()
	time.Sleep(20 * time.Millisecond)
	startAt := time.Now()
	resp, err := http.Get(e.porter.URL + "/tax")
	if err != nil {
		t.Fatal(err)
	}
	body := readBody(t, resp)
	elapsed := time.Since(startAt)
	if body != "tax form" {
		t.Fatalf("tax body=%q", body)
	}
	if elapsed > 80*time.Millisecond {
		t.Fatalf("tax took %s; bound is 80ms", elapsed)
	}
	<-done
}

func TestPrivacyTwoCookies(t *testing.T) {
	e := start(t, queue.NewMemory(), func(cfg *config.Config, o *campus.Origin) {
		cfg.Routes[0].MaxActive = 2
		o.GradesDelay = 0
	})
	alice := &http.Client{Timeout: 3 * time.Second}
	bob := &http.Client{Timeout: 3 * time.Second}

	ra := mustGet(t, alice, e.porter.URL+"/grades", "alice")
	rb := mustGet(t, bob, e.porter.URL+"/grades", "bob")
	if ra == rb {
		t.Fatal("alice and bob received the same grades body")
	}
	if !strings.Contains(ra, "alice") || !strings.Contains(rb, "bob") {
		t.Fatalf("bodies=%q %q", ra, rb)
	}
}

func mustGet(t *testing.T, c *http.Client, rawURL, student string) string {
	t.Helper()
	req, _ := http.NewRequest(http.MethodGet, rawURL, nil)
	req.AddCookie(&http.Cookie{Name: "student", Value: student})
	resp, err := c.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	return readBody(t, resp)
}

func TestCollapsePublicOneOriginGet(t *testing.T) {
	e := start(t, queue.NewMemory(), nil)
	const n = 10
	var wg sync.WaitGroup
	wg.Add(n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			resp, err := http.Get(e.porter.URL + "/static/x.css")
			if err != nil {
				t.Errorf("static: %v", err)
				return
			}
			body := readBody(t, resp)
			if !strings.Contains(body, "body{") {
				t.Errorf("css body=%q", body)
			}
		}()
	}
	wg.Wait()
	if e.origin.StaticHits.Load() != 1 {
		t.Fatalf("static origin hits=%d want 1", e.origin.StaticHits.Load())
	}
}

func TestCollapsePrivateNoSharedBody(t *testing.T) {
	e := start(t, queue.NewMemory(), nil)
	const n = 6
	var wg sync.WaitGroup
	wg.Add(n)
	for i := 0; i < n; i++ {
		i := i
		go func() {
			defer wg.Done()
			req, _ := http.NewRequest(http.MethodGet, e.porter.URL+"/private", nil)
			req.Header.Set("X-Student", string(rune('A'+i)))
			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				t.Errorf("private: %v", err)
				return
			}
			body := readBody(t, resp)
			want := "secret " + string(rune('A'+i))
			if body != want {
				t.Errorf("got %q want %q", body, want)
			}
		}()
	}
	wg.Wait()
	if e.origin.PrivateHits.Load() != int64(n) {
		t.Fatalf("private origin hits=%d want %d", e.origin.PrivateHits.Load(), n)
	}
}

func TestOverflowCap(t *testing.T) {
	e := start(t, queue.NewMemory(), func(cfg *config.Config, o *campus.Origin) {
		cfg.Routes[0].MaxActive = 0
		cfg.Routes[0].OverflowActive = 1
		o.GradesDelay = 250 * time.Millisecond
	})
	const n = 6
	var admitted atomic.Int64
	var waiting atomic.Int64
	var wg sync.WaitGroup
	wg.Add(n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			jar, _ := cookiejar.New(nil)
			c := &http.Client{Jar: jar, Timeout: 5 * time.Second}
			resp, err := c.PostForm(e.porter.URL+"/grades", url.Values{"overflow": {"1"}})
			if err != nil {
				t.Errorf("overflow: %v", err)
				return
			}
			body := readBody(t, resp)
			if strings.Contains(body, "grades for") {
				admitted.Add(1)
				return
			}
			if strings.Contains(body, "You are in position") {
				waiting.Add(1)
				return
			}
			t.Errorf("unexpected %q", body)
		}()
	}
	wg.Wait()
	if admitted.Load() != 1 {
		t.Fatalf("overflow admitted=%d want 1", admitted.Load())
	}
	if waiting.Load() != int64(n-1) {
		t.Fatalf("waiting=%d want %d", waiting.Load(), n-1)
	}
	if e.origin.MaxInflight.Load() > 1 {
		t.Fatalf("overflow inflight max=%d", e.origin.MaxInflight.Load())
	}
}

func TestRedisDownPassOpenWaitClosed(t *testing.T) {
	e := start(t, queue.Unavailable{}, func(cfg *config.Config, o *campus.Origin) {
		o.GradesDelay = 0
	})
	tax := e.get("/tax", nil)
	if body := readBody(t, tax); body != "tax form" {
		t.Fatalf("tax=%q", body)
	}
	grades := e.get("/grades", nil)
	body := readBody(t, grades)
	if strings.Contains(body, "grades for") {
		t.Fatal("wait must not dump onto origin when queue is down")
	}
	if !strings.Contains(body, "You are in position") {
		t.Fatalf("want waiting room, got %q", body)
	}
	if e.origin.GradesHits.Load() != 0 {
		t.Fatalf("origin grades hits=%d want 0", e.origin.GradesHits.Load())
	}
}

func TestPrefixBoundary(t *testing.T) {
	e := start(t, queue.NewMemory(), func(cfg *config.Config, o *campus.Origin) {
		o.GradesDelay = 0
	})
	resp := e.get("/grades-backup", nil)
	body := readBody(t, resp)
	if strings.Contains(body, "You are in position") {
		t.Fatal("/grades-backup must not use the grades waiting room")
	}
	if body != "backup page" {
		t.Fatalf("got %q", body)
	}
}

func TestMetricsAndReady(t *testing.T) {
	e := start(t, queue.NewMemory(), func(cfg *config.Config, o *campus.Origin) {
		o.GradesDelay = 0
	})
	resp := e.get("/tax", nil)
	_ = readBody(t, resp)
	m := e.get("/metrics", nil)
	text := readBody(t, m)
	for _, name := range []string{
		"porter_admitted", "porter_queued", "porter_origin_grades",
		"porter_origin_tax", "porter_collapsed", "porter_overflow",
	} {
		if !strings.Contains(text, name) {
			t.Errorf("metrics missing %s", name)
		}
	}
	if !strings.Contains(text, "porter_origin_tax") {
		t.Fatal("expected tax counter")
	}
	ready := e.get("/__porter/ready", nil)
	body := readBody(t, ready)
	if ready.Header.Get("Cache-Control") != "no-store" {
		t.Fatal("ready must be no-store")
	}
	if !strings.Contains(body, `"ready":true`) && !strings.Contains(body, `"ready": true`) {
		t.Fatalf("ready body=%q", body)
	}
}

func TestJSONWaitDoesNotAdmit(t *testing.T) {
	e := start(t, queue.NewMemory(), func(cfg *config.Config, o *campus.Origin) {
		o.GradesDelay = 0
		cfg.Routes[0].MaxActive = 0
	})
	req, _ := http.NewRequest(http.MethodGet, e.porter.URL+"/grades", nil)
	req.Header.Set("Accept", "application/json")
	resp, err := e.client.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body := readBody(t, resp)
	if strings.Contains(body, "grades for") {
		t.Fatal("JSON accept must not fetch grades")
	}
	if e.origin.GradesHits.Load() != 0 {
		t.Fatalf("origin grades hits=%d", e.origin.GradesHits.Load())
	}
	status := e.get("/__porter/status?path=/grades", nil)
	st := readBody(t, status)
	if !strings.Contains(st, `"position"`) {
		t.Fatalf("status=%q", st)
	}
}
