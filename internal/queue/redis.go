package queue

import (
	"context"
	"fmt"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// leaseTTLms bounds how long a route's queue and admitted-slot keys survive
// without activity. Every join/overflow/peek refreshes it, so a live rush stays
// put; a finished rush, or slots orphaned by a Porter crash mid-request, expire
// on their own instead of shrinking the cap forever.
const leaseTTLms = 600000 // 10 minutes

// touchLua refreshes the lease on whichever route keys currently exist. It is
// prepended to each script and called before every return.
const touchLua = `
local function touch()
  if redis.call('EXISTS', active) == 1 then redis.call('PEXPIRE', active, ttl) end
  if redis.call('EXISTS', overflow) == 1 then redis.call('PEXPIRE', overflow, ttl) end
  if redis.call('EXISTS', queue) == 1 then redis.call('PEXPIRE', queue, ttl) end
end
`

const (
	joinLua = `
local active = KEYS[1]
local overflow = KEYS[2]
local queue = KEYS[3]
local ticket = ARGV[1]
local max_active = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
` + touchLua + `
if redis.call('SISMEMBER', active, ticket) == 1 then
  touch(); return {1, 0, 0}
end
if redis.call('SISMEMBER', overflow, ticket) == 1 then
  touch(); return {1, 0, 1}
end
if max_active > 0 and redis.call('SCARD', active) < max_active then
  redis.call('SADD', active, ticket)
  redis.call('LREM', queue, 0, ticket)
  touch(); return {1, 0, 0}
end
local q = redis.call('LRANGE', queue, 0, -1)
for i, v in ipairs(q) do
  if v == ticket then
    touch(); return {0, i, 0}
  end
end
redis.call('RPUSH', queue, ticket)
touch(); return {0, #q + 1, 0}
`

	overflowLua = `
local active = KEYS[1]
local overflow = KEYS[2]
local queue = KEYS[3]
local ticket = ARGV[1]
local overflow_active = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])
` + touchLua + `
if redis.call('SISMEMBER', active, ticket) == 1 then
  touch(); return {1, 0, 0}
end
if redis.call('SISMEMBER', overflow, ticket) == 1 then
  touch(); return {1, 0, 1}
end
if overflow_active > 0 and redis.call('SCARD', overflow) < overflow_active then
  redis.call('SADD', overflow, ticket)
  redis.call('LREM', queue, 0, ticket)
  touch(); return {1, 0, 1}
end
local q = redis.call('LRANGE', queue, 0, -1)
for i, v in ipairs(q) do
  if v == ticket then
    touch(); return {0, i, 0}
  end
end
redis.call('RPUSH', queue, ticket)
touch(); return {0, #q + 1, 0}
`

	releaseLua = `
redis.call('SREM', KEYS[1], ARGV[1])
redis.call('SREM', KEYS[2], ARGV[1])
return 1
`

	peekLua = `
local active = KEYS[1]
local overflow = KEYS[2]
local queue = KEYS[3]
local ticket = ARGV[1]
local ttl = tonumber(ARGV[2])
` + touchLua + `
if redis.call('SISMEMBER', active, ticket) == 1 then
  touch(); return {1, 0, 0}
end
if redis.call('SISMEMBER', overflow, ticket) == 1 then
  touch(); return {1, 0, 1}
end
local q = redis.call('LRANGE', queue, 0, -1)
for i, v in ipairs(q) do
  if v == ticket then
    touch(); return {0, i, 0}
  end
end
touch(); return {0, 0, 0}
`
)

type RedisStore struct {
	rdb      *redis.Client
	join     *redis.Script
	overflow *redis.Script
	release  *redis.Script
	peek     *redis.Script
}

func NewRedis(addr string) *RedisStore {
	rdb := redis.NewClient(&redis.Options{
		Addr:         addr,
		DialTimeout:  400 * time.Millisecond,
		ReadTimeout:  400 * time.Millisecond,
		WriteTimeout: 400 * time.Millisecond,
	})
	return newRedisStore(rdb)
}

func NewRedisClient(rdb *redis.Client) *RedisStore {
	return newRedisStore(rdb)
}

func newRedisStore(rdb *redis.Client) *RedisStore {
	return &RedisStore{
		rdb:      rdb,
		join:     redis.NewScript(joinLua),
		overflow: redis.NewScript(overflowLua),
		release:  redis.NewScript(releaseLua),
		peek:     redis.NewScript(peekLua),
	}
}

func (s *RedisStore) Close() error {
	return s.rdb.Close()
}

func (s *RedisStore) keys(route string) []string {
	base := "porter:q:" + route
	return []string{base + ":active", base + ":overflow", base + ":queue"}
}

func (s *RedisStore) JoinOrAdmit(ctx context.Context, route, ticket string, maxActive int) (Result, error) {
	return s.run(ctx, s.join, route, ticket, maxActive)
}

func (s *RedisStore) OverflowTry(ctx context.Context, route, ticket string, overflowActive int) (Result, error) {
	return s.run(ctx, s.overflow, route, ticket, overflowActive)
}

func (s *RedisStore) Peek(ctx context.Context, route, ticket string) (Result, error) {
	raw, err := s.peek.Run(ctx, s.rdb, s.keys(route), ticket, leaseTTLms).Result()
	if err != nil {
		return Result{}, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	return parseLuaResult(raw)
}

func (s *RedisStore) Release(ctx context.Context, route, ticket string) error {
	_, err := s.release.Run(ctx, s.rdb, s.keys(route), ticket).Result()
	if err != nil {
		return fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	return nil
}

func (s *RedisStore) run(ctx context.Context, script *redis.Script, route, ticket string, capn int) (Result, error) {
	raw, err := script.Run(ctx, s.rdb, s.keys(route), ticket, capn, leaseTTLms).Result()
	if err != nil {
		return Result{}, fmt.Errorf("%w: %v", ErrUnavailable, err)
	}
	return parseLuaResult(raw)
}

func parseLuaResult(raw interface{}) (Result, error) {
	arr, ok := raw.([]interface{})
	if !ok || len(arr) < 3 {
		return Result{}, fmt.Errorf("%w: bad lua result %#v", ErrUnavailable, raw)
	}
	return Result{
		Admitted: toInt(arr[0]) == 1,
		Position: toInt(arr[1]),
		Overflow: toInt(arr[2]) == 1,
	}, nil
}

func toInt(v interface{}) int {
	switch x := v.(type) {
	case int64:
		return int(x)
	case int:
		return x
	case string:
		n, _ := strconv.Atoi(x)
		return n
	default:
		return 0
	}
}
