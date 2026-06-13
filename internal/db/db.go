package db

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

// DB represents a wrapper around *sql.DB
type DB struct {
	*sql.DB
}

// NewDB initializes a new SQLite connection with performance-tuning pragmas.
func NewDB(dbPath string) (*DB, error) {
	// Enable WAL mode, Normal sync (safe with WAL), Foreign Keys, and a 5-second busy timeout
	dsn := fmt.Sprintf("%s?_pragma=foreign_keys(1)&_pragma=journal_mode(WAL)&_pragma=busy_timeout(5000)&_pragma=synchronous(NORMAL)", dbPath)

	conn, err := sql.Open("sqlite", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	// SQLite operates best when max open connections is limited.
	// WAL mode allows concurrent reads, but writes are serialized.
	// A max of 1 open connection is safe for standard SQLite, but with busy_timeout set,
	// we can allow slightly more if needed, though 1 is safest to completely avoid lock contention.
	// For superfast lightweight applications, keeping a single connection is extremely reliable and performant.
	conn.SetMaxOpenConns(1)
	conn.SetMaxIdleConns(1)
	conn.SetConnMaxLifetime(time.Hour)

	if err := conn.Ping(); err != nil {
		conn.Close()
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	return &DB{conn}, nil
}

// RunMigrations executes SQL schema setup.
func (db *DB) RunMigrations() error {
	schema := `
	CREATE TABLE IF NOT EXISTS expenses (
		id TEXT PRIMARY KEY,
		title TEXT NOT NULL,
		amount INTEGER NOT NULL, -- in cents
		category TEXT NOT NULL,
		date TEXT NOT NULL,      -- YYYY-MM-DD
		notes TEXT DEFAULT '',   -- optional notes
		created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
		updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
	);

	CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category);
	CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
	`

	_, err := db.Exec(schema)
	if err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	// Safety migration: check if 'notes' column exists in case the database was already created
	rows, err := db.Query("PRAGMA table_info(expenses)")
	if err == nil {
		defer rows.Close()
		hasNotes := false
		for rows.Next() {
			var cid int
			var name, ctype string
			var notnull, pk int
			var dfltVal interface{}
			if err := rows.Scan(&cid, &name, &ctype, &notnull, &dfltVal, &pk); err == nil {
				if name == "notes" {
					hasNotes = true
					break
				}
			}
		}
		if !hasNotes {
			_, _ = db.Exec("ALTER TABLE expenses ADD COLUMN notes TEXT DEFAULT ''")
		}
	}

	return nil
}
