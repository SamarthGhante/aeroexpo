#!/bin/bash
set -e

echo "Building server..."
./.go/bin/go build -o server ./cmd/server

echo "Starting server on port 8080 (SQLite WAL mode: expenses.db)..."
PORT=8080 DB_PATH=expenses.db ./server
