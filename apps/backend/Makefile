.PHONY: help install install-dev run lint format typecheck check fix clean

help:
	@echo "Available commands:"
	@echo "  make install      - Install production dependencies"
	@echo "  make install-dev  - Install dev dependencies (includes ruff, mypy)"
	@echo "  make run          - Run the server"
	@echo "  make lint         - Run ruff linter"
	@echo "  make format       - Format code with ruff"
	@echo "  make typecheck    - Run mypy type checker"
	@echo "  make check        - Run all checks (lint + format check + typecheck)"
	@echo "  make fix          - Auto-fix linting issues and format code"
	@echo "  make clean        - Remove cache files"

install:
	pip install -r requirements.txt

install-dev:
	pip install -r requirements-dev.txt

run:
	python main.py

lint:
	ruff check .

format:
	ruff format .

typecheck:
	mypy .

check:
	@echo "Running ruff linter..."
	@ruff check .
	@echo "\nChecking code formatting..."
	@ruff format --check .
	@echo "\nRunning mypy type checker..."
	@mypy .
	@echo "\n✅ All checks passed!"

fix:
	@echo "Auto-fixing linting issues..."
	@ruff check --fix .
	@echo "\nFormatting code..."
	@ruff format .
	@echo "\n✅ Code fixed and formatted!"

clean:
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type d -name "*.egg-info" -exec rm -rf {} +
	find . -type d -name ".mypy_cache" -exec rm -rf {} +
	find . -type d -name ".ruff_cache" -exec rm -rf {} +
