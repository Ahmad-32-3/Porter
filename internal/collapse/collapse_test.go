package collapse

import (
	"io"
	"net/http"
	"sync/atomic"
	"testing"
	"time"
)

func TestPrivateNotShared(t *testing.T) {
	g := New()
	var hits atomic.Int64
	req, _ := http.NewRequest(http.MethodGet, "http://x/private", nil)
	fetch := func() (Entry, error) {
		n := hits.Add(1)
		h := make(http.Header)
		h.Set("Cache-Control", "private")
		return Entry{Status: 200, Header: h, Body: []byte{byte('A' + n)}}, nil
	}
	const n = 5
	done := make(chan Entry, n)
	for i := 0; i < n; i++ {
		go func() {
			e, _, err := g.Do("GET /private", req, fetch)
			if err != nil {
				t.Errorf("do: %v", err)
			}
			done <- e
		}()
	}
	bodies := map[string]int{}
	for i := 0; i < n; i++ {
		e := <-done
		bodies[string(e.Body)]++
	}
	if hits.Load() != int64(n) {
		t.Fatalf("hits=%d want %d", hits.Load(), n)
	}
}

func TestPublicShared(t *testing.T) {
	g := New()
	var hits atomic.Int64
	req, _ := http.NewRequest(http.MethodGet, "http://x/static/x.css", nil)
	fetch := func() (Entry, error) {
		hits.Add(1)
		h := make(http.Header)
		h.Set("Cache-Control", "public, max-age=60")
		return Entry{Status: 200, Header: h, Body: []byte("css")}, nil
	}
	for i := 0; i < 8; i++ {
		e, shared, err := g.Do("GET /static/x.css", req, fetch)
		if err != nil {
			t.Fatal(err)
		}
		if string(e.Body) != "css" {
			t.Fatalf("body=%q", e.Body)
		}
		if i == 0 && !shared {
			t.Fatal("leader fill should be shareable")
		}
		if i > 0 && !shared {
			t.Fatal("cache hit should be shared")
		}
	}
	if hits.Load() != 1 {
		t.Fatalf("hits=%d want 1", hits.Load())
	}
}

func TestStaleIfError(t *testing.T) {
	g := New()
	req, _ := http.NewRequest(http.MethodGet, "http://x/static/x.css", nil)
	h := make(http.Header)
	h.Set("Cache-Control", "public, max-age=60")
	_, _, err := g.Do("GET /static/x.css", req, func() (Entry, error) {
		return Entry{Status: 200, Header: h, Body: []byte("css")}, nil
	})
	if err != nil {
		t.Fatal(err)
	}
	e, shared, err := g.Do("GET /static/x.css", req, func() (Entry, error) {
		return Entry{}, io.EOF
	})
	if err != nil || !shared || string(e.Body) != "css" {
		t.Fatalf("expected cached public body, got %+v shared=%v err=%v", e, shared, err)
	}
}

// A shared entry lives only as long as its Cache-Control max-age. Past that,
// the next request refetches instead of serving a stale body forever.
func TestCacheExpiresAndRefetches(t *testing.T) {
	g := New()
	now := time.Unix(0, 0)
	g.now = func() time.Time { return now }
	req, _ := http.NewRequest(http.MethodGet, "http://x/static/x.css", nil)
	var hits atomic.Int64
	fetch := func() (Entry, error) {
		hits.Add(1)
		h := make(http.Header)
		h.Set("Cache-Control", "public, max-age=30")
		return Entry{Status: 200, Header: h, Body: []byte("css")}, nil
	}
	if _, _, err := g.Do("GET /static/x.css", req, fetch); err != nil {
		t.Fatal(err)
	}
	if _, _, err := g.Do("GET /static/x.css", req, fetch); err != nil {
		t.Fatal(err)
	}
	if hits.Load() != 1 {
		t.Fatalf("within TTL: hits=%d want 1", hits.Load())
	}
	now = now.Add(31 * time.Second)
	if _, _, err := g.Do("GET /static/x.css", req, fetch); err != nil {
		t.Fatal(err)
	}
	if hits.Load() != 2 {
		t.Fatalf("after TTL: hits=%d want 2", hits.Load())
	}
}
