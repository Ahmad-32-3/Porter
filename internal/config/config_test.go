package config

import "testing"

func TestParseAndMatch(t *testing.T) {
	raw := []byte(`
origin: http://campus:8081
listen: :8080
redis: ""
routes:
  - prefix: /grades
    mode: wait
    max_active: 20
    overflow_active: 5
  - prefix: /tax
    mode: pass
  - prefix: /transcript
    mode: pass
  - prefix: /static
    mode: collapse
  - prefix: /api/grades-status
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
`)
	cfg, err := Parse(raw)
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if cfg.MemoryQueue() != true {
		t.Fatalf("empty redis should use memory")
	}

	tests := []struct {
		path string
		want Mode
		ok   bool
	}{
		{"/grades", ModeWait, true},
		{"/grades/", ModeWait, true},
		{"/grades/fall", ModeWait, true},
		{"/grades-backup", "", false},
		{"/tax", ModePass, true},
		{"/tax/forms", ModePass, true},
		{"/static/x.css", ModeCollapse, true},
		{"/api/grades-status", ModeCollapse, true},
		{"/unknown", "", false},
	}
	for _, tt := range tests {
		t.Run(tt.path, func(t *testing.T) {
			r, ok := cfg.Match(tt.path)
			if ok != tt.ok {
				t.Fatalf("ok=%v want %v", ok, tt.ok)
			}
			if ok && r.Mode != tt.want {
				t.Fatalf("mode=%s want %s", r.Mode, tt.want)
			}
		})
	}
}

func TestParseRequiresOrigin(t *testing.T) {
	_, err := Parse([]byte("listen: :8080\n"))
	if err == nil {
		t.Fatal("expected error")
	}
}
