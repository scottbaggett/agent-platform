.PHONY: help up down build logs restart clean db-shell backend-shell frontend-shell health ps

# Default target
help:
	@echo "🐳 Agent Platform Docker Commands"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  up              - Start all containers in detached mode"
	@echo "  down            - Stop and remove all containers"
	@echo "  build           - Build or rebuild all containers"
	@echo "  logs            - View logs from all containers (Ctrl+C to exit)"
	@echo "  logs-backend    - View backend logs only"
	@echo "  logs-frontend   - View frontend logs only"
	@echo "  logs-db         - View database logs only"
	@echo "  restart         - Restart all containers"
	@echo "  clean           - Remove all containers, volumes, and images"
	@echo "  ps              - Show running containers"
	@echo "  health          - Check health status of all services"
	@echo ""
	@echo "Shell Access:"
	@echo "  db-shell        - Open PostgreSQL shell"
	@echo "  backend-shell   - Open bash shell in backend container"
	@echo "  frontend-shell  - Open sh shell in frontend container"
	@echo ""
	@echo "Development:"
	@echo "  dev             - Start all services with live reload"
	@echo "  rebuild         - Full rebuild (clean + build + up)"

# Start all containers in detached mode
up:
	@echo "🚀 Starting Agent Platform containers..."
	docker compose up -d

# Stop and remove all containers
down:
	@echo "🛑 Stopping Agent Platform containers..."
	docker compose down

# Build or rebuild all containers
build:
	@echo "🔨 Building containers..."
	docker compose build

# View logs from all containers
logs:
	@echo "📋 Showing logs (Ctrl+C to exit)..."
	docker compose logs -f

# View backend logs only
logs-backend:
	@echo "📋 Backend logs (Ctrl+C to exit)..."
	docker compose logs -f backend

# View frontend logs only
logs-frontend:
	@echo "📋 Frontend logs (Ctrl+C to exit)..."
	docker compose logs -f frontend

# View database logs only
logs-db:
	@echo "📋 Database logs (Ctrl+C to exit)..."
	docker compose logs -f db

# Restart all containers
restart:
	@echo "🔄 Restarting containers..."
	docker compose restart

# Remove everything (containers, volumes, images)
clean:
	@echo "🧹 Cleaning up all Docker resources..."
	docker compose down -v --rmi local
	@echo "✅ Clean complete"

# Show running containers
ps:
	@echo "📦 Running containers:"
	docker compose ps

# Check health status
health:
	@echo "🏥 Checking service health..."
	@echo "\n📊 Database:"
	@docker compose exec db pg_isready -U agent -d agent_platform || echo "❌ Database not ready"
	@echo "\n🔧 Backend API:"
	@curl -s http://localhost:8001/healthz | python3 -m json.tool || echo "❌ Backend not responding"
	@echo "\n🎨 Frontend:"
	@curl -s -o /dev/null -w "Status: %{http_code}\n" http://localhost:3000 || echo "❌ Frontend not responding"

# Open PostgreSQL shell
db-shell:
	@echo "🗄️  Opening PostgreSQL shell..."
	docker compose exec db psql -U agent -d agent_platform

# Open backend shell
backend-shell:
	@echo "🐍 Opening backend shell..."
	docker compose exec backend /bin/bash

# Open frontend shell
frontend-shell:
	@echo "⚛️  Opening frontend shell..."
	docker compose exec frontend /bin/sh

# Start in development mode (same as up, but explicit)
dev: up
	@echo "✅ Development environment started"
	@echo "📍 Frontend: http://localhost:3000"
	@echo "📍 Backend: http://localhost:8001"
	@echo "📍 API Docs: http://localhost:8001/docs"
	@echo "\nRun 'make logs' to view logs"

# Full rebuild
rebuild: clean build up
	@echo "✅ Full rebuild complete"
