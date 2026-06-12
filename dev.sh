#!/bin/bash
# High-performance dev runner for backend and frontend

# Terminate background jobs on exit
trap 'kill $(jobs -p)' EXIT

echo "==== BUILDING GO BACKEND ===="
./.go/bin/go build -o server ./cmd/server

echo "==== STARTING GO BACKEND ON PORT 8080 ===="
PORT=8080 DB_PATH=expenses.db ./server &

# Wait a brief moment for backend port mapping
sleep 1.5

echo "==== STARTING VITE DEV SERVER ===="
cd web
npm run dev

# Wait for all processes
wait
