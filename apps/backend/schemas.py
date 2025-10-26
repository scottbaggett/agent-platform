"""
Pydantic models for API requests and responses
"""

from typing import Any

from pydantic import BaseModel


class WorkflowRequest(BaseModel):
    """Request model for workflow execution"""

    nodes: dict[str, Any]
    edges: list[dict[str, Any]]
