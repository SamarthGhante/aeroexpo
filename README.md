# Expense Logger API Backend

A superfast, lightweight, 100% reliable, and highly scalable Expense Logger REST API backend built in Go.

---

## Technical Highlights

- **Pure Go Toolchain**: Zero system library dependencies. Utilizes a pure Go SQLite compiler (`modernc.org/sqlite`) that compiled successfully without CGO.
- **SQLite with WAL Mode**: Enables concurrent read operations, reduces lock contention, and improves database write speeds significantly. Formatted with performance pragmas (`foreign_keys=1`, `journal_mode=WAL`, `busy_timeout=5000`, `synchronous=NORMAL`) for maximum speed and durability.
- **Integer Cents Representation**: Amounts are stored as `int64` representing cents (e.g., `$10.50` is stored as `1050`) to avoid floating-point rounding errors and ensure 100% financial precision.
- **Clean Architecture & Separation of Concerns**: Separated into domain models (`internal/model`), SQLite queries (`internal/repository`), validations & business logic (`internal/service`), HTTP routing & controllers (`internal/handler`), and migrations (`internal/db`).
- **Go 1.22+ Standard Routing**: Built completely dependency-free using the native Go standard library `http.ServeMux` which supports HTTP methods (e.g. `GET`, `POST`) and path parameter extraction (e.g. `{id}`).
- **Graceful Shutdown**: Automatically catches operating system terminate signals (`SIGINT`, `SIGTERM`), halts incoming connections, and gracefully finishes in-flight requests.
- **Reliable Middleware Stack**:
  - **Structured Logging**: Logs request duration, client IP, route, HTTP method, and response status code.
  - **Recovery**: Catches panic calls gracefully, logs stack traces, and returns standard HTTP `500` JSON errors to avoid server crash.

---

## Directory Structure

```text
.
├── cmd
│   └── server
│       └── main.go         # Application entrypoint & graceful shutdown setup
├── internal
│   ├── db
│   │   └── db.go           # SQLite database configuration & WAL migrations
│   ├── handler
│   │   ├── expense_handler.go # API handlers (JSON encoders, controllers)
│   │   └── middleware.go      # Request logging & panic recovery middlewares
│   ├── model
│   │   └── expense.go      # Expense & Summary structs
│   ├── repository
│   │   └── expense_repository.go # SQLite SQL executions, dynamic filtering
│   └── service
│       └── expense_service.go    # Validations & business logic orchestration
├── run.sh                  # Build & Run shortcut
└── test.sh                 # Test execution shortcut
```

---

## Getting Started

### 1. Running the API
Execute the pre-configured runner script. This will compile the binary to `./server` and start it on port `8080`:
```bash
./run.sh
```

To configure custom ports or database files, override the environment variables:
```bash
PORT=9090 DB_PATH=/tmp/my_expenses.db ./run.sh
```

### 2. Running Tests
Run the entire unit and integration test suite (fully verified against a clean SQLite test database wrapper):
```bash
./test.sh
```

---

## API Reference

All requests and responses use **JSON** format.

### 1. Create Expense
- **Endpoint**: `POST /expenses`
- **Body**:
  ```json
  {
    "title": "Office Desk",
    "amount": 14999,
    "category": "Furniture",
    "date": "2026-06-12"
  }
  ```
  *(Note: `amount` must be a positive integer in cents. `$149.99` is represented as `14999`)*
- **Response**: `201 Created`
  ```json
  {
    "id": "e4414f08-bdf7-40d9-b2ee-1ff9f0be896f",
    "title": "Office Desk",
    "amount": 14999,
    "category": "Furniture",
    "date": "2026-06-12",
    "created_at": "2026-06-12T17:01:22Z",
    "updated_at": "2026-06-12T17:01:22Z"
  }
  ```

### 2. List Expenses
- **Endpoint**: `GET /expenses`
- **Query Parameters (Optional)**:
  - `category` (string) - Filter by exact category
  - `start_date` (string, YYYY-MM-DD) - Filter starting from date
  - `end_date` (string, YYYY-MM-DD) - Filter up to date
  - `limit` (int, default: 50, max: 1000) - Pagination size
  - `offset` (int, default: 0) - Pagination page offset
- **Response**: `200 OK`
  ```json
  [
    {
      "id": "e4414f08-bdf7-40d9-b2ee-1ff9f0be896f",
      "title": "Office Desk",
      "amount": 14999,
      "category": "Furniture",
      "date": "2026-06-12",
      "created_at": "2026-06-12T17:01:22Z",
      "updated_at": "2026-06-12T17:01:22Z"
    }
  ]
  ```

### 3. Get Expense by ID
- **Endpoint**: `GET /expenses/{id}`
- **Response**: `200 OK`
  ```json
  {
    "id": "e4414f08-bdf7-40d9-b2ee-1ff9f0be896f",
    "title": "Office Desk",
    "amount": 14999,
    "category": "Furniture",
    "date": "2026-06-12",
    "created_at": "2026-06-12T17:01:22Z",
    "updated_at": "2026-06-12T17:01:22Z"
  }
  ```

### 4. Update Expense
- **Endpoint**: `PUT /expenses/{id}`
- **Body**:
  ```json
  {
    "title": "Premium Office Desk",
    "amount": 15999,
    "category": "Furniture",
    "date": "2026-06-12"
  }
  ```
- **Response**: `200 OK`
  ```json
  {
    "id": "e4414f08-bdf7-40d9-b2ee-1ff9f0be896f",
    "title": "Premium Office Desk",
    "amount": 15999,
    "category": "Furniture",
    "date": "2026-06-12",
    "created_at": "2026-06-12T17:01:22Z",
    "updated_at": "2026-06-12T17:07:05Z"
  }
  ```

### 5. Delete Expense
- **Endpoint**: `DELETE /expenses/{id}`
- **Response**: `204 No Content`

### 6. Get Spending Summary
- **Endpoint**: `GET /expenses/summary`
- **Query Parameters (Optional)**:
  - `start_date` (string, YYYY-MM-DD) - Filter summary start date
  - `end_date` (string, YYYY-MM-DD) - Filter summary end date
- **Response**: `200 OK`
  ```json
  {
    "total_spent": 15999,
    "category_breakdown": {
      "Furniture": 15999
    },
    "start_date": "2026-06-01",
    "end_date": "2026-06-30"
  }
  ```

---

## Validation Errors

When validation fails (such as passing negative amounts, malformed dates, or empty titles), the API returns a structured `400 Bad Request` payload detailing the failing field:

```json
{
  "error": "invalid amount: must be a positive integer greater than 0 cents",
  "field": "amount"
}
```
