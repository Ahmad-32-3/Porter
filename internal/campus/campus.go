package campus

import (
	"encoding/json"
	"net/http"
	"sync/atomic"
	"time"
)

type Origin struct {
	GradesDelay time.Duration
	FailGrades  atomic.Bool
	Ready       atomic.Bool

	Inflight    atomic.Int64
	MaxInflight atomic.Int64
	GradesHits  atomic.Int64
	TaxHits     atomic.Int64
	StaticHits  atomic.Int64
	PrivateHits atomic.Int64
	ReadyHits   atomic.Int64
	BackupHits  atomic.Int64
}

func New() *Origin {
	o := &Origin{GradesDelay: 50 * time.Millisecond}
	o.Ready.Store(true)
	return o
}

func (o *Origin) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/grades", o.grades)
	mux.HandleFunc("/grades/", o.grades)
	mux.HandleFunc("/grades-backup", o.backup)
	mux.HandleFunc("/tax", o.tax)
	mux.HandleFunc("/tax/", o.tax)
	mux.HandleFunc("/transcript", o.transcript)
	mux.HandleFunc("/static/", o.static)
	mux.HandleFunc("/api/grades-status", o.status)
	mux.HandleFunc("/ready", o.ready)
	mux.HandleFunc("/private", o.private)
	return mux
}

func (o *Origin) trackIn(pathHits *atomic.Int64) func() {
	pathHits.Add(1)
	n := o.Inflight.Add(1)
	for {
		cur := o.MaxInflight.Load()
		if n <= cur || o.MaxInflight.CompareAndSwap(cur, n) {
			break
		}
	}
	return func() { o.Inflight.Add(-1) }
}

func (o *Origin) grades(w http.ResponseWriter, r *http.Request) {
	done := o.trackIn(&o.GradesHits)
	defer done()
	if o.FailGrades.Load() {
		http.Error(w, "grades down", http.StatusInternalServerError)
		return
	}
	if o.GradesDelay > 0 {
		select {
		case <-r.Context().Done():
			return
		case <-time.After(o.GradesDelay):
		}
	}
	sid := r.Header.Get("X-Student")
	if c, err := r.Cookie("student"); err == nil {
		sid = c.Value
	}
	if sid == "" {
		sid = "unknown"
	}
	w.Header().Set("Cache-Control", "private, no-store")
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("grades for " + sid))
}

func (o *Origin) tax(w http.ResponseWriter, r *http.Request) {
	o.TaxHits.Add(1)
	w.Header().Set("Cache-Control", "private")
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("tax form"))
}

func (o *Origin) transcript(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("transcript"))
}

func (o *Origin) static(w http.ResponseWriter, r *http.Request) {
	o.StaticHits.Add(1)
	w.Header().Set("Cache-Control", "public, max-age=60")
	w.Header().Set("Content-Type", "text/css")
	_, _ = w.Write([]byte("body{color:#111}"))
}

func (o *Origin) status(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "public, max-age=5")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"ready": o.Ready.Load()})
}

func (o *Origin) ready(w http.ResponseWriter, r *http.Request) {
	o.ReadyHits.Add(1)
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]bool{"ready": o.Ready.Load()})
}

func (o *Origin) private(w http.ResponseWriter, r *http.Request) {
	o.PrivateHits.Add(1)
	w.Header().Set("Cache-Control", "private")
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("secret " + r.Header.Get("X-Student")))
}

func (o *Origin) backup(w http.ResponseWriter, r *http.Request) {
	o.BackupHits.Add(1)
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	_, _ = w.Write([]byte("backup page"))
}
