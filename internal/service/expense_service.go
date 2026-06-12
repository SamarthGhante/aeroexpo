package service

import (
	"context"
	"fmt"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/google/uuid"
	"aeroexpo/internal/model"
	"aeroexpo/internal/repository"
)

// ValidationError represents an input validation error.
type ValidationError struct {
	Field   string
	Message string
}

func (e ValidationError) Error() string {
	return fmt.Sprintf("invalid %s: %s", e.Field, e.Message)
}

// Request payloads
type CreateExpenseRequest struct {
	Title    string `json:"title"`
	Amount   int64  `json:"amount"` // in cents
	Category string `json:"category"`
	Date     string `json:"date"` // YYYY-MM-DD
}

type UpdateExpenseRequest struct {
	Title    string `json:"title"`
	Amount   int64  `json:"amount"` // in cents
	Category string `json:"category"`
	Date     string `json:"date"` // YYYY-MM-DD
}

// ExpenseService defines the business logic methods.
type ExpenseService interface {
	Create(ctx context.Context, req CreateExpenseRequest) (*model.Expense, error)
	Get(ctx context.Context, id string) (*model.Expense, error)
	Update(ctx context.Context, id string, req UpdateExpenseRequest) (*model.Expense, error)
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, filter repository.Filter) ([]model.Expense, error)
	GetSummary(ctx context.Context, startDate, endDate string) (*model.Summary, error)
}

type DefaultExpenseService struct {
	repo repository.ExpenseRepository
}

func NewDefaultExpenseService(repo repository.ExpenseRepository) *DefaultExpenseService {
	return &DefaultExpenseService{repo: repo}
}

// Validation helpers
func validateTitle(title string) error {
	trimmed := strings.TrimSpace(title)
	if trimmed == "" {
		return ValidationError{Field: "title", Message: "cannot be empty"}
	}
	if !utf8.ValidString(trimmed) {
		return ValidationError{Field: "title", Message: "must be a valid UTF-8 string"}
	}
	if len(trimmed) > 100 {
		return ValidationError{Field: "title", Message: "cannot exceed 100 characters"}
	}
	return nil
}

func validateAmount(amount int64) error {
	if amount <= 0 {
		return ValidationError{Field: "amount", Message: "must be a positive integer greater than 0 cents"}
	}
	return nil
}

func validateCategory(category string) error {
	trimmed := strings.TrimSpace(category)
	if trimmed == "" {
		return ValidationError{Field: "category", Message: "cannot be empty"}
	}
	if !utf8.ValidString(trimmed) {
		return ValidationError{Field: "category", Message: "must be a valid UTF-8 string"}
	}
	if len(trimmed) > 50 {
		return ValidationError{Field: "category", Message: "cannot exceed 50 characters"}
	}
	return nil
}

func validateDate(dateStr string) error {
	trimmed := strings.TrimSpace(dateStr)
	if trimmed == "" {
		return ValidationError{Field: "date", Message: "cannot be empty"}
	}
	if _, err := time.Parse("2006-01-02", trimmed); err != nil {
		return ValidationError{Field: "date", Message: "must be in YYYY-MM-DD format (e.g. 2026-06-12)"}
	}
	return nil
}

func validateOptionalDate(dateStr string, fieldName string) error {
	trimmed := strings.TrimSpace(dateStr)
	if trimmed == "" {
		return nil
	}
	if _, err := time.Parse("2006-01-02", trimmed); err != nil {
		return ValidationError{Field: fieldName, Message: "must be in YYYY-MM-DD format (e.g. 2026-06-12)"}
	}
	return nil
}

func (s *DefaultExpenseService) Create(ctx context.Context, req CreateExpenseRequest) (*model.Expense, error) {
	if err := validateTitle(req.Title); err != nil {
		return nil, err
	}
	if err := validateAmount(req.Amount); err != nil {
		return nil, err
	}
	if err := validateCategory(req.Category); err != nil {
		return nil, err
	}
	if err := validateDate(req.Date); err != nil {
		return nil, err
	}

	expense := &model.Expense{
		ID:       uuid.NewString(),
		Title:    strings.TrimSpace(req.Title),
		Amount:   req.Amount,
		Category: strings.TrimSpace(req.Category),
		Date:     strings.TrimSpace(req.Date),
	}

	if err := s.repo.Create(ctx, expense); err != nil {
		return nil, err
	}

	return expense, nil
}

func (s *DefaultExpenseService) Get(ctx context.Context, id string) (*model.Expense, error) {
	if strings.TrimSpace(id) == "" {
		return nil, ValidationError{Field: "id", Message: "cannot be empty"}
	}
	return s.repo.GetByID(ctx, id)
}

func (s *DefaultExpenseService) Update(ctx context.Context, id string, req UpdateExpenseRequest) (*model.Expense, error) {
	if strings.TrimSpace(id) == "" {
		return nil, ValidationError{Field: "id", Message: "cannot be empty"}
	}
	if err := validateTitle(req.Title); err != nil {
		return nil, err
	}
	if err := validateAmount(req.Amount); err != nil {
		return nil, err
	}
	if err := validateCategory(req.Category); err != nil {
		return nil, err
	}
	if err := validateDate(req.Date); err != nil {
		return nil, err
	}

	// Verify existence first
	expense, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, err
	}

	expense.Title = strings.TrimSpace(req.Title)
	expense.Amount = req.Amount
	expense.Category = strings.TrimSpace(req.Category)
	expense.Date = strings.TrimSpace(req.Date)

	if err := s.repo.Update(ctx, expense); err != nil {
		return nil, err
	}

	return expense, nil
}

func (s *DefaultExpenseService) Delete(ctx context.Context, id string) error {
	if strings.TrimSpace(id) == "" {
		return ValidationError{Field: "id", Message: "cannot be empty"}
	}
	return s.repo.Delete(ctx, id)
}

func (s *DefaultExpenseService) List(ctx context.Context, filter repository.Filter) ([]model.Expense, error) {
	if err := validateOptionalDate(filter.StartDate, "start_date"); err != nil {
		return nil, err
	}
	if err := validateOptionalDate(filter.EndDate, "end_date"); err != nil {
		return nil, err
	}

	return s.repo.List(ctx, filter)
}

func (s *DefaultExpenseService) GetSummary(ctx context.Context, startDate, endDate string) (*model.Summary, error) {
	if err := validateOptionalDate(startDate, "start_date"); err != nil {
		return nil, err
	}
	if err := validateOptionalDate(endDate, "end_date"); err != nil {
		return nil, err
	}

	breakdown, total, err := s.repo.GetSummary(ctx, startDate, endDate)
	if err != nil {
		return nil, err
	}

	return &model.Summary{
		TotalSpent:        total,
		CategoryBreakdown: breakdown,
		StartDate:         startDate,
		EndDate:           endDate,
	}, nil
}
