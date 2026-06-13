package model

import "time"

// Expense represents an expense record in the system.
type Expense struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Amount    int64     `json:"amount"` // Stored in cents (e.g. $10.50 -> 1050)
	Category  string    `json:"category"`
	Date      string    `json:"date"` // YYYY-MM-DD
	Notes     string    `json:"notes"` // Optional notes
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Summary holds aggregated spending info for a range.
type Summary struct {
	TotalSpent        int64            `json:"total_spent"`        // in cents
	CategoryBreakdown map[string]int64 `json:"category_breakdown"` // category -> amount in cents
	StartDate         string           `json:"start_date,omitempty"`
	EndDate           string           `json:"end_date,omitempty"`
}

