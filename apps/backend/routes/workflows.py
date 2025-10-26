"""
Workflow API routes.

Endpoints:
- POST /workflows - Create a new workflow
- GET /workflows - List all workflows
- GET /workflows/{workflow_id} - Get a specific workflow
- PUT /workflows/{workflow_id} - Update a workflow
- DELETE /workflows/{workflow_id} - Delete a workflow
- GET /workflows/{workflow_id}/runs - Get all runs for a workflow
"""

from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field

from db import get_db, User, Workflow, WorkflowRun, NodeExecution
from db.models import WorkflowRunStatus
from auth import get_current_active_user

router = APIRouter(prefix="/workflows", tags=["workflows"])


# --- Request/Response Models ---
class WorkflowCreate(BaseModel):
    """Request model for creating a workflow."""

    name: str = Field(..., min_length=1, max_length=255, description="Workflow name")
    definition: dict = Field(..., description="Workflow definition with nodes and edges")


class WorkflowUpdate(BaseModel):
    """Request model for updating a workflow."""

    name: Optional[str] = Field(None, min_length=1, max_length=255, description="Workflow name")
    definition: Optional[dict] = Field(None, description="Workflow definition with nodes and edges")


class WorkflowResponse(BaseModel):
    """Response model for a workflow."""

    id: UUID
    name: str
    definition: dict
    created_at: str
    updated_at: str

    class Config:
        from_attributes = True


class WorkflowListResponse(BaseModel):
    """Response model for listing workflows."""

    workflows: List[WorkflowResponse]
    total: int


class WorkflowRunSummary(BaseModel):
    """Summary of a workflow run."""

    id: UUID
    workflow_id: UUID
    status: str
    started_at: str
    completed_at: Optional[str]
    error_message: Optional[str]
    total_nodes: int
    completed_nodes: int

    class Config:
        from_attributes = True


# --- Endpoints ---
@router.post("/", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    workflow: WorkflowCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> WorkflowResponse:
    """
    Create a new workflow.

    Args:
        workflow: Workflow data (name and definition)
        current_user: Authenticated user
        db: Database session

    Returns:
        Created workflow with ID and timestamps
    """
    # Create workflow instance owned by current user
    new_workflow = Workflow(
        name=workflow.name, definition=workflow.definition, owner_id=current_user.id
    )

    # Add to database
    db.add(new_workflow)
    await db.commit()
    await db.refresh(new_workflow)

    return WorkflowResponse(
        id=new_workflow.id,
        name=new_workflow.name,
        definition=new_workflow.definition,
        created_at=new_workflow.created_at.isoformat(),
        updated_at=new_workflow.updated_at.isoformat(),
    )


@router.get("/", response_model=WorkflowListResponse)
async def list_workflows(
    skip: int = 0,
    limit: int = 100,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> WorkflowListResponse:
    """
    List all workflows for the current user with pagination.

    Args:
        skip: Number of workflows to skip (offset)
        limit: Maximum number of workflows to return
        current_user: Authenticated user
        db: Database session

    Returns:
        List of workflows and total count (only user's workflows)
    """
    # Get total count for this user
    count_query = (
        select(func.count()).select_from(Workflow).where(Workflow.owner_id == current_user.id)
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get workflows for this user
    query = (
        select(Workflow)
        .where(Workflow.owner_id == current_user.id)
        .order_by(Workflow.updated_at.desc())
        .offset(skip)
        .limit(limit)
    )
    result = await db.execute(query)
    workflows = result.scalars().all()

    return WorkflowListResponse(
        workflows=[
            WorkflowResponse(
                id=w.id,
                name=w.name,
                definition=w.definition,
                created_at=w.created_at.isoformat(),
                updated_at=w.updated_at.isoformat(),
            )
            for w in workflows
        ],
        total=total,
    )


@router.get("/{workflow_id}", response_model=WorkflowResponse)
async def get_workflow(
    workflow_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> WorkflowResponse:
    """
    Get a specific workflow by ID (must be owned by current user).

    Args:
        workflow_id: Workflow UUID
        current_user: Authenticated user
        db: Database session

    Returns:
        Workflow details

    Raises:
        HTTPException: 404 if workflow not found or not owned by user
    """
    query = select(Workflow).where(Workflow.id == workflow_id, Workflow.owner_id == current_user.id)
    result = await db.execute(query)
    workflow = result.scalar_one_or_none()

    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow {workflow_id} not found"
        )

    return WorkflowResponse(
        id=workflow.id,
        name=workflow.name,
        definition=workflow.definition,
        created_at=workflow.created_at.isoformat(),
        updated_at=workflow.updated_at.isoformat(),
    )


@router.put("/{workflow_id}", response_model=WorkflowResponse)
async def update_workflow(
    workflow_id: UUID,
    workflow_update: WorkflowUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> WorkflowResponse:
    """
    Update a workflow (must be owned by current user).

    Args:
        workflow_id: Workflow UUID
        workflow_update: Updated workflow data
        current_user: Authenticated user
        db: Database session

    Returns:
        Updated workflow

    Raises:
        HTTPException: 404 if workflow not found or not owned by user
    """
    # Get existing workflow owned by current user
    query = select(Workflow).where(Workflow.id == workflow_id, Workflow.owner_id == current_user.id)
    result = await db.execute(query)
    workflow = result.scalar_one_or_none()

    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow {workflow_id} not found"
        )

    # Update fields
    if workflow_update.name is not None:
        workflow.name = workflow_update.name
    if workflow_update.definition is not None:
        workflow.definition = workflow_update.definition

    await db.commit()
    await db.refresh(workflow)

    return WorkflowResponse(
        id=workflow.id,
        name=workflow.name,
        definition=workflow.definition,
        created_at=workflow.created_at.isoformat(),
        updated_at=workflow.updated_at.isoformat(),
    )


@router.delete("/{workflow_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    workflow_id: UUID,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    """
    Delete a workflow (must be owned by current user).

    Args:
        workflow_id: Workflow UUID
        current_user: Authenticated user
        db: Database session

    Raises:
        HTTPException: 404 if workflow not found or not owned by user
    """
    query = select(Workflow).where(Workflow.id == workflow_id, Workflow.owner_id == current_user.id)
    result = await db.execute(query)
    workflow = result.scalar_one_or_none()

    if not workflow:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow {workflow_id} not found"
        )

    await db.delete(workflow)
    await db.commit()


@router.get("/{workflow_id}/runs", response_model=List[WorkflowRunSummary])
async def get_workflow_runs(
    workflow_id: UUID,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
) -> List[WorkflowRunSummary]:
    """
    Get all runs for a specific workflow (must be owned by current user).

    Args:
        workflow_id: Workflow UUID
        limit: Maximum number of runs to return
        current_user: Authenticated user
        db: Database session

    Returns:
        List of workflow run summaries

    Raises:
        HTTPException: 404 if workflow not found or not owned by user
    """
    # Verify workflow exists and is owned by current user
    workflow_query = select(Workflow).where(
        Workflow.id == workflow_id, Workflow.owner_id == current_user.id
    )
    workflow_result = await db.execute(workflow_query)
    if not workflow_result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Workflow {workflow_id} not found"
        )

    # Get runs with node execution counts
    query = (
        select(
            WorkflowRun,
            func.count(NodeExecution.id).label("total_nodes"),
            func.count(NodeExecution.id)
            .filter(NodeExecution.status == "completed")
            .label("completed_nodes"),
        )
        .outerjoin(NodeExecution, NodeExecution.run_id == WorkflowRun.id)
        .where(WorkflowRun.workflow_id == workflow_id)
        .group_by(WorkflowRun.id)
        .order_by(WorkflowRun.started_at.desc())
        .limit(limit)
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
            error_message=run.error_message,
            total_nodes=total_nodes or 0,
            completed_nodes=completed_nodes or 0,
        )
        for run, total_nodes, completed_nodes in runs_data
    ]
