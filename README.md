# Porter

A reverse proxy with path rules. The crowded hallway gets a line. The other hallways stay open.

Porter sits in front of an origin. It is a small self-hosted binary, not a CDN and not Queue-it. The site under `web/` is a case study of the product. It is not the product.

## What it does

| Path kind | Mode | Behavior |
|---|---|---|
| `/grades` | `wait` | FIFO ticket. Cap origin concurrency. Waiting room HTML if you are not admitted. |
| `/tax`, `/transcript` | `pass` | Proxy immediately. These do not share the grades cap. |
| `/static`, `/api/grades-status` | `collapse` | One origin fetch, many waiters, only if the response is shareable. |

Private grades are never stored in a shared cache. `Cache-Control: private`, `Set-Cookie`, and `Authorization` requests do not satisfy other waiters. Stale leftover pages are for public paths only.

`Try anyway` is a second semaphore (`overflow_active`). It is not an unlimited skip.

Prefix matching is slash-boundary. `/grades` matches `/grades`, `/grades/`, and `/grades/123`. It does not match `/grades-backup`.

## Run locally

Docker Compose starts Porter, Redis, and a fake campus origin:

```bash
docker compose -f deploy/compose.yaml up --build
```

Then:

- http://localhost:8080/grades : line when busy
- http://localhost:8080/tax : stays open
- http://localhost:8080/__porter/ready : cheap ready flag
- http://localhost:8080/metrics : Prometheus text

Load both paths after it is up (`make load`, or `hey` against those URLs). Tax should stay fast while grades queues.

Without Docker, unit tests still run:

```bash
go test ./...
```

Empty `redis:` in YAML uses an in-memory queue (`porter demo` / tests). If Redis is configured and down, pass routes still proxy. Wait routes stay in the room and do not dump onto origin.

## Point it at a real origin

Copy `porter.yaml`. Set `origin:` to the real host. Keep wait on the expensive personalized path only. Leave transcripts, tax forms, and other portal pages on `pass`.

```yaml
origin: https://portal.example.edu
listen: :8080
redis: redis:6379
routes:
  - prefix: /grades
    mode: wait
    max_active: 20
    overflow_active: 5
  - prefix: /tax
    mode: pass
```

```bash
go run ./cmd/porter -config porter.yaml
```

Tickets are HttpOnly (`porter_ticket`). Waiting and error responses are `Cache-Control: no-store`. Porter does not log response bodies.

## Layout

- `cmd/porter` proxy
- `cmd/campus` fake origin for Compose and tests
- `internal/proxy`, `internal/queue`, `internal/collapse`, `internal/config`
- `deploy/compose.yaml`
- `web/` case-study page (Vite)
