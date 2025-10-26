"""
Workflow Run API routes.

Endpoints for querying execution history and drilling into run details.
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, cast, String
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from db import get_db, User, WorkflowRun, NodeExecution, ExecutionEvent
from db.models import WorkflowRunStatus, NodeStatus, EventType
from auth import get_current_active_user

router = APIRouter(prefix="/runs", tags=["runs"])


# --- Response Models ---
class NodeExecutionSummary(BaseModel):
    """Summary of a node execution."""
    id: UUID
    node_id: str
    node_type: str
    status: str
    started_at: Optional[str]
    completed_at: Optional[str]
    duration_seconds: Optional[float]
    tokens_used: Optional[int]
    error_message: Optional[str]

    class Config:
        from_attributes = True


class NodeExecutionDetail(BaseModel):
    """Detailed node execution with inputs/outputs."""
    id: UUID
    node_id: str
    node_type: str
    status: str
    inputs: Optional[dict]
    outputs: Optional[dict]
    tokens_used: Optional[int]
    started_at: Optional[str]
    completed_at: Optional[str]
    duration_seconds: Optional[float]
    error_message: Optional[str]

    class Config:
        from_attributes = True


class WorkflowRunSummary(BaseModel):
    """Summary of a workflow run."""
    id: UUID
    workflow_id: UUID
    status: str
    started_at: str
    completed_at: Optional[str]
    duration_seconds: Optional[float]
    total_nodes: int
    completed_nodes: int
    failed_nodes: int
    total_tokens: Optional[int]
    error_message: Optional[str]

    class Config:
        from_attributes = True


class WorkflowRunDetail(BaseModel):
    """Detailed workflow run with node executions."""
    id: UUID
    workflow_id: UUID
    status: str
    started_at: str
    completed_at: Optional[str]
    duration_seconds: Optional[float]
    error_message: Optional[str]
    node_executions: List[NodeExecutionDetail]
    total_tokens: Optional[int]

    class Config:
        from_attributes = True


class ExecutionEventResponse(BaseModel):
    """Execution event for replay."""
    id: UUID
    timestamp: str
    event_type: str
    event_data: dict
    node_id: Optional[str]

    class Config:
        from_attributes = True


# --- Endpoints ---
@router.get("/", response_model=List[WorkflowRunSummary])
async def list_runs(
    workflow_id: Optional[UUID] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> List[WorkflowRunSummary]:
    """
    List workflow runs for current user.

    Args:
        workflow_id: Optional filter by workflow
        status: Optional filter by status (running, completed, failed)
        limit: Maximum number of runs to return
        offset: Number of runs to skip
        current_user: Authenticated user
        db: Database session

    Returns:
        List of workflow run summaries with node counts
    """
    # Build query with aggregations
    query = (
        select(
            WorkflowRun,
            func.count(NodeExecution.id).label("total_nodes"),
            func.count(NodeExecution.id).filter(
                cast(NodeExecution.status, String) == "completed"
            ).label("completed_nodes"),
            func.count(NodeExecution.id).filter(
                cast(NodeExecution.status, String) == "failed"
            ).label("failed_nodes"),
            func.sum(NodeExecution.tokens_used).label("total_tokens")
        )
        .outerjoin(NodeExecution, NodeExecution.run_id == WorkflowRun.id)
        .where(WorkflowRun.owner_id == current_user.id)
        .group_by(WorkflowRun.id)
        .order_by(WorkflowRun.started_at.desc())
        .limit(limit)
        .offset(offset)
    )

    # Apply filters
    if workflow_id:
        query = query.where(WorkflowRun.workflow_id == workflow_id)
    if status:
        try:
            status_enum = WorkflowRunStatus(status)
            query = query.where(WorkflowRun.status == status_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid status: {status}. Must be one of: running, completed, failed"
            )

    result = await db.execute(query)
    runs_data = result.all()

    return [
        WorkflowRunSummary(
            id=run.id,
            workflow_id=run.workflow_id,
            status=run.status.value if isinstance(run.status, WorkflowRunStatus) else run.status,
            started_at=run.started_at.isoformat(),
            completed_at=run.completed_at.isoformat() if run.completed_at else None,
            duration_seconds=(
                (run.completed_at - run.started_at).total_seconds()
                if run.completed_at else None
            ),
            total_nodes=total_nodes or 0,
            completed_nodes=completed_nodes or 0,
            failed_nodes=failed_nodes or 0,
            total_tokens=total_tokens,
            error_message=run.error_message
        )
        for run, total_nodes, completed_nodes, failed_nodes, total_tokens in runs_data
    ]


@router.get("/{run_id}", response_model=WorkflowRunDetail)
async def get_run_detail(
    run_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> WorkflowRunDetail:
    """
    Get detailed workflow run with all node executions.

    Args:
        run_id: Workflow run UUID
        current_user: Authenticated user
        db: Database session

    Returns:
        Detailed run information with node executions

    Raises:
        HTTPException: 404 if run not found or not owned by user
    """
    # Get run with owner check
    run_query = select(WorkflowRun).where(
        WorkflowRun.id == run_id,
        WorkflowRun.owner_id == current_user.id
    )
    run_result = await db.execute(run_query)
    run = run_result.scalar_one_or_none()

    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow run {run_id} not found"
        )

    # Get node executions
    node_query = (
        select(NodeExecution)
        .where(NodeExecution.run_id == run_id)
        .order_by(NodeExecution.started_at)
    )
    node_result = await db.execute(node_query)
    node_executions = node_result.scalars().all()

    # Calculate total tokens
    total_tokens = sum(
        (ne.tokens_used or 0) for ne in node_executions
    )

    return WorkflowRunDetail(
        id=run.id,
        workflow_id=run.workflow_id,
        status=run.status.value if isinstance(run.status, WorkflowRunStatus) else run.status,
        started_at=run.started_at.isoformat(),
        completed_at=run.completed_at.isoformat() if run.completed_at else None,
        duration_seconds=(
            (run.completed_at - run.started_at).total_seconds()
            if run.completed_at else None
        ),
        error_message=run.error_message,
        total_tokens=total_tokens,
        node_executions=[
            NodeExecutionDetail(
                id=ne.id,
                node_id=ne.node_id,
                node_type=ne.node_type,
                status=ne.status.value if isinstance(ne.status, NodeStatus) else ne.status,
                inputs=ne.inputs,
                outputs=ne.outputs,
                tokens_used=ne.tokens_used,
                started_at=ne.started_at.isoformat() if ne.started_at else None,
                completed_at=ne.completed_at.isoformat() if ne.completed_at else None,
                duration_seconds=(
                    (ne.completed_at - ne.started_at).total_seconds()
                    if ne.started_at and ne.completed_at else None
                ),
                error_message=ne.error_message
            )
            for ne in node_executions
        ]
    )


@router.get("/{run_id}/events", response_model=List[ExecutionEventResponse])
async def get_run_events(
    run_id: UUID,
    event_type: Optional[str] = None,
    node_id: Optional[str] = None,
    limit: int = 1000,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
) -> List[ExecutionEventResponse]:
    """
    Get execution events for replay/debugging.

    Args:
        run_id: Workflow run UUID
        event_type: Optional filter by event type
        node_id: Optional filter by node ID
        limit: Maximum number of events to return
        current_user: Authenticated user
        db: Database session

    Returns:
        List of execution events in chronological order

    Raises:
        HTTPException: 404 if run not found or not owned by user
    """
    # Verify run exists and is owned by user
    run_query = select(WorkflowRun).where(
        WorkflowRun.id == run_id,
        WorkflowRun.owner_id == current_user.id
    )
    run_result = await db.execute(run_query)
    if not run_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Workflow run {run_id} not found"
        )

    # Build events query
    query = (
        select(ExecutionEvent)
        .where(ExecutionEvent.run_id == run_id)
        .order_by(ExecutionEvent.timestamp)
        .limit(limit)
    )

    # Apply filters
    if event_type:
        try:
            event_type_enum = EventType(event_type)
            query = query.where(ExecutionEvent.event_type == event_type_enum)
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid event_type: {event_type}"
            )

    if node_id:
        query = query.where(ExecutionEvent.node_id == node_id)

    result = await db.execute(query)
    events = result.scalars().all()

    return [
        ExecutionEventResponse(
            id=event.id,
            timestamp=event.timestamp.isoformat(),
            event_type=event.event_type.value if isinstance(event.event_type, EventType) else event.event_type,
            event_data=event.event_data,
            node_id=event.node_id
        )
        for event in events
    ]
