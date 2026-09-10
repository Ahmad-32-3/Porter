package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	"porter/internal/config"
	"porter/internal/proxy"
	"porter/internal/queue"
)

func main() {
	configPath := flag.String("config", "porter.yaml", "YAML config path")
	listen := flag.String("listen", "", "override listen address")
	flag.Parse()

	log.SetOutput(os.Stderr)
	cfg, err := config.Load(*configPath)
	if err != nil {
		log.Fatal(err)
	}
	if *listen != "" {
		cfg.Listen = *listen
	}

	var store queue.Store
	if cfg.MemoryQueue() {
		log.Printf("queue=memory")
		store = queue.NewMemory()
	} else {
		log.Printf("queue=redis addr=%s", cfg.Redis)
		store = queue.NewRedis(cfg.Redis)
	}

	p, err := proxy.New(cfg, store, log.Default())
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("porter listen=%s origin=%s", cfg.Listen, cfg.Origin)
	srv := &http.Server{
		Addr:              cfg.Listen,
		Handler:           p.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
