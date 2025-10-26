"""
Workflow executor - orchestrates node execution with SSE streaming
"""

import asyncio
import json
from collections.abc import AsyncGenerator
from typing import Any

from config.settings import logger
from nodes import NODE_REGISTRY
from workflow.graph import get_execution_order


class WorkflowExecutor:
    """
    Executes a workflow by running nodes in dependency order and streaming events.
    """

    def __init__(self, nodes: dict[str, Any], edges: list[dict[str, Any]]):
        """
        Initialize the workflow executor.

        Args:
            nodes: Dictionary of all nodes in the workflow
            edges: List of all edges in the workflow
        """
        self.nodes = nodes
        self.edges = edges
        self.node_outputs = {}

    async def execute(self) -> AsyncGenerator[str, None]:
        """
        Execute the workflow and stream Server-Sent Events.

        Yields:
            SSE formatted strings with workflow events
        """
        logger.info("=" * 80)
        logger.info("🚀 EXECUTION STARTED")
        logger.info(f"Received {len(self.nodes)} nodes and {len(self.edges)} edges")
        logger.info(f"Nodes: {list(self.nodes.keys())}")
        logger.debug(f"Edges: {self.edges}")
        logger.info("=" * 80)

        try:
            # Start workflow
            logger.info("📤 Sending workflow_start event")
            yield f"data: {json.dumps({'event': 'workflow_start', 'timestamp': asyncio.get_event_loop().time()})}\n\n"

            # Get execution order (topological sort)
            execution_order = get_execution_order(self.nodes, self.edges)

            # Execute each node in dependency order
            for node_id in execution_order:
                node_data = self.nodes[node_id]
                logger.info(f"\n{'=' * 80}")
                logger.info(f"🔵 Processing node: {node_id}")

                # Get node type from data.nodeType (frontend structure)
                node_type = node_data.get("data", {}).get("nodeType", "unknown")
                logger.info(f"Node type: {node_type}")
                logger.debug(f"Node data: {node_data}")

                # Node start
                logger.info(f"📤 Sending node_start event for {node_id}")
                yield f"data: {json.dumps({'event': 'node_start', 'node_id': node_id, 'node_type': node_type})}\n\n"

                # Simulate progress updates
                await asyncio.sleep(0.5)
                logger.debug(f"📤 Sending node_progress (30%) for {node_id}")
                yield f"data: {json.dumps({'event': 'node_progress', 'node_id': node_id, 'progress': 0.3, 'message': 'Processing...'})}\n\n"

                await asyncio.sleep(0.5)
                logger.debug(f"📤 Sending node_progress (70%) for {node_id}")
                yield f"data: {json.dumps({'event': 'node_progress', 'node_id': node_id, 'progress': 0.7, 'message': 'Almost done...'})}\n\n"

                await asyncio.sleep(0.5)

                # Find connected output nodes for streaming
                connected_outputs = [
                    edge["target"] for edge in self.edges if edge["source"] == node_id
                ]

                # Execute the node using the registry (now streams via async generator)
                result = None
                async for partial_result in self._execute_node(
                    node_id, node_type, node_data
                ):
                    result = partial_result

                    # Stream real-time updates to connected output nodes
                    if "response" in partial_result:
                        for output_id in connected_outputs:
                            yield f"data: {json.dumps({'event': 'node_stream', 'node_id': output_id, 'content': partial_result['response']})}\n\n"

                # Store final node output for context
                if result:
                    self.node_outputs[node_id] = result
                    logger.debug(f"💾 Stored output for {node_id}: {result}")

                # Node complete
                logger.info(f"📤 Sending node_complete event for {node_id}")
                yield f"data: {json.dumps({'event': 'node_complete', 'node_id': node_id, 'output': result})}\n\n"

            # Workflow complete
            logger.info(f"\n{'=' * 80}")
            logger.info("✅ WORKFLOW COMPLETE")
            logger.info(f"{'=' * 80}\n")
            yield f"data: {json.dumps({'event': 'workflow_complete', 'timestamp': asyncio.get_event_loop().time()})}\n\n"

        except Exception as e:
            logger.error(f"\n{'=' * 80}")
            logger.error(f"❌ ERROR: {e!s}")
            logger.error(f"{'=' * 80}\n")
            yield f"data: {json.dumps({'event': 'error', 'message': str(e)})}\n\n"

    async def _execute_node(
        self, node_id: str, node_type: str, node_data: dict[str, Any]
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Execute a single node using the node registry.

        Args:
            node_id: ID of the node to execute
            node_type: Type of the node
            node_data: Full node data

        Yields:
            Partial results during node execution (for streaming nodes)
        """
        # Get the node class from the registry
        node_class = NODE_REGISTRY.get(node_type)

        if node_class:
            # Instantiate and execute the node
            node_instance = node_class(node_id, node_data, self.edges)
            async for result in node_instance.execute(self.node_outputs):
                yield result
        else:
            # Unknown node type - return error
            logger.warning(f"⚠️ Unknown node type: {node_type}")
            yield {"error": f"Unknown node type: {node_type}"}
