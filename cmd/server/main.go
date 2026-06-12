package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"aeroexpo/internal/db"
	"aeroexpo/internal/handler"
	"aeroexpo/internal/repository"
	"aeroexpo/internal/service"
)

func main() {
	log.Println("Starting Expense Logger API server...")

	// Configuration
	dbPath := getEnv("DB_PATH", "expenses.db")
	port := getEnv("PORT", "8080")

	// Initialize Database
	database, err := db.NewDB(dbPath)
	if err != nil {
		log.Fatalf("Fatal: Database initialization failed: %v", err)
	}
	defer func() {
		log.Println("Closing database connection...")
		if err := database.Close(); err != nil {
			log.Printf("Error closing database: %v", err)
		}
	}()

	// Run migrations
	log.Println("Running database migrations...")
	if err := database.RunMigrations(); err != nil {
		log.Fatalf("Fatal: Migration execution failed: %v", err)
	}
	log.Println("Migrations executed successfully.")

	// Wire up dependencies
	repo := repository.NewSQLiteExpenseRepository(database)
	svc := service.NewDefaultExpenseService(repo)
	h := handler.NewExpenseHandler(svc)

	// Set up router and register routes
	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	// [PATCH IMPLEMENTATION] Serve static files for the frontend if STATIC_DIR env variable is defined.
	// This serves as a temporary/patch solution to run the whole application in a single container.
	if staticDir := getEnv("STATIC_DIR", ""); staticDir != "" {
		log.Printf("[PATCH] Serving static frontend files from %s...", staticDir)
		fileServer := http.FileServer(http.Dir(staticDir))
		mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
			// If requested path does not map to a real static file, serve index.html (SPA fallback)
			fs := http.Dir(staticDir)
			f, err := fs.Open(r.URL.Path)
			if err != nil {
				http.ServeFile(w, r, staticDir+"/index.html")
				return
			}
			f.Close()
			fileServer.ServeHTTP(w, r)
		})
	}

	// Wrap mux with global middlewares
	var handlerStack http.Handler = mux
	handlerStack = handler.RecoveryMiddleware(handlerStack)
	handlerStack = handler.CORSMiddleware(handlerStack)
	handlerStack = handler.LoggingMiddleware(handlerStack)

	// Configure HTTP Server
	server := &http.Server{
		Addr:         ":" + port,
		Handler:      handlerStack,
		ReadTimeout:  10 * time.Second,
		WriteTimeout: 10 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Graceful shutdown channel
	shutdownChan := make(chan os.Signal, 1)
	signal.Notify(shutdownChan, os.Interrupt, syscall.SIGTERM)

	// Start server in background
	go func() {
		log.Printf("Server is listening on port %s...", port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("Fatal: Server listening failed: %v", err)
		}
	}()

	// Block until signal is received
	sig := <-shutdownChan
	log.Printf("Received signal %v. Initiating graceful shutdown...", sig)

	// Context for server shutdown timeout
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		log.Printf("Server forced shutdown: %v", err)
	} else {
		log.Println("Server shut down cleanly.")
	}
}

func getEnv(key, fallback string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return fallback
}
