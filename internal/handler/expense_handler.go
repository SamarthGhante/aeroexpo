package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	"aeroexpo/internal/model"
	"aeroexpo/internal/repository"
	"aeroexpo/internal/service"
)

type ExpenseHandler struct {
	service service.ExpenseService
}

func NewExpenseHandler(s service.ExpenseService) *ExpenseHandler {
	return &ExpenseHandler{service: s}
}

// Helpers for JSON responses
func respondWithError(w http.ResponseWriter, code int, message string) {
	respondWithJSON(w, code, map[string]string{"error": message})
}

func respondWithValidationError(w http.ResponseWriter, valErr service.ValidationError) {
	respondWithJSON(w, http.StatusBadRequest, map[string]string{
		"error": fmt.Sprintf("invalid %s: %s", valErr.Field, valErr.Message),
		"field": valErr.Field,
	})
}

func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	if payload != nil {
		if err := json.NewEncoder(w).Encode(payload); err != nil {
			// If JSON encoding fails, log and write a fallback error
			http.Error(w, `{"error":"internal server error"}`, http.StatusInternalServerError)
		}
	}
}

// RegisterRoutes configures endpoints using Go 1.22+ ServeMux patterns
func (h *ExpenseHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /expenses", h.CreateExpense)
	mux.HandleFunc("GET /expenses", h.ListExpenses)
	mux.HandleFunc("GET /expenses/summary", h.GetSummary)
	mux.HandleFunc("GET /expenses/{id}", h.GetExpense)
	mux.HandleFunc("PUT /expenses/{id}", h.UpdateExpense)
	mux.HandleFunc("DELETE /expenses/{id}", h.DeleteExpense)
}

// CreateExpense handles POST /expenses
func (h *ExpenseHandler) CreateExpense(w http.ResponseWriter, r *http.Request) {
	var req service.CreateExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "invalid request body: JSON payload expected")
		return
	}

	expense, err := h.service.Create(r.Context(), req)
	if err != nil {
		var valErr service.ValidationError
		if errors.As(err, &valErr) {
			respondWithValidationError(w, valErr)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "failed to create expense")
		return
	}

	respondWithJSON(w, http.StatusCreated, expense)
}

// GetExpense handles GET /expenses/{id}
func (h *ExpenseHandler) GetExpense(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		respondWithError(w, http.StatusBadRequest, "missing expense ID")
		return
	}

	expense, err := h.service.Get(r.Context(), id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			respondWithError(w, http.StatusNotFound, "expense not found")
			return
		}
		var valErr service.ValidationError
		if errors.As(err, &valErr) {
			respondWithValidationError(w, valErr)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "failed to retrieve expense")
		return
	}

	respondWithJSON(w, http.StatusOK, expense)
}

// UpdateExpense handles PUT /expenses/{id}
func (h *ExpenseHandler) UpdateExpense(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		respondWithError(w, http.StatusBadRequest, "missing expense ID")
		return
	}

	var req service.UpdateExpenseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "invalid request body: JSON payload expected")
		return
	}

	expense, err := h.service.Update(r.Context(), id, req)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			respondWithError(w, http.StatusNotFound, "expense not found")
			return
		}
		var valErr service.ValidationError
		if errors.As(err, &valErr) {
			respondWithValidationError(w, valErr)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "failed to update expense")
		return
	}

	respondWithJSON(w, http.StatusOK, expense)
}

// DeleteExpense handles DELETE /expenses/{id}
func (h *ExpenseHandler) DeleteExpense(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if id == "" {
		respondWithError(w, http.StatusBadRequest, "missing expense ID")
		return
	}

	err := h.service.Delete(r.Context(), id)
	if err != nil {
		if errors.Is(err, repository.ErrNotFound) {
			respondWithError(w, http.StatusNotFound, "expense not found")
			return
		}
		var valErr service.ValidationError
		if errors.As(err, &valErr) {
			respondWithValidationError(w, valErr)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "failed to delete expense")
		return
	}

	respondWithJSON(w, http.StatusNoContent, nil)
}

// ListExpenses handles GET /expenses
func (h *ExpenseHandler) ListExpenses(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	category := q.Get("category")
	startDate := q.Get("start_date")
	endDate := q.Get("end_date")

	limit := 50
	if lStr := q.Get("limit"); lStr != "" {
		if l, err := strconv.Atoi(lStr); err == nil {
			if l > 0 && l <= 1000 {
				limit = l
			}
		}
	}

	offset := 0
	if oStr := q.Get("offset"); oStr != "" {
		if o, err := strconv.Atoi(oStr); err == nil {
			if o >= 0 {
				offset = o
			}
		}
	}

	filter := repository.Filter{
		Category:  category,
		StartDate: startDate,
		EndDate:   endDate,
		Limit:     limit,
		Offset:    offset,
	}

	expenses, err := h.service.List(r.Context(), filter)
	if err != nil {
		var valErr service.ValidationError
		if errors.As(err, &valErr) {
			respondWithValidationError(w, valErr)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "failed to query expenses")
		return
	}

	// Ensure we return empty array instead of null in JSON response if slice is nil
	if expenses == nil {
		expenses = []model.Expense{}
	}

	respondWithJSON(w, http.StatusOK, expenses)
}

// GetSummary handles GET /expenses/summary
func (h *ExpenseHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	startDate := q.Get("start_date")
	endDate := q.Get("end_date")

	summary, err := h.service.GetSummary(r.Context(), startDate, endDate)
	if err != nil {
		var valErr service.ValidationError
		if errors.As(err, &valErr) {
			respondWithValidationError(w, valErr)
			return
		}
		respondWithError(w, http.StatusInternalServerError, "failed to aggregate spending summary")
		return
	}

	respondWithJSON(w, http.StatusOK, summary)
}
