"""
Database-aware workflow executor - persists execution data to database.
"""

import asyncio
import json
from datetime import datetime, timezone
from typing import Any, AsyncGenerator
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from config.settings import logger
from db import WorkflowRun, NodeExecution, ExecutionEvent, WorkflowRunStatus
from db.models import NodeStatus, EventType
from workflow.executor import WorkflowExecutor


class DatabaseWorkflowExecutor:
    """
    Wraps WorkflowExecutor to persist execution data to database.

    Tracks:
    - Workflow run with status and timing
    - Node executions with inputs/outputs and timing
    - Event stream for full replay capability
    """

    def __init__(
        self,
        workflow_id: UUID,
        owner_id: UUID,
        nodes: dict[str, Any],
        edges: list[dict[str, Any]],
        db: AsyncSession,
    ):
        """
        Initialize database-aware executor.

        Args:
            workflow_id: UUID of workflow being executed
            owner_id: UUID of user executing the workflow
            nodes: Dictionary of all nodes in the workflow
            edges: List of all edges in the workflow
            db: Database session for persistence
        """
        self.workflow_id = workflow_id
        self.owner_id = owner_id
        self.nodes = nodes
        self.edges = edges
        self.db = db
        self.executor = WorkflowExecutor(nodes, edges)
        self.run = None
        self.node_executions = {}  # node_id -> NodeExecution

    async def execute(self) -> AsyncGenerator[str, None]:
        """
        Execute workflow and persist all execution data.

        Yields:
            SSE formatted strings with workflow events
        """
        # Create workflow run record
        self.run = WorkflowRun(
            workflow_id=self.workflow_id,
            owner_id=self.owner_id,
            status=WorkflowRunStatus.RUNNING,
            started_at=datetime.now(timezone.utc),
        )
        self.db.add(self.run)
        await self.db.commit()
        await self.db.refresh(self.run)

        logger.info(f"📊 Created workflow run: {self.run.id}")

        try:
            # Stream execution and capture events
            async for event_str in self.executor.execute():
                # Parse the SSE event
                if event_str.startswith("data: "):
                    event_json = event_str[6:].strip()
                    event_data = json.loads(event_json)

                    # Handle different event types
                    await self._handle_event(event_data)

                # Pass through the event to client
                yield event_str

            # Mark run as completed
            self.run.status = WorkflowRunStatus.COMPLETED
            self.run.completed_at = datetime.now(timezone.utc)
            await self.db.commit()

            logger.info(f"✅ Workflow run {self.run.id} completed successfully")

        except Exception as e:
            # Mark run as failed
            self.run.status = WorkflowRunStatus.FAILED
            self.run.completed_at = datetime.now(timezone.utc)
            self.run.error_message = str(e)
            await self.db.commit()

            logger.error(f"❌ Workflow run {self.run.id} failed: {e}")
            raise

    async def _handle_event(self, event_data: dict[str, Any]) -> None:
        """
        Handle workflow event and persist to database.

        Args:
            event_data: Parsed event data from SSE stream
        """
        event_type = event_data.get("event")
        node_id = event_data.get("node_id")

        # Save event to database
        db_event = ExecutionEvent(
            run_id=self.run.id,
            event_type=self._map_event_type(event_type),
            event_data=event_data,
            node_id=node_id,
            timestamp=datetime.now(timezone.utc),
        )
        self.db.add(db_event)

        # Handle specific event types
        if event_type == "node_start":
            await self._handle_node_start(event_data)
        elif event_type == "node_complete":
            await self._handle_node_complete(event_data)
        elif event_type == "error":
            await self._handle_error(event_data)

        # Commit after each event (incremental persistence)
        await self.db.commit()

    async def _handle_node_start(self, event_data: dict[str, Any]) -> None:
        """Handle node_start event - create NodeExecution record."""
        node_id = event_data.get("node_id")
        node_type = event_data.get("node_type", "unknown")

        # Get node inputs from executor's state
        inputs = self._get_node_inputs(node_id)

        # Create node execution record
        node_exec = NodeExecution(
            run_id=self.run.id,
            node_id=node_id,
            node_type=node_type,
            status=NodeStatus.RUNNING,
            inputs=inputs,
            started_at=datetime.now(timezone.utc),
        )
        self.db.add(node_exec)
        self.node_executions[node_id] = node_exec

        logger.debug(f"📊 Created node execution for {node_id}")

    async def _handle_node_complete(self, event_data: dict[str, Any]) -> None:
        """Handle node_complete event - update NodeExecution with outputs."""
        node_id = event_data.get("node_id")
        output = event_data.get("output", {})

        if node_id in self.node_executions:
            node_exec = self.node_executions[node_id]
            node_exec.status = NodeStatus.COMPLETED
            node_exec.outputs = output
            node_exec.completed_at = datetime.now(timezone.utc)

            # Track tokens if available
            if isinstance(output, dict) and "tokens" in output:
                node_exec.tokens_used = output.get("tokens")

            logger.debug(f"📊 Updated node execution {node_id}: completed")

    async def _handle_error(self, event_data: dict[str, Any]) -> None:
        """Handle error event - mark current node/run as failed."""
        error_message = event_data.get("message", "Unknown error")
        node_id = event_data.get("node_id")

        if node_id and node_id in self.node_executions:
            # Node-level error
            node_exec = self.node_executions[node_id]
            node_exec.status = NodeStatus.FAILED
            node_exec.error_message = error_message
            node_exec.completed_at = datetime.now(timezone.utc)

            logger.debug(f"📊 Marked node execution {node_id} as failed")

    def _get_node_inputs(self, node_id: str) -> dict[str, Any]:
        """
        Get inputs for a node from the workflow definition and executor state.

        Args:
            node_id: Node ID to get inputs for

        Returns:
            Dictionary of node inputs
        """
        # Get node data from workflow definition
        node_data = self.nodes.get(node_id, {})

        # Get incoming edges to determine input sources
        incoming_edges = [
            edge for edge in self.edges if edge.get("target") == node_id
        ]

        # Build inputs from node configuration and connected nodes
        inputs = {
            "node_config": node_data.get("data", {}),
            "incoming_connections": [
                {
                    "source_node": edge.get("source"),
                    "source_handle": edge.get("sourceHandle"),
                    "target_handle": edge.get("targetHandle"),
                }
                for edge in incoming_edges
            ],
        }

        # Add outputs from predecessor nodes if available
        predecessor_outputs = {}
        for edge in incoming_edges:
            source_id = edge.get("source")
            if source_id in self.executor.node_outputs:
                predecessor_outputs[source_id] = self.executor.node_outputs[source_id]

        if predecessor_outputs:
            inputs["predecessor_outputs"] = predecessor_outputs

        return inputs

    def _map_event_type(self, event_type: str) -> EventType:
        """
        Map SSE event type to database EventType enum.

        Args:
            event_type: Event type from SSE stream

        Returns:
            EventType enum value
        """
        mapping = {
            "workflow_start": EventType.WORKFLOW_START,
            "workflow_complete": EventType.WORKFLOW_COMPLETE,
            "node_start": EventType.NODE_START,
            "node_progress": EventType.NODE_PROGRESS,
            "node_stream": EventType.NODE_STREAM,
            "node_complete": EventType.NODE_COMPLETE,
            "error": EventType.ERROR,
        }
        return mapping.get(event_type, EventType.LOG)
