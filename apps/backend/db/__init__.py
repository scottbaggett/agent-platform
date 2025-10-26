"""
Database package for Agent Platform.

Exports:
- Base: SQLAlchemy declarative base
- get_db: Dependency function for FastAPI routes
- init_db: Initialize database tables
- close_db: Close database connections
- All model classes
"""

from .database import Base, get_db, init_db, close_db, engine
from .models import (
    User,
    Workflow,
    WorkflowRun,
    NodeExecution,
    ExecutionEvent,
    WorkflowRunStatus,
    NodeStatus,
    EventType,
)

__all__ = [
    "Base",
    "get_db",
    "init_db",
    "close_db",
    "engine",
    "User",
    "Workflow",
    "WorkflowRun",
    "NodeExecution",
    "ExecutionEvent",
    "WorkflowRunStatus",
    "NodeStatus",
    "EventType",
]
