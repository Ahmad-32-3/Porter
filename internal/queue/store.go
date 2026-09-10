package queue

import (
	"context"
	"errors"
)

var ErrUnavailable = errors.New("queue unavailable")

type Result struct {
	Admitted bool
	Overflow bool
	Position int
}

type Store interface {
	JoinOrAdmit(ctx context.Context, route, ticket string, maxActive int) (Result, error)
	OverflowTry(ctx context.Context, route, ticket string, overflowActive int) (Result, error)
	Peek(ctx context.Context, route, ticket string) (Result, error)
	Release(ctx context.Context, route, ticket string) error
}
