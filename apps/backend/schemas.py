"""
Pydantic models for API requests and responses
"""

from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel


class WorkflowRequest(BaseModel):
    """Request model for workflow execution"""

    workflow_id: Optional[UUID] = None  # Optional: for ad-hoc execution vs saved workflow
    nodes: dict[str, Any]
    edges: list[dict[str, Any]]
