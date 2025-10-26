"""
Graph utilities for workflow execution order
"""

from collections import defaultdict, deque
from typing import Any

from config.settings import logger


def get_execution_order(
    nodes: dict[str, Any], edges: list[dict[str, Any]]
) -> list[str]:
    """
    Determine the execution order of nodes using topological sort (Kahn's algorithm).

    Args:
        nodes: Dictionary of all nodes in the workflow
        edges: List of all edges in the workflow

    Returns:
        List of node IDs in execution order

    Raises:
        Exception: If the workflow contains a cycle
    """
    # Build dependency graph for topological sort
    in_degree = dict.fromkeys(nodes.keys(), 0)
    adjacency = defaultdict(list)

    # Build graph from edges
    for edge in edges:
        source = edge["source"]
        target = edge["target"]
        if source in nodes and target in nodes:
            adjacency[source].append(target)
            in_degree[target] += 1

    # Topological sort using Kahn's algorithm
    queue = deque([node_id for node_id, degree in in_degree.items() if degree == 0])
    execution_order = []

    while queue:
        node_id = queue.popleft()
        execution_order.append(node_id)

        for neighbor in adjacency[node_id]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    # Check for cycles
    if len(execution_order) != len(nodes):
        raise Exception("Workflow contains a cycle - cannot execute")

    logger.info(f"📋 Execution order: {execution_order}")
    return execution_order
