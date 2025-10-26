# Docker Setup Guide

## Quick Start

### Prerequisites
- Docker Desktop (with Docker Compose v2.30+)
- 4GB+ RAM allocated to Docker

### 1. Configure Environment
```bash
# Edit .env.docker and add your API keys
cp .env.docker .env.docker.local  # Optional: for local overrides
```

Update these values in `.env.docker`:
```env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...
```

### 2. Start Everything
```bash
make dev
# Or directly: docker compose up -d
```

This will:
- Build all containers (first time only, ~2-5 min)
- Start PostgreSQL database
- Start FastAPI backend on port 8001
- Start Vite frontend on port 3000
- Run database migrations

### 3. Verify It's Working
```bash
make health
```

You should see:
- ✅ Database: Ready
- ✅ Backend: Healthy
- ✅ Frontend: Running

### Access Points
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8001
- **API Docs**: http://localhost:8001/docs
- **Database**: localhost:5432 (user: agent, db: agent_platform)

---

## Makefile Commands

| Command | Description |
|---------|-------------|
| `make dev` | Start all services (same as `make up`) |
| `make up` | Start containers in background |
| `make down` | Stop all containers |
| `make logs` | View logs from all services |
| `make logs-backend` | View backend logs only |
| `make logs-frontend` | View frontend logs only |
| `make logs-db` | View database logs only |
| `make restart` | Restart all containers |
| `make build` | Rebuild containers |
| `make rebuild` | Clean + rebuild + start |
| `make clean` | Remove all containers and volumes |
| `make ps` | Show running containers |
| `make health` | Check health status of services |

### Shell Access
| Command | Description |
|---------|-------------|
| `make db-shell` | Open PostgreSQL shell |
| `make backend-shell` | Open bash in backend container |
| `make frontend-shell` | Open sh in frontend container |

---

## Development Workflow

### Hot Reload
Both frontend and backend support hot reload:
- **Frontend**: Vite watches for file changes (may be slightly slower on macOS/WSL due to volume mounts)
- **Backend**: Uvicorn auto-reloads on Python file changes

### Viewing Logs
```bash
# All services
make logs

# Specific service
make logs-backend
make logs-frontend
make logs-db

# Docker compose directly
docker compose logs -f backend
```

### Database Access
```bash
# Open psql shell
make db-shell

# Or with docker directly
docker compose exec db psql -U agent -d agent_platform

# Example queries
SELECT * FROM workflows;
SELECT * FROM workflow_runs;
SELECT * FROM node_executions;
```

### Backend Shell (for debugging)
```bash
make backend-shell

# Inside container:
python
>>> from db import get_db, Workflow
>>> # Interactive debugging
```

---

## Architecture

```
┌─────────────────┐
│   Frontend      │  Port 3000
│   (Vite)        │  React + TanStack
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Backend       │  Port 8001
│   (FastAPI)     │  Python + SQLAlchemy
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   Database      │  Port 5432
│   (PostgreSQL)  │  Postgres 16
└─────────────────┘
```

### Services

#### Database (`db`)
- **Image**: postgres:16-alpine
- **Port**: 5432
- **Volume**: `postgres_data` (persists data)
- **Init**: Runs `apps/backend/db/init.sql` on first start

#### Backend (`backend`)
- **Build**: `apps/backend/Dockerfile`
- **Port**: 8001
- **Volumes**:
  - `./apps/backend:/app` (code hot reload)
  - `backend_cache:/app/.ruff_cache` (persist cache)
- **Health**: `/healthz` endpoint

#### Frontend (`frontend`)
- **Build**: `apps/frontend/Dockerfile`
- **Port**: 3000
- **Volumes**:
  - `./apps/frontend:/app` (code hot reload)
  - `frontend_node_modules:/app/node_modules` (faster installs)

---

## Troubleshooting

### Port Already in Use
```bash
# Check what's using the port
lsof -i :3000
lsof -i :8001
lsof -i :5432

# Stop the conflicting process or change ports in docker-compose.yml
```

### Database Connection Errors
```bash
# Check database is healthy
docker compose ps db
make health

# View database logs
make logs-db

# Restart database
docker compose restart db
```

### Frontend Not Hot Reloading
This is expected on macOS/Windows due to Docker volume mount performance. Options:
1. **Accept 1-2s delay** (polling is enabled in vite.config.ts)
2. **Run frontend natively**:
   ```bash
   # Stop frontend container
   docker compose stop frontend

   # Run natively
   cd apps/frontend
   pnpm install
   pnpm run dev
   ```

### Backend Import Errors
```bash
# Rebuild backend container
docker compose build backend
docker compose restart backend

# Or rebuild everything
make rebuild
```

### Clean Slate Reset
```bash
# Nuclear option: remove everything
make clean

# Restart
make dev
```

### Database Won't Initialize
```bash
# Remove volume and restart
docker compose down -v
docker compose up -d

# Check init.sql is mounted
docker compose exec db ls -la /docker-entrypoint-initdb.d/
```

---

## Production Considerations

This setup is **development-only**. For production:

1. **Remove hot reload**:
   - Frontend: Build static files, serve with Nginx
   - Backend: Remove `--reload` flag

2. **Use production WSGI server**:
   ```dockerfile
   CMD ["gunicorn", "main:app", "-k", "uvicorn.workers.UvicornWorker"]
   ```

3. **Environment variables**:
   - Use secrets management (not `.env.docker`)
   - Don't commit API keys

4. **Database**:
   - Use managed Postgres (AWS RDS, etc.)
   - Set up backups and replicas
   - Use Alembic for migrations

5. **Volumes**:
   - Remove bind mounts (`:delegated`)
   - Copy code into containers

6. **Health checks**:
   - Add liveness/readiness probes for Kubernetes
   - Monitor with Prometheus/Grafana

---

## Next Steps

- [ ] Add your API keys to `.env.docker`
- [ ] Run `make dev` to start everything
- [ ] Visit http://localhost:3000 to test the frontend
- [ ] Create a workflow and execute it
- [ ] Check the database with `make db-shell`
- [ ] View run history: `SELECT * FROM workflow_runs;`

For backend development, see `apps/backend/CLAUDE.md`
For frontend development, see `apps/frontend/README.md`
