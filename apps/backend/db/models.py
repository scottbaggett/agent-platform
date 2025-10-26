"""
SQLAlchemy ORM models for Agent Platform.

Models:
- User: Application users
- Workflow: Workflow definitions with nodes and edges
- WorkflowRun: Individual workflow execution instances
- NodeExecution: Node-level execution details within a run
- ExecutionEvent: Detailed event stream for replay and debugging
"""

import uuid
import enum
from datetime import datetime
from typing import Optional
from sqlalchemy import Column, String, Integer, ForeignKey, DateTime, Text, Enum as SQLEnum, Boolean
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from .database import Base


# --- Enums for Status Fields ---
class WorkflowRunStatus(str, enum.Enum):
    """Status of a workflow run."""
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"


class NodeStatus(str, enum.Enum):
    """Status of a node execution."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class EventType(str, enum.Enum):
    """Types of execution events."""
    WORKFLOW_START = "workflow_start"
    WORKFLOW_COMPLETE = "workflow_complete"
    NODE_START = "node_start"
    NODE_PROGRESS = "node_progress"
    NODE_STREAM = "node_stream"
    NODE_COMPLETE = "node_complete"
    ERROR = "error"
    LOG = "log"
    METRIC = "metric"


# --- User Table ---
class User(Base):
    """
    Application users who own and execute workflows.
    """
    __tablename__ = "users"

    # Primary Key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Core Columns
    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    workflows = relationship(
        "Workflow",
        back_populates="owner",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    workflow_runs = relationship(
        "WorkflowRun",
        back_populates="owner",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<User(id={self.id}, username='{self.username}', email='{self.email}')>"


# --- Workflow Definition Table ---
class Workflow(Base):
    """
    Stores workflow definitions with nodes and edges.

    A workflow is a directed acyclic graph (DAG) of nodes that define
    a processing pipeline. The definition includes nodes, edges, and metadata.
    """
    __tablename__ = "workflows"

    # Primary Key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Foreign Keys
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    # Core Columns
    name = Column(String(255), nullable=False, index=True)
    definition = Column(JSONB, nullable=False)  # Stores nodes, edges, viewport

    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    owner = relationship("User", back_populates="workflows")
    runs = relationship(
        "WorkflowRun",
        back_populates="workflow",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<Workflow(id={self.id}, name='{self.name}', owner_id={self.owner_id})>"


# --- Workflow Run History Table ---
class WorkflowRun(Base):
    """
    Tracks individual workflow execution instances.

    Each time a workflow is executed, a new WorkflowRun record is created
    to track its progress, status, and timing information.
    """
    __tablename__ = "workflow_runs"

    # Primary Key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Foreign Keys
    workflow_id = Column(UUID(as_uuid=True), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False, index=True)
    owner_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)

    # Core Columns
    status = Column(
        SQLEnum(WorkflowRunStatus, name="workflow_run_status", native_enum=False, create_constraint=True, length=20),
        nullable=False,
        default=WorkflowRunStatus.RUNNING,
        index=True
    )

    # Timestamps
    started_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Error Info
    error_message = Column(Text, nullable=True)

    # Relationships
    owner = relationship("User", back_populates="workflow_runs")
    workflow = relationship("Workflow", back_populates="runs")
    node_executions = relationship(
        "NodeExecution",
        back_populates="run",
        cascade="all, delete-orphan",
        lazy="selectin"
    )
    events = relationship(
        "ExecutionEvent",
        back_populates="run",
        cascade="all, delete-orphan",
        lazy="selectin"
    )

    def __repr__(self) -> str:
        return f"<WorkflowRun(id={self.id}, workflow_id={self.workflow_id}, owner_id={self.owner_id}, status={self.status})>"


# --- Node Execution Details Table ---
class NodeExecution(Base):
    """
    Records execution of individual nodes within a workflow run.

    Tracks inputs, outputs, timing, tokens used, and error information
    for each node execution.
    """
    __tablename__ = "node_executions"

    # Primary Key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Foreign Keys
    run_id = Column(UUID(as_uuid=True), ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False, index=True)

    # Core Columns
    node_id = Column(String(255), nullable=False, index=True)  # ID from workflow definition
    node_type = Column(String(100), nullable=False, index=True)
    status = Column(
        SQLEnum(NodeStatus, name="node_status", native_enum=False, create_constraint=True, length=20),
        nullable=False,
        default=NodeStatus.PENDING,
        index=True
    )

    # Data (using JSONB for flexibility)
    inputs = Column(JSONB, nullable=True)
    outputs = Column(JSONB, nullable=True)

    # Metrics
    tokens_used = Column(Integer, nullable=True)

    # Timestamps
    started_at = Column(DateTime(timezone=True), nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    # Error Info
    error_message = Column(Text, nullable=True)

    # Relationships
    run = relationship("WorkflowRun", back_populates="node_executions")

    def __repr__(self) -> str:
        return f"<NodeExecution(id={self.id}, run_id={self.run_id}, node_id='{self.node_id}', status={self.status})>"


# --- Execution Events Table ---
class ExecutionEvent(Base):
    """
    Stores detailed event stream for workflow execution replay and debugging.

    Events include node starts, completions, progress updates, streaming data,
    and errors. This enables full replay of workflow execution.
    """
    __tablename__ = "execution_events"

    # Primary Key
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)

    # Foreign Keys
    run_id = Column(UUID(as_uuid=True), ForeignKey("workflow_runs.id", ondelete="CASCADE"), nullable=False, index=True)

    # Core Columns
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), nullable=False, index=True)
    event_type = Column(
        SQLEnum(EventType, name="event_type", native_enum=False, create_constraint=True, length=50),
        nullable=False,
        index=True
    )
    event_data = Column(JSONB, nullable=False)
    node_id = Column(String(255), nullable=True)  # Optional: for node-specific events

    # Relationships
    run = relationship("WorkflowRun", back_populates="events")

    def __repr__(self) -> str:
        return f"<ExecutionEvent(id={self.id}, run_id={self.run_id}, type={self.event_type})>"
