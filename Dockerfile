# ==========================================
# [PATCH / TEMPORARY IMPLEMENTATION]
# Dockerfile to host Go backend and React frontend
# concurrently inside a single container.
# ==========================================

# --- Stage 1: Build the React Frontend ---
FROM node:20-alpine AS frontend-builder
WORKDIR /app/web

# Copy package descriptors and install dependencies
COPY web/package*.json ./
RUN npm ci

# Copy frontend source files and compile static production build
COPY web/ ./
RUN npm run build

# --- Stage 2: Build the Go Backend ---
FROM golang:1.25-alpine AS backend-builder
WORKDIR /app

# Install compilation tools (if any pure C bindings existed, but we compile CGO-free modernc)
RUN apk add --no-cache git

# Copy dependency graphs and download Go modules
COPY go.mod go.sum ./
RUN go mod download

# Copy backend source code
COPY cmd/ ./cmd/
COPY internal/ ./internal/

# Build static, CGO-disabled binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o server ./cmd/server

# --- Stage 3: Final Production Container ---
FROM alpine:3.19
WORKDIR /app

# Install CA certificates for secure web requests and timezone data
RUN apk add --no-cache ca-certificates tzdata

# Create data directory to store persistent SQLite database
RUN mkdir -p /app/data && chmod 777 /app/data

# Copy built binary from Go builder stage
COPY --from=backend-builder /app/server /app/server

# Copy compiled static frontend distribution files from Node builder stage
COPY --from=frontend-builder /app/web/dist /app/web/dist

# Set runtime environment parameters
ENV PORT=8080
ENV DB_PATH=/app/data/expenses.db
ENV STATIC_DIR=/app/web/dist

# Expose port
EXPOSE 8080

# Execute server
CMD ["/app/server"]
