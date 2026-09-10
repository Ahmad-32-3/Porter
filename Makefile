GO ?= go
COMPOSE ?= docker compose -f deploy/compose.yaml

.PHONY: test test-race fmt vet up down load

fmt:
	$(GO) fmt ./...

vet:
	$(GO) vet ./...

test:
	$(GO) test ./...

test-race:
	$(GO) test -race ./...

up:
	$(COMPOSE) up --build -d

down:
	$(COMPOSE) down

# Hit the crowded path and the open path after `make up`.
# Tax should stay snappy while grades queues.
load:
	docker run --rm williamyeh/hey:latest -n 80 -c 20 http://host.docker.internal:8080/grades
	docker run --rm williamyeh/hey:latest -n 40 -c 10 -m GET http://host.docker.internal:8080/tax
