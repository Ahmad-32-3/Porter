package queue

import (
	"context"
	"testing"

	"github.com/alicebob/miniredis/v2"
	"github.com/redis/go-redis/v9"
)

func TestRedisJoinOverflowRelease(t *testing.T) {
	mr := miniredis.RunT(t)
	rdb := redis.NewClient(&redis.Options{Addr: mr.Addr()})
	t.Cleanup(func() { _ = rdb.Close() })
	s := NewRedisClient(rdb)
	ctx := context.Background()

	a, err := s.JoinOrAdmit(ctx, "/grades", "t1", 1)
	if err != nil || !a.Admitted {
		t.Fatalf("t1: %+v %v", a, err)
	}
	b, err := s.JoinOrAdmit(ctx, "/grades", "t2", 1)
	if err != nil || b.Admitted || b.Position != 1 {
		t.Fatalf("t2: %+v %v", b, err)
	}
	ov, err := s.OverflowTry(ctx, "/grades", "t2", 1)
	if err != nil || !ov.Admitted || !ov.Overflow {
		t.Fatalf("overflow: %+v %v", ov, err)
	}
	if err := s.Release(ctx, "/grades", "t1"); err != nil {
		t.Fatal(err)
	}
	c, err := s.JoinOrAdmit(ctx, "/grades", "t3", 1)
	if err != nil || !c.Admitted {
		t.Fatalf("t3 after release: %+v %v", c, err)
	}
	peek, err := s.Peek(ctx, "/grades", "t3")
	if err != nil || !peek.Admitted {
		t.Fatalf("peek: %+v %v", peek, err)
	}
}

func TestRedisDown(t *testing.T) {
	s := NewRedis("127.0.0.1:1")
	t.Cleanup(func() { _ = s.Close() })
	_, err := s.JoinOrAdmit(context.Background(), "/grades", "t1", 1)
	if err == nil {
		t.Fatal("expected unavailable")
	}
}
