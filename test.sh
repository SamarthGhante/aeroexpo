#!/bin/bash
set -e

echo "Running unit and integration tests..."
./.go/bin/go test -v ./...
