"""
Prototype LangGraph Execution Server
Quick and dirty server for prototyping LangGraph nodes in the Salt workflow UI
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, text

from config.model_registry import MODEL_REGISTRY
from config.node_definitions import EXPERIMENTAL_NODES
from config.settings import CORS_ORIGINS, logger
from schemas import WorkflowRequest
from workflow.executor import WorkflowExecutor
from db import get_db, close_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifecycle manager for FastAPI app.
    Handles startup and shutdown events.
    """
    # Startup
    logger.info("🚀 Starting Proto Execution Engine")
    logger.info("📊 Database connection initialized")

    yield

    # Shutdown
    logger.info("👋 Shutting down Proto Execution Engine")
    await close_db()
    logger.info("📊 Database connections closed")


app = FastAPI(
    title="Proto Execution Engine",
    version="0.1.0",
    lifespan=lifespan
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """Root endpoint - service status"""
    return {
        "service": "Proto Execution Engine",
        "status": "running",
        "endpoints": {
            "health": "/healthz",
            "nodes": "/nodes",
            "models": "/models",
            "execute": "/execute"
        },
    }


@app.get("/healthz")
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Health check endpoint for Docker and monitoring.

    Tests:
    - API is responding
    - Database connection is alive
    """
    try:
        # Test database connection
        result = await db.execute(text("SELECT 1"))
        db_healthy = result.scalar() == 1

        return {
            "status": "healthy" if db_healthy else "unhealthy",
            "service": "Proto Execution Engine",
            "database": "connected" if db_healthy else "disconnected",
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "service": "Proto Execution Engine",
            "database": "error",
            "error": str(e),
        }


@app.get("/nodes")
async def get_nodes():
    """Return experimental node definitions for the frontend"""
    return {"nodes": list(EXPERIMENTAL_NODES.values())}


@app.get("/models")
async def get_models():
    """Return model registry with capabilities and valid parameters"""
    # Convert Pydantic models to dict for JSON serialization
    return {
        "models": {
            model_name: config.dict()
            for model_name, config in MODEL_REGISTRY.items()
        }
    }


@app.post("/execute")
async def execute_workflow(request: WorkflowRequest):
    """
    Execute workflow and stream progress via Server-Sent Events

    Events streamed:
    - workflow_start: Execution begins
    - node_start: Node execution starting
    - node_progress: Progress update during node execution
    - node_stream: Streaming content (for LLM responses)
    - node_complete: Node finished with output
    - node_error: Node encountered error
    - workflow_complete: All done
    """
    # Create executor and run workflow
    executor = WorkflowExecutor(request.nodes, request.edges)
    return StreamingResponse(executor.execute(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    logger.info("🚀 Starting Proto Execution Engine on http://localhost:8001")
    logger.info("📚 API docs available at http://localhost:8001/docs")
    uvicorn.run("main:app", host="0.0.0.0", port=8001, reload=True)
