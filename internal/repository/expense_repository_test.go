package repository_test

import (
	"context"
	"fmt"
	"os"
	"sync"
	"testing"
	"time"

	"aeroexpo/internal/db"
	"aeroexpo/internal/model"
	"aeroexpo/internal/repository"
)

func setupTestDB(t *testing.T, dbName string) (*db.DB, func()) {
	t.Helper()
	dbPath := dbName

	database, err := db.NewDB(dbPath)
	if err != nil {
		t.Fatalf("Failed to initialize test database: %v", err)
	}

	err = database.RunMigrations()
	if err != nil {
		database.Close()
		os.Remove(dbPath)
		t.Fatalf("Failed to run migrations: %v", err)
	}

	cleanup := func() {
		database.Close()
		os.Remove(dbPath)
		// Clean up SQLite WAL temporary files if they exist
		os.Remove(dbPath + "-shm")
		os.Remove(dbPath + "-wal")
	}

	return database, cleanup
}

func TestSQLiteExpenseRepository_TimezoneParsing(t *testing.T) {
	database, cleanup := setupTestDB(t, "test_repo_timezone.db")
	defer cleanup()

	repo := repository.NewSQLiteExpenseRepository(database)
	ctx := context.Background()

	exp := &model.Expense{
		ID:       "timezone-test-id",
		Title:    "Coffee",
		Amount:   450,
		Category: "Food",
		Date:     "2026-06-12",
	}

	// Create saves it using RFC3339 in UTC
	err := repo.Create(ctx, exp)
	if err != nil {
		t.Fatalf("failed to create: %v", err)
	}

	// Retrieve and verify
	fetched, err := repo.GetByID(ctx, exp.ID)
	if err != nil {
		t.Fatalf("failed to get: %v", err)
	}

	// The retrieved time should be UTC
	if fetched.CreatedAt.Location() != time.UTC {
		t.Errorf("expected CreatedAt location UTC, got: %v", fetched.CreatedAt.Location())
	}
	if fetched.UpdatedAt.Location() != time.UTC {
		t.Errorf("expected UpdatedAt location UTC, got: %v", fetched.UpdatedAt.Location())
	}

	// Verify that standard SQLite DEFAULT CURRENT_TIMESTAMP format is also parseable
	// Insert raw row with default timestamps
	_, err = database.ExecContext(ctx, `
		INSERT INTO expenses (id, title, amount, category, date)
		VALUES ('raw-test-id', 'Lunch', 1500, 'Food', '2026-06-12')
	`)
	if err != nil {
		t.Fatalf("failed to insert raw row: %v", err)
	}

	fetchedRaw, err := repo.GetByID(ctx, "raw-test-id")
	if err != nil {
		t.Fatalf("failed to fetch raw row: %v", err)
	}

	// Assert parsing succeeded
	if fetchedRaw.CreatedAt.IsZero() {
		t.Error("expected parsed CreatedAt time, got Zero time")
	}
}

func TestSQLiteExpenseRepository_Concurrency(t *testing.T) {
	database, cleanup := setupTestDB(t, "test_repo_concurrency.db")
	defer cleanup()

	repo := repository.NewSQLiteExpenseRepository(database)
	ctx := context.Background()

	numGoroutines := 10
	insertsPerGoroutine := 15

	var wg sync.WaitGroup
	wg.Add(numGoroutines)

	errorsChan := make(chan error, numGoroutines*insertsPerGoroutine)

	// Spin up concurrent writers
	for i := 0; i < numGoroutines; i++ {
		go func(routineID int) {
			defer wg.Done()
			for j := 0; j < insertsPerGoroutine; j++ {
				exp := &model.Expense{
					ID:       fmt.Sprintf("concurrent-id-%d-%d", routineID, j),
					Title:    fmt.Sprintf("Expense %d-%d", routineID, j),
					Amount:   int64((routineID + 1) * (j + 1) * 10),
					Category: "ConcurrentTest",
					Date:     "2026-06-12",
				}
				err := repo.Create(ctx, exp)
				if err != nil {
					errorsChan <- err
				}
			}
		}(i)
	}

	wg.Wait()
	close(errorsChan)

	// Check if any errors occurred during concurrent insertions
	var errs []error
	for err := range errorsChan {
		errs = append(errs, err)
	}

	if len(errs) > 0 {
		t.Fatalf("encountered %d errors during concurrent writes. First error: %v", len(errs), errs[0])
	}

	// Verify total count
	list, err := repo.List(ctx, repository.Filter{Category: "ConcurrentTest"})
	if err != nil {
		t.Fatalf("failed to list expenses: %v", err)
	}

	expectedTotal := numGoroutines * insertsPerGoroutine
	if len(list) != expectedTotal {
		t.Errorf("expected %d total expenses inserted concurrently, got: %d", expectedTotal, len(list))
	}
}
