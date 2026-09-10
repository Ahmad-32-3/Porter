package queue

import (
	"context"
	"sync"
)

type routeState struct {
	active   map[string]struct{}
	overflow map[string]struct{}
	queue    []string
	queued   map[string]int
}

type Memory struct {
	mu     sync.Mutex
	routes map[string]*routeState
}

func NewMemory() *Memory {
	return &Memory{routes: make(map[string]*routeState)}
}

func (m *Memory) route(name string) *routeState {
	r, ok := m.routes[name]
	if !ok {
		r = &routeState{
			active:   make(map[string]struct{}),
			overflow: make(map[string]struct{}),
			queued:   make(map[string]int),
		}
		m.routes[name] = r
	}
	return r
}

func (m *Memory) JoinOrAdmit(_ context.Context, route, ticket string, maxActive int) (Result, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	st := m.route(route)
	if _, ok := st.active[ticket]; ok {
		return Result{Admitted: true}, nil
	}
	if _, ok := st.overflow[ticket]; ok {
		return Result{Admitted: true, Overflow: true}, nil
	}
	if maxActive > 0 && len(st.active) < maxActive {
		st.removeQueued(ticket)
		st.active[ticket] = struct{}{}
		return Result{Admitted: true}, nil
	}
	pos := st.enqueue(ticket)
	return Result{Position: pos}, nil
}

func (m *Memory) OverflowTry(_ context.Context, route, ticket string, overflowActive int) (Result, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	st := m.route(route)
	if _, ok := st.active[ticket]; ok {
		return Result{Admitted: true}, nil
	}
	if _, ok := st.overflow[ticket]; ok {
		return Result{Admitted: true, Overflow: true}, nil
	}
	if overflowActive > 0 && len(st.overflow) < overflowActive {
		st.removeQueued(ticket)
		st.overflow[ticket] = struct{}{}
		return Result{Admitted: true, Overflow: true}, nil
	}
	pos := st.enqueue(ticket)
	return Result{Position: pos}, nil
}

func (m *Memory) Peek(_ context.Context, route, ticket string) (Result, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	st := m.route(route)
	if _, ok := st.active[ticket]; ok {
		return Result{Admitted: true}, nil
	}
	if _, ok := st.overflow[ticket]; ok {
		return Result{Admitted: true, Overflow: true}, nil
	}
	if pos, ok := st.queued[ticket]; ok {
		return Result{Position: pos}, nil
	}
	return Result{}, nil
}

func (m *Memory) Release(_ context.Context, route, ticket string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	st := m.route(route)
	delete(st.active, ticket)
	delete(st.overflow, ticket)
	return nil
}

func (st *routeState) enqueue(ticket string) int {
	if pos, ok := st.queued[ticket]; ok {
		return pos
	}
	st.queue = append(st.queue, ticket)
	pos := len(st.queue)
	st.queued[ticket] = pos
	return pos
}

func (st *routeState) removeQueued(ticket string) {
	if _, ok := st.queued[ticket]; !ok {
		return
	}
	out := st.queue[:0]
	for _, t := range st.queue {
		if t != ticket {
			out = append(out, t)
		}
	}
	st.queue = out
	st.queued = make(map[string]int, len(st.queue))
	for i, t := range st.queue {
		st.queued[t] = i + 1
	}
}

type Unavailable struct{}

func (Unavailable) JoinOrAdmit(context.Context, string, string, int) (Result, error) {
	return Result{}, ErrUnavailable
}

func (Unavailable) OverflowTry(context.Context, string, string, int) (Result, error) {
	return Result{}, ErrUnavailable
}

func (Unavailable) Peek(context.Context, string, string) (Result, error) {
	return Result{}, ErrUnavailable
}

func (Unavailable) Release(context.Context, string, string) error {
	return ErrUnavailable
}
