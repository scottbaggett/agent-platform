# Agent Platform

Advanced AI Workflow Platform - Monorepo

## Project Structure

```
agent-platform/
├── apps/
│   ├── backend/     # Python FastAPI + LangGraph execution server
│   └── frontend/    # React + TanStack Start application
├── package.json     # Root workspace configuration
├── pnpm-workspace.yaml
├── turbo.json       # Turborepo configuration
└── docker-compose.yml
```

## Prerequisites

- **Node.js**: >= 18
- **pnpm**: >= 9
- **Python**: >= 3.9
- **Docker**: (optional, for containerized development)

## Quick Start

### Local Development

1. **Install dependencies**
   ```bash
   pnpm install
   ```

2. **Start all applications**
   ```bash
   pnpm dev
   ```

   Or start individual apps:
   ```bash
   # Frontend only
   pnpm --filter frontend dev

   # Backend only (requires Python venv setup - see apps/backend/README.md)
   cd apps/backend
   python main.py
   ```

### Docker Development

```bash
# Start all services
docker-compose up

# Start specific service
docker-compose up frontend
docker-compose up backend
```

## Available Commands

All commands can be run from the root:

- `pnpm dev` - Start all apps in development mode
- `pnpm build` - Build all apps
- `pnpm test` - Run all tests
- `pnpm lint` - Lint all apps
- `pnpm typecheck` - Type check all apps
- `pnpm format` - Format all code

## Apps

### Backend

Python-based execution engine using FastAPI and LangGraph.

- **Port**: 8001
- **Tech**: Python, FastAPI, LangGraph, PostgreSQL
- **Docs**: See [apps/backend/README.md](./apps/backend/README.md)

### Frontend

React application built with TanStack Start/Router.

- **Port**: 3000
- **Tech**: React 19, TanStack Router, Tailwind CSS, Vite
- **Docs**: See [apps/frontend/README.md](./apps/frontend/README.md)

## Monorepo Tools

- **pnpm workspaces** - Dependency management
- **Turborepo** - Task orchestration and caching
- **Docker Compose** - Containerized development

## Development Workflow

1. Make changes in relevant app directory
2. Turborepo will automatically handle dependencies and caching
3. Run tests and linting before committing
4. See individual app READMEs for app-specific guidelines

## Environment Variables

Create `.env.docker` in the root for Docker Compose configuration.

See individual app directories for local development environment setup.
