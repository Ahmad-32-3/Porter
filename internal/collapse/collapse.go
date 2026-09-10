package collapse

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"time"
)

var hopByHop = map[string]bool{
	"Connection":          true,
	"Keep-Alive":          true,
	"Proxy-Authenticate":  true,
	"Proxy-Authorization": true,
	"Te":                  true,
	"Trailers":            true,
	"Transfer-Encoding":   true,
	"Upgrade":             true,
	"Content-Length":      true,
}

// maxBody caps how much of an origin response Porter will buffer to share.
// A larger response is refused rather than silently truncated, so a shared
// cache entry can never be a corrupt half-body.
const maxBody = 8 << 20 // 8 MiB

// defaultTTL is used for a shareable response that is public but did not
// declare its own max-age.
const defaultTTL = 30 * time.Second

type Entry struct {
	Status int
	Header http.Header
	Body   []byte
}

type fetchFunc func() (Entry, error)

type call struct {
	wg        sync.WaitGroup
	entry     Entry
	shareable bool
	err       error
}

type cached struct {
	entry   Entry
	expires time.Time
}

type Group struct {
	mu         sync.Mutex
	inflight   map[string]*call
	cache      map[string]cached
	now        func() time.Time
	ttlCap     time.Duration
	maxEntries int
}

func New() *Group {
	return &Group{
		inflight:   make(map[string]*call),
		cache:      make(map[string]cached),
		now:        time.Now,
		ttlCap:     5 * time.Minute,
		maxEntries: 512,
	}
}

func RequestBlocksShare(r *http.Request) bool {
	return r.Header.Get("Authorization") != ""
}

func ResponseShareable(req *http.Request, status int, header http.Header) bool {
	if RequestBlocksShare(req) {
		return false
	}
	if header.Get("Set-Cookie") != "" {
		return false
	}
	if status < 200 || status >= 400 {
		return false
	}
	cc := strings.ToLower(header.Get("Cache-Control"))
	if strings.Contains(cc, "private") || strings.Contains(cc, "no-store") {
		return false
	}
	if strings.Contains(cc, "public") || strings.Contains(cc, "max-age") {
		return true
	}
	return false
}

func Key(r *http.Request) string {
	return r.Method + " " + r.URL.Path
}

// cachedEntry returns a live cache entry, dropping it if it has expired.
// Callers must hold g.mu.
func (g *Group) cachedEntry(key string) (Entry, bool) {
	ce, ok := g.cache[key]
	if !ok {
		return Entry{}, false
	}
	if !g.now().Before(ce.expires) {
		delete(g.cache, key)
		return Entry{}, false
	}
	return ce.entry, true
}

// store caches a shareable entry for as long as its own Cache-Control allows
// (bounded by ttlCap), evicting an entry first if the cache is full.
// Callers must hold g.mu.
func (g *Group) store(key string, e Entry) {
	if _, live := g.cachedEntry(key); !live && len(g.cache) >= g.maxEntries {
		for k := range g.cache {
			delete(g.cache, k)
			break
		}
	}
	g.cache[key] = cached{entry: e, expires: g.now().Add(entryTTL(e.Header, g.ttlCap))}
}

// entryTTL is the response's max-age, capped, or a short default when the
// response is shareable but declares no max-age.
func entryTTL(h http.Header, cap time.Duration) time.Duration {
	ttl := maxAge(h)
	if ttl <= 0 {
		ttl = defaultTTL
	}
	if ttl > cap {
		ttl = cap
	}
	return ttl
}

func maxAge(h http.Header) time.Duration {
	for _, part := range strings.Split(h.Get("Cache-Control"), ",") {
		part = strings.TrimSpace(strings.ToLower(part))
		if !strings.HasPrefix(part, "max-age=") {
			continue
		}
		if n, err := strconv.Atoi(strings.TrimPrefix(part, "max-age=")); err == nil && n >= 0 {
			return time.Duration(n) * time.Second
		}
	}
	return 0
}

func (g *Group) Do(key string, req *http.Request, fetch fetchFunc) (Entry, bool, error) {
	if RequestBlocksShare(req) {
		e, err := fetch()
		return e, false, err
	}

	g.mu.Lock()
	if entry, ok := g.cachedEntry(key); ok {
		g.mu.Unlock()
		return entry, true, nil
	}
	if in, ok := g.inflight[key]; ok {
		g.mu.Unlock()
		in.wg.Wait()
		if in.err != nil {
			g.mu.Lock()
			stale, ok := g.cachedEntry(key)
			g.mu.Unlock()
			if ok {
				return stale, true, nil
			}
			e, err := fetch()
			return e, false, err
		}
		if in.shareable {
			return in.entry, true, nil
		}
		e, err := fetch()
		return e, false, err
	}
	c := &call{}
	c.wg.Add(1)
	g.inflight[key] = c
	g.mu.Unlock()

	entry, err := fetch()
	c.entry = entry
	c.err = err
	if err != nil {
		g.mu.Lock()
		stale, ok := g.cachedEntry(key)
		delete(g.inflight, key)
		g.mu.Unlock()
		c.wg.Done()
		if ok {
			return stale, true, nil
		}
		return Entry{}, false, err
	}
	if ResponseShareable(req, entry.Status, entry.Header) {
		c.shareable = true
		g.mu.Lock()
		g.store(key, entry)
		g.mu.Unlock()
	}
	g.mu.Lock()
	delete(g.inflight, key)
	g.mu.Unlock()
	c.wg.Done()
	return entry, c.shareable, nil
}

func Write(w http.ResponseWriter, e Entry) {
	for k, vs := range e.Header {
		if hopByHop[http.CanonicalHeaderKey(k)] {
			continue
		}
		for _, v := range vs {
			w.Header().Add(k, v)
		}
	}
	w.WriteHeader(e.Status)
	_, _ = w.Write(e.Body)
}

func ReadEntry(resp *http.Response) (Entry, error) {
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxBody+1))
	if err != nil {
		return Entry{}, err
	}
	if len(body) > maxBody {
		return Entry{}, fmt.Errorf("origin response exceeds %d bytes; not shareable", maxBody)
	}
	h := make(http.Header)
	for k, vs := range resp.Header {
		if hopByHop[http.CanonicalHeaderKey(k)] {
			continue
		}
		for _, v := range vs {
			h.Add(k, v)
		}
	}
	return Entry{Status: resp.StatusCode, Header: h, Body: body}, nil
}
