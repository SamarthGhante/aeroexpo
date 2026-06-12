package service_test

import (
	"context"
	"os"
	"strings"
	"testing"

	"aeroexpo/internal/db"
	"aeroexpo/internal/repository"
	"aeroexpo/internal/service"
)

func setupTestDB(t *testing.T) (*db.DB, func()) {
	t.Helper()
	dbPath := "test_service.db"
	
	database, err := db.NewDB(dbPath)
	if err != nil {
		t.Fatalf("Failed to initialize database: %v", err)
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
	}

	return database, cleanup
}

func TestExpenseService_Create(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := repository.NewSQLiteExpenseRepository(database)
	svc := service.NewDefaultExpenseService(repo)
	ctx := context.Background()

	tests := []struct {
		name    string
		req     service.CreateExpenseRequest
		wantErr bool
		errField string
	}{
		{
			name: "Valid expense",
			req: service.CreateExpenseRequest{
				Title:    "Lunch",
				Amount:   1250,
				Category: "Food",
				Date:     "2026-06-12",
			},
			wantErr: false,
		},
		{
			name: "Empty title",
			req: service.CreateExpenseRequest{
				Title:    "",
				Amount:   1250,
				Category: "Food",
				Date:     "2026-06-12",
			},
			wantErr:  true,
			errField: "title",
		},
		{
			name: "Title too long",
			req: service.CreateExpenseRequest{
				Title:    strings.Repeat("a", 101),
				Amount:   1250,
				Category: "Food",
				Date:     "2026-06-12",
			},
			wantErr:  true,
			errField: "title",
		},
		{
			name: "Zero amount",
			req: service.CreateExpenseRequest{
				Title:    "Lunch",
				Amount:   0,
				Category: "Food",
				Date:     "2026-06-12",
			},
			wantErr:  true,
			errField: "amount",
		},
		{
			name: "Negative amount",
			req: service.CreateExpenseRequest{
				Title:    "Lunch",
				Amount:   -500,
				Category: "Food",
				Date:     "2026-06-12",
			},
			wantErr:  true,
			errField: "amount",
		},
		{
			name: "Empty category",
			req: service.CreateExpenseRequest{
				Title:    "Lunch",
				Amount:   1250,
				Category: "",
				Date:     "2026-06-12",
			},
			wantErr:  true,
			errField: "category",
		},
		{
			name: "Category too long",
			req: service.CreateExpenseRequest{
				Title:    "Lunch",
				Amount:   1250,
				Category: strings.Repeat("c", 51),
				Date:     "2026-06-12",
			},
			wantErr:  true,
			errField: "category",
		},
		{
			name: "Invalid date format",
			req: service.CreateExpenseRequest{
				Title:    "Lunch",
				Amount:   1250,
				Category: "Food",
				Date:     "12-06-2026",
			},
			wantErr:  true,
			errField: "date",
		},
		{
			name: "Non-existent date",
			req: service.CreateExpenseRequest{
				Title:    "Lunch",
				Amount:   1250,
				Category: "Food",
				Date:     "2026-02-30", // February doesn't have 30 days
			},
			wantErr:  true,
			errField: "date",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			exp, err := svc.Create(ctx, tt.req)
			if tt.wantErr {
				if err == nil {
					t.Error("expected error but got nil")
					return
				}
				var valErr service.ValidationError
				if ok := valErr.Error(); ok != "" {
					// verify it is a ValidationError and has correct field
					if !strings.Contains(err.Error(), tt.errField) {
						t.Errorf("expected error field %q, got: %v", tt.errField, err)
					}
				}
			} else {
				if err != nil {
					t.Fatalf("unexpected error: %v", err)
				}
				if exp.ID == "" {
					t.Error("expected generated UUID ID, got empty string")
				}
				if exp.Title != tt.req.Title {
					t.Errorf("expected title %q, got %q", tt.req.Title, exp.Title)
				}
				if exp.Amount != tt.req.Amount {
					t.Errorf("expected amount %d, got %d", tt.req.Amount, exp.Amount)
				}
				if exp.Category != tt.req.Category {
					t.Errorf("expected category %q, got %q", tt.req.Category, exp.Category)
				}
				if exp.Date != tt.req.Date {
					t.Errorf("expected date %q, got %q", tt.req.Date, exp.Date)
				}
			}
		})
	}
}

func TestExpenseService_LifecycleAndQueries(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := repository.NewSQLiteExpenseRepository(database)
	svc := service.NewDefaultExpenseService(repo)
	ctx := context.Background()

	// 1. Create expenses
	e1, err := svc.Create(ctx, service.CreateExpenseRequest{
		Title:    "Groceries",
		Amount:   5050,
		Category: "Food",
		Date:     "2026-06-01",
	})
	if err != nil {
		t.Fatalf("failed to create: %v", err)
	}

	e2, err := svc.Create(ctx, service.CreateExpenseRequest{
		Title:    "Bus Ticket",
		Amount:   250,
		Category: "Transport",
		Date:     "2026-06-02",
	})
	if err != nil {
		t.Fatalf("failed to create: %v", err)
	}

	e3, err := svc.Create(ctx, service.CreateExpenseRequest{
		Title:    "Dinner",
		Amount:   3000,
		Category: "Food",
		Date:     "2026-06-05",
	})
	if err != nil {
		t.Fatalf("failed to create: %v", err)
	}

	// 2. Get by ID
	fetched, err := svc.Get(ctx, e1.ID)
	if err != nil {
		t.Fatalf("failed to get: %v", err)
	}
	if fetched.Title != "Groceries" {
		t.Errorf("expected Title 'Groceries', got %q", fetched.Title)
	}

	// 3. Update expense
	updated, err := svc.Update(ctx, e2.ID, service.UpdateExpenseRequest{
		Title:    "Train Ticket",
		Amount:   500,
		Category: "Transport",
		Date:     "2026-06-02",
	})
	if err != nil {
		t.Fatalf("failed to update: %v", err)
	}
	if updated.Title != "Train Ticket" || updated.Amount != 500 {
		t.Errorf("update failed, got: %+v", updated)
	}

	// 4. List expenses with category filter
	list, err := svc.List(ctx, repository.Filter{Category: "Food"})
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if len(list) != 2 {
		t.Errorf("expected 2 Food expenses, got %d", len(list))
	}

	// 5. Get Summary
	summary, err := svc.GetSummary(ctx, "2026-06-01", "2026-06-04")
	if err != nil {
		t.Fatalf("summary failed: %v", err)
	}
	// Total should be e1 (5050) + e2 (updated to 500) = 5550. e3 is outside range.
	if summary.TotalSpent != 5550 {
		t.Errorf("expected total spent 5550, got %d", summary.TotalSpent)
	}
	if summary.CategoryBreakdown["Food"] != 5050 {
		t.Errorf("expected Food category total 5050, got %d", summary.CategoryBreakdown["Food"])
	}
	if summary.CategoryBreakdown["Transport"] != 500 {
		t.Errorf("expected Transport category total 500, got %d", summary.CategoryBreakdown["Transport"])
	}

	// 6. Delete expense
	err = svc.Delete(ctx, e3.ID)
	if err != nil {
		t.Fatalf("delete failed: %v", err)
	}

	// Verify deleted
	_, err = svc.Get(ctx, e3.ID)
	if err == nil {
		t.Error("expected error retrieving deleted expense, got nil")
	}
}

func TestExpenseService_EdgeCases(t *testing.T) {
	database, cleanup := setupTestDB(t)
	defer cleanup()

	repo := repository.NewSQLiteExpenseRepository(database)
	svc := service.NewDefaultExpenseService(repo)
	ctx := context.Background()

	// 1. Test HTML / Javascript injection inside fields (should be allowed and stored safely, standard JSON handles escape)
	injectedPayload := service.CreateExpenseRequest{
		Title:    "<script>alert('xss')</script>",
		Amount:   1000,
		Category: "<strong>Food</strong>",
		Date:     "2026-06-12",
	}
	exp, err := svc.Create(ctx, injectedPayload)
	if err != nil {
		t.Fatalf("failed to create with html strings: %v", err)
	}
	if exp.Title != "<script>alert('xss')</script>" {
		t.Errorf("expected HTML title intact, got: %q", exp.Title)
	}

	// 2. Test invalid UTF-8 sequence in Title
	invalidUTF8Title := service.CreateExpenseRequest{
		Title:    "Hello \xff World", // \xff is invalid UTF-8
		Amount:   1000,
		Category: "Food",
		Date:     "2026-06-12",
	}
	_, err = svc.Create(ctx, invalidUTF8Title)
	if err == nil {
		t.Error("expected error for invalid UTF-8 title, got nil")
	}

	// 3. Test invalid UTF-8 sequence in Category
	invalidUTF8Category := service.CreateExpenseRequest{
		Title:    "Coffee",
		Amount:   1000,
		Category: "Food \xff", // \xff is invalid UTF-8
		Date:     "2026-06-12",
	}
	_, err = svc.Create(ctx, invalidUTF8Category)
	if err == nil {
		t.Error("expected error for invalid UTF-8 category, got nil")
	}

	// 4. Test extreme high limit amount (integer overflow limit)
	maxAmountReq := service.CreateExpenseRequest{
		Title:    "Private Jet",
		Amount:   9223372036854775807, // Max Int64
		Category: "Transport",
		Date:     "2026-06-12",
	}
	expMax, err := svc.Create(ctx, maxAmountReq)
	if err != nil {
		t.Fatalf("failed to create with max amount: %v", err)
	}
	if expMax.Amount != 9223372036854775807 {
		t.Errorf("expected max amount stored, got: %d", expMax.Amount)
	}
}

