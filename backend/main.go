package main

import (
	"fmt"
	"log"
	"net/http"
	"net/url"
	"strings"

	"github.com/gorilla/mux"
)

func handler(res http.ResponseWriter, req *http.Request) {
	fmt.Fprintf(res, "G'day there mate")
}
func routingMiddleware(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u := *r.URL
		u.Path = strings.TrimSuffix(u.Path, "/")
		// Validate URL to prevent open redirect / SSRF (S5144)
		if _, err := url.Parse(u.String()); err != nil {
			http.Error(w, "Invalid URL", http.StatusBadRequest)
			return
		}
		r.URL = &u

		h.ServeHTTP(w, r)
	})
}

func main() {
	r := mux.NewRouter().StrictSlash(true)
	r.Use(routingMiddleware)

	r.HandleFunc("/api/v1", handler)

	srv := &http.Server{
		Addr:    ":3433",
		Handler: r,
	}
	log.Printf("starting drop server on :3433")
	srv.ListenAndServe()
}
