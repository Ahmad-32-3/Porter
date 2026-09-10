package queue

import (
	"context"
	"sync"
	"testing"
)

func TestMemoryAdmitCapAndOverflow(t *testing.T) {
	m := NewMemory()
	ctx := context.Background()

	a, err := m.JoinOrAdmit(ctx, "/grades", "t1", 1)
	if err != nil || !a.Admitted {
		t.Fatalf("t1 should admit: %+v %v", a, err)
	}
	b, err := m.JoinOrAdmit(ctx, "/grades", "t2", 1)
	if err != nil || b.Admitted || b.Position != 1 {
		t.Fatalf("t2 should wait at 1: %+v %v", b, err)
	}
	c, err := m.JoinOrAdmit(ctx, "/grades", "t3", 1)
	if err != nil || c.Position != 2 {
		t.Fatalf("t3 should wait at 2: %+v %v", c, err)
	}

	ov, err := m.OverflowTry(ctx, "/grades", "t2", 1)
	if err != nil || !ov.Admitted || !ov.Overflow {
		t.Fatalf("t2 overflow should admit: %+v %v", ov, err)
	}
	denied, err := m.OverflowTry(ctx, "/grades", "t3", 1)
	if err != nil || denied.Admitted {
		t.Fatalf("t3 overflow should deny: %+v %v", denied, err)
	}

	if err := m.Release(ctx, "/grades", "t1"); err != nil {
		t.Fatal(err)
	}
	again, err := m.JoinOrAdmit(ctx, "/grades", "t3", 1)
	if err != nil || !again.Admitted {
		t.Fatalf("t3 should admit after release: %+v %v", again, err)
	}
}

func TestMemoryPeek(t *testing.T) {
	m := NewMemory()
	ctx := context.Background()
	_, _ = m.JoinOrAdmit(ctx, "/grades", "t1", 1)
	_, _ = m.JoinOrAdmit(ctx, "/grades", "t2", 1)
	p, err := m.Peek(ctx, "/grades", "t2")
	if err != nil || p.Admitted || p.Position != 1 {
		t.Fatalf("peek t2: %+v %v", p, err)
	}
	a, err := m.Peek(ctx, "/grades", "t1")
	if err != nil || !a.Admitted {
		t.Fatalf("peek t1: %+v %v", a, err)
	}
}

func TestMemoryConcurrentCap(t *testing.T) {
	m := NewMemory()
	ctx := context.Background()
	const n = 20
	var admitted int
	var mu sync.Mutex
	var wg sync.WaitGroup
	wg.Add(n)
	for i := 0; i < n; i++ {
		go func(i int) {
			defer wg.Done()
			ticket := string(rune('a' + i))
			res, err := m.JoinOrAdmit(ctx, "/grades", ticket, 1)
			if err != nil {
				t.Errorf("join: %v", err)
				return
			}
			if res.Admitted {
				mu.Lock()
				admitted++
				mu.Unlock()
			}
		}(i)
	}
	wg.Wait()
	if admitted != 1 {
		t.Fatalf("admitted=%d want 1", admitted)
	}
}
