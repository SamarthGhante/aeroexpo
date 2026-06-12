package repository

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"aeroexpo/internal/db"
	"aeroexpo/internal/model"
)

// Filter specifies criteria for listing expenses.
type Filter struct {
	Category  string
	StartDate string // YYYY-MM-DD
	EndDate   string // YYYY-MM-DD
	Limit     int
	Offset    int
}

// ExpenseRepository defines the datastore operations for expenses.
type ExpenseRepository interface {
	Create(ctx context.Context, expense *model.Expense) error
	GetByID(ctx context.Context, id string) (*model.Expense, error)
	Update(ctx context.Context, expense *model.Expense) error
	Delete(ctx context.Context, id string) error
	List(ctx context.Context, filter Filter) ([]model.Expense, error)
	GetSummary(ctx context.Context, startDate, endDate string) (map[string]int64, int64, error)
}

// SQLiteExpenseRepository implements ExpenseRepository using SQLite.
type SQLiteExpenseRepository struct {
	db *db.DB
}

// NewSQLiteExpenseRepository creates a new SQLiteExpenseRepository.
func NewSQLiteExpenseRepository(database *db.DB) *SQLiteExpenseRepository {
	return &SQLiteExpenseRepository{db: database}
}

// ErrNotFound is returned when an expense is not found.
var ErrNotFound = errors.New("expense not found")

// Create inserts a new expense into the database.
func (r *SQLiteExpenseRepository) Create(ctx context.Context, expense *model.Expense) error {
	now := time.Now().UTC()
	expense.CreatedAt = now
	expense.UpdatedAt = now

	query := `
	INSERT INTO expenses (id, title, amount, category, date, created_at, updated_at)
	VALUES (?, ?, ?, ?, ?, ?, ?)
	`

	_, err := r.db.ExecContext(
		ctx,
		query,
		expense.ID,
		expense.Title,
		expense.Amount,
		expense.Category,
		expense.Date,
		expense.CreatedAt.Format(time.RFC3339),
		expense.UpdatedAt.Format(time.RFC3339),
	)
	if err != nil {
		return fmt.Errorf("failed to create expense: %w", err)
	}

	return nil
}

// GetByID retrieves a single expense by its ID.
func (r *SQLiteExpenseRepository) GetByID(ctx context.Context, id string) (*model.Expense, error) {
	query := `
	SELECT id, title, amount, category, date, created_at, updated_at
	FROM expenses
	WHERE id = ?
	`

	var exp model.Expense
	var createdAtStr, updatedAtStr string

	err := r.db.QueryRowContext(ctx, query, id).Scan(
		&exp.ID,
		&exp.Title,
		&exp.Amount,
		&exp.Category,
		&exp.Date,
		&createdAtStr,
		&updatedAtStr,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	} else if err != nil {
		return nil, fmt.Errorf("failed to get expense: %w", err)
	}

	// Parse timestamps
	createdAt, err := time.Parse(time.RFC3339, createdAtStr)
	if err != nil {
		// Fallback for default CURRENT_TIMESTAMP format "2006-01-02 15:04:05" if populated directly by SQLite
		createdAt, err = time.Parse("2006-01-02 15:04:05", createdAtStr)
		if err != nil {
			return nil, fmt.Errorf("failed to parse created_at: %w", err)
		}
	}
	exp.CreatedAt = createdAt

	updatedAt, err := time.Parse(time.RFC3339, updatedAtStr)
	if err != nil {
		updatedAt, err = time.Parse("2006-01-02 15:04:05", updatedAtStr)
		if err != nil {
			return nil, fmt.Errorf("failed to parse updated_at: %w", err)
		}
	}
	exp.UpdatedAt = updatedAt

	return &exp, nil
}

// Update modifies an existing expense.
func (r *SQLiteExpenseRepository) Update(ctx context.Context, expense *model.Expense) error {
	expense.UpdatedAt = time.Now().UTC()

	query := `
	UPDATE expenses
	SET title = ?, amount = ?, category = ?, date = ?, updated_at = ?
	WHERE id = ?
	`

	res, err := r.db.ExecContext(
		ctx,
		query,
		expense.Title,
		expense.Amount,
		expense.Category,
		expense.Date,
		expense.UpdatedAt.Format(time.RFC3339),
		expense.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update expense: %w", err)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}

// Delete removes an expense by its ID.
func (r *SQLiteExpenseRepository) Delete(ctx context.Context, id string) error {
	query := "DELETE FROM expenses WHERE id = ?"

	res, err := r.db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete expense: %w", err)
	}

	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to check rows affected: %w", err)
	}

	if rowsAffected == 0 {
		return ErrNotFound
	}

	return nil
}

// List queries expenses based on filters.
func (r *SQLiteExpenseRepository) List(ctx context.Context, filter Filter) ([]model.Expense, error) {
	query := "SELECT id, title, amount, category, date, created_at, updated_at FROM expenses WHERE 1=1"
	var args []interface{}

	if filter.Category != "" {
		query += " AND category = ?"
		args = append(args, filter.Category)
	}
	if filter.StartDate != "" {
		query += " AND date >= ?"
		args = append(args, filter.StartDate)
	}
	if filter.EndDate != "" {
		query += " AND date <= ?"
		args = append(args, filter.EndDate)
	}

	query += " ORDER BY date DESC, created_at DESC"

	if filter.Limit > 0 {
		query += " LIMIT ?"
		args = append(args, filter.Limit)
	}
	if filter.Offset > 0 {
		query += " OFFSET ?"
		args = append(args, filter.Offset)
	}

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query expenses: %w", err)
	}
	defer rows.Close()

	var expenses []model.Expense
	for rows.Next() {
		var exp model.Expense
		var createdAtStr, updatedAtStr string
		err := rows.Scan(
			&exp.ID,
			&exp.Title,
			&exp.Amount,
			&exp.Category,
			&exp.Date,
			&createdAtStr,
			&updatedAtStr,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan expense row: %w", err)
		}

		// Parse timestamps
		createdAt, err := time.Parse(time.RFC3339, createdAtStr)
		if err != nil {
			createdAt, _ = time.Parse("2006-01-02 15:04:05", createdAtStr)
		}
		exp.CreatedAt = createdAt

		updatedAt, err := time.Parse(time.RFC3339, updatedAtStr)
		if err != nil {
			updatedAt, _ = time.Parse("2006-01-02 15:04:05", updatedAtStr)
		}
		exp.UpdatedAt = updatedAt

		expenses = append(expenses, exp)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("rows error: %w", err)
	}

	return expenses, nil
}

// GetSummary returns total spending grouped by category and overall total within a date range.
func (r *SQLiteExpenseRepository) GetSummary(ctx context.Context, startDate, endDate string) (map[string]int64, int64, error) {
	query := "SELECT category, SUM(amount) FROM expenses WHERE 1=1"
	var args []interface{}

	if startDate != "" {
		query += " AND date >= ?"
		args = append(args, startDate)
	}
	if endDate != "" {
		query += " AND date <= ?"
		args = append(args, endDate)
	}

	query += " GROUP BY category"

	rows, err := r.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query summary: %w", err)
	}
	defer rows.Close()

	summary := make(map[string]int64)
	var total int64

	for rows.Next() {
		var category string
		var amount int64
		if err := rows.Scan(&category, &amount); err != nil {
			return nil, 0, fmt.Errorf("failed to scan summary row: %w", err)
		}
		summary[category] = amount
		total += amount
	}

	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("rows error: %w", err)
	}

	return summary, total, nil
}
