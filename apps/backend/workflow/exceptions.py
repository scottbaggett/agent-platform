"""
Custom exceptions for workflow execution
"""
from typing import Optional


class NodeError(Exception):
    """
    Exception raised when a node fails during execution.
    Includes node_id for better error tracking and potential retry logic.
    """

    def __init__(
        self,
        node_id: str,
        node_type: str,
        message: str,
        original_exception: Optional[Exception] = None,
    ):
        """
        Initialize a NodeError.

        Args:
            node_id: ID of the node that failed
            node_type: Type of the node that failed
            message: Error message
            original_exception: The original exception that caused this error
        """
        self.node_id = node_id
        self.node_type = node_type
        self.original_exception = original_exception
        super().__init__(f"Node {node_id} ({node_type}): {message}")
