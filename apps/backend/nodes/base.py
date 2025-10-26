"""
Base node class for all workflow nodes
"""

from abc import ABC, abstractmethod
from collections.abc import AsyncGenerator
from typing import Any


class BaseNode(ABC):
    """
    Abstract base class for all node types.

    Each node type should inherit from this class and implement the execute() method.
    """

    def __init__(
        self, node_id: str, node_data: dict[str, Any], edges: list[dict[str, Any]]
    ):
        """
        Initialize a node instance.

        Args:
            node_id: Unique identifier for this node
            node_data: Full node data from the workflow request
            edges: List of all edges in the workflow (for finding connections)
        """
        self.node_id = node_id
        self.node_data = node_data
        self.edges = edges
        self.node_type = node_data.get("data", {}).get("nodeType", "unknown")
        self.node_inputs = node_data.get("data", {}).get("nodeInputs", {})

    @abstractmethod
    async def execute(
        self, state: dict[str, Any]
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Execute the node's logic.

        Args:
            state: Dictionary of all previous node outputs (keyed by node_id)

        Yields:
            Partial results during execution (for streaming nodes)
            Final result should be the last yielded value

        Note:
            Nodes can yield multiple times for streaming updates,
            or yield once for non-streaming nodes.
        """
        raise NotImplementedError
        # Required for AsyncGenerator type hint
        yield {}

    def get_connected_value(self, state: dict[str, Any], target_handle: str) -> Any:
        """
        Helper to get a value from a connected node output.

        Args:
            state: Current workflow state (all node outputs)
            target_handle: Name of the input handle to look up

        Returns:
            The value from the connected node, or None if not found
        """
        # Find edges connecting to this node's input
        for edge in self.edges:
            if (
                edge["target"] == self.node_id
                and edge.get("targetHandle") == target_handle
            ):
                source_node_id = edge["source"]
                source_handle = edge.get("sourceHandle", "output")

                if source_node_id in state:
                    source_output = state[source_node_id]

                    # Try to get the specific output handle
                    if (
                        isinstance(source_output, dict)
                        and source_handle in source_output
                    ):
                        return source_output[source_handle]
                    if (
                        isinstance(source_output, dict) and "response" in source_output
                    ):
                        return source_output["response"]
                    if isinstance(source_output, dict) and "output" in source_output:
                        return source_output["output"]
                    return str(source_output)

        return None
