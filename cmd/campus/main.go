package main

import (
	"flag"
	"log"
	"net/http"
	"os"
	"time"

	"porter/internal/campus"
)

func main() {
	listen := flag.String("listen", ":8081", "listen address")
	delay := flag.Duration("grades-delay", 800*time.Millisecond, "delay for /grades")
	flag.Parse()
	o := campus.New()
	o.GradesDelay = *delay
	log.SetOutput(os.Stderr)
	log.Printf("campus origin listen=%s grades-delay=%s", *listen, *delay)
	srv := &http.Server{
		Addr:              *listen,
		Handler:           o.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
	}
	if err := srv.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
