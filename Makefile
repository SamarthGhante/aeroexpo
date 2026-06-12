.PHONY: build run test clean

GO_BIN = ./.go/bin/go
BINARY_NAME = server

build:
	$(GO_BIN) build -o $(BINARY_NAME) ./cmd/server

run: build
	PORT=8080 DB_PATH=expenses.db ./$(BINARY_NAME)

test:
	$(GO_BIN) test -v ./...

clean:
	rm -f $(BINARY_NAME) test_service.db test_handler.db expenses.db expenses.db-shm expenses.db-wal
