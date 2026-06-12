package handler_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"aeroexpo/internal/db"
	"aeroexpo/internal/handler"
	"aeroexpo/internal/model"
	"aeroexpo/internal/repository"
	"aeroexpo/internal/service"
)

func setupTestServer(t *testing.T) (*db.DB, http.Handler, func()) {
	t.Helper()
	dbPath := "test_handler.db"

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

	repo := repository.NewSQLiteExpenseRepository(database)
	svc := service.NewDefaultExpenseService(repo)
	h := handler.NewExpenseHandler(svc)

	mux := http.NewServeMux()
	h.RegisterRoutes(mux)

	cleanup := func() {
		database.Close()
		os.Remove(dbPath)
	}

	return database, mux, cleanup
}

func TestExpenseHandler_Lifecycle(t *testing.T) {
	_, router, cleanup := setupTestServer(t)
	defer cleanup()

	// 1. Create an expense (POST /expenses)
	payload := `{"title":"Dinner","amount":4500,"category":"Food","date":"2026-06-12"}`
	req := httptest.NewRequest("POST", "/expenses", bytes.NewBufferString(payload))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Fatalf("expected status 201 Created, got %d, body: %s", w.Code, w.Body.String())
	}

	var created model.Expense
	if err := json.NewDecoder(w.Body).Decode(&created); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if created.ID == "" || created.Title != "Dinner" || created.Amount != 4500 {
		t.Fatalf("created expense properties incorrect: %+v", created)
	}

	// 2. Fetch the created expense (GET /expenses/{id})
	req = httptest.NewRequest("GET", "/expenses/"+created.ID, nil)
	w = httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d", w.Code)
	}

	var fetched model.Expense
	if err := json.NewDecoder(w.Body).Decode(&fetched); err != nil {
		t.Fatalf("failed to decode fetched: %v", err)
	}
	if fetched.ID != created.ID || fetched.Title != "Dinner" {
		t.Errorf("fetched expense doesn't match: %+v", fetched)
	}

	// 3. Update the expense (PUT /expenses/{id})
	updatePayload := `{"title":"Updated Dinner","amount":5000,"category":"Food","date":"2026-06-12"}`
	req = httptest.NewRequest("PUT", "/expenses/"+created.ID, bytes.NewBufferString(updatePayload))
	req.Header.Set("Content-Type", "application/json")
	w = httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d, body: %s", w.Code, w.Body.String())
	}

	var updated model.Expense
	if err := json.NewDecoder(w.Body).Decode(&updated); err != nil {
		t.Fatalf("failed to decode updated: %v", err)
	}
	if updated.Title != "Updated Dinner" || updated.Amount != 5000 {
		t.Errorf("update properties mismatch: %+v", updated)
	}

	// 4. List expenses (GET /expenses)
	req = httptest.NewRequest("GET", "/expenses?category=Food", nil)
	w = httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d", w.Code)
	}

	var list []model.Expense
	if err := json.NewDecoder(w.Body).Decode(&list); err != nil {
		t.Fatalf("failed to decode list: %v", err)
	}
	if len(list) != 1 {
		t.Errorf("expected list length 1, got %d", len(list))
	}

	// 5. Get summary (GET /expenses/summary)
	req = httptest.NewRequest("GET", "/expenses/summary?start_date=2026-06-10&end_date=2026-06-15", nil)
	w = httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK, got %d", w.Code)
	}

	var summary model.Summary
	if err := json.NewDecoder(w.Body).Decode(&summary); err != nil {
		t.Fatalf("failed to decode summary: %v", err)
	}
	if summary.TotalSpent != 5000 {
		t.Errorf("expected total spent 5000, got %d", summary.TotalSpent)
	}
	if summary.CategoryBreakdown["Food"] != 5000 {
		t.Errorf("expected Food breakdown 5000, got %d", summary.CategoryBreakdown["Food"])
	}

	// 6. Delete expense (DELETE /expenses/{id})
	req = httptest.NewRequest("DELETE", "/expenses/"+created.ID, nil)
	w = httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusNoContent {
		t.Fatalf("expected status 204 No Content, got %d", w.Code)
	}

	// 7. Verify deleted is 404 (GET /expenses/{id})
	req = httptest.NewRequest("GET", "/expenses/"+created.ID, nil)
	w = httptest.NewRecorder()

	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("expected status 404 Not Found after deletion, got %d", w.Code)
	}
}

func TestExpenseHandler_ValidationFailures(t *testing.T) {
	_, router, cleanup := setupTestServer(t)
	defer cleanup()

	tests := []struct {
		name           string
		method         string
		url            string
		body           string
		expectedStatus int
		expectedField  string
	}{
		{
			name:           "Create missing title",
			method:         "POST",
			url:            "/expenses",
			body:           `{"title":"","amount":100,"category":"Food","date":"2026-06-12"}`,
			expectedStatus: http.StatusBadRequest,
			expectedField:  "title",
		},
		{
			name:           "Create invalid amount",
			method:         "POST",
			url:            "/expenses",
			body:           `{"title":"Dinner","amount":-10,"category":"Food","date":"2026-06-12"}`,
			expectedStatus: http.StatusBadRequest,
			expectedField:  "amount",
		},
		{
			name:           "Create invalid date format",
			method:         "POST",
			url:            "/expenses",
			body:           `{"title":"Dinner","amount":100,"category":"Food","date":"12/06/2026"}`,
			expectedStatus: http.StatusBadRequest,
			expectedField:  "date",
		},
		{
			name:           "Get non-existent expense",
			method:         "GET",
			url:            "/expenses/non-existent-uuid",
			body:           "",
			expectedStatus: http.StatusNotFound,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.url, bytes.NewBufferString(tt.body))
			if tt.body != "" {
				req.Header.Set("Content-Type", "application/json")
			}
			w := httptest.NewRecorder()

			router.ServeHTTP(w, req)

			if w.Code != tt.expectedStatus {
				t.Fatalf("expected status %d, got %d, body: %s", tt.expectedStatus, w.Code, w.Body.String())
			}

			if tt.expectedField != "" {
				var responseMap map[string]string
				if err := json.NewDecoder(w.Body).Decode(&responseMap); err != nil {
					t.Fatalf("failed to decode response: %v", err)
				}
				if responseMap["field"] != tt.expectedField {
					t.Errorf("expected validation field error for %q, got body: %+v", tt.expectedField, responseMap)
				}
			}
		})
	}
}

func TestExpenseHandler_E2E(t *testing.T) {
	_, router, cleanup := setupTestServer(t)
	defer cleanup()

	// Spin up the real HTTP network server test listener
	ts := httptest.NewServer(router)
	defer ts.Close()

	client := ts.Client() // Configured http.Client connected to the server socket

	// 1. Create expense via real socket-level POST
	postPayload := `{"title":"Monitor","amount":29999,"category":"Office","date":"2026-06-12"}`
	resp, err := client.Post(ts.URL+"/expenses", "application/json", bytes.NewBufferString(postPayload))
	if err != nil {
		t.Fatalf("E2E POST failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusCreated {
		t.Fatalf("expected 201, got %d", resp.StatusCode)
	}

	var created model.Expense
	if err := json.NewDecoder(resp.Body).Decode(&created); err != nil {
		t.Fatalf("failed to decode created response: %v", err)
	}

	// 2. Fetch list via real socket-level GET
	getResp, err := client.Get(ts.URL + "/expenses")
	if err != nil {
		t.Fatalf("E2E GET list failed: %v", err)
	}
	defer getResp.Body.Close()

	if getResp.StatusCode != http.StatusOK {
		t.Fatalf("expected 200, got %d", getResp.StatusCode)
	}

	var list []model.Expense
	if err := json.NewDecoder(getResp.Body).Decode(&list); err != nil {
		t.Fatalf("failed to decode list response: %v", err)
	}
	if len(list) != 1 || list[0].ID != created.ID {
		t.Errorf("list contents mismatch: %+v", list)
	}
}

