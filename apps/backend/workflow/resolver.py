"""
Input resolution for {{variable}} placeholders
"""

import re
from typing import Any

from config.settings import logger


def resolve_inputs(
    node_inputs: dict[str, Any],
    state: dict[str, Any],
    edges: list[dict[str, Any]],
    node_id: str,
) -> dict[str, Any]:
    """
    Resolve inputs by:
    1. Checking for direct edge connections to each input
    2. Resolving {{variable}} placeholders in string values
    3. Handling nested model_parameters

    Args:
        node_inputs: The raw input values from the node configuration
        state: Dictionary of all previous node outputs (keyed by node_id)
        edges: List of all edges in the workflow
        node_id: ID of the current node

    Returns:
        Dictionary of resolved input values
    """
    resolved = {}

    for input_name, input_value in node_inputs.items():
        # First, check if there's a direct edge connection to this input
        edge_value = get_edge_value(input_name, node_id, edges, state)

        if edge_value is not None:
            # Use value from connected edge
            logger.info(f"   🔗 Edge: {input_name} = {edge_value}")
            resolved[input_name] = edge_value
        elif isinstance(input_value, str):
            # Process string values for {{variable}} replacement
            resolved[input_name] = resolve_variables_in_string(
                input_value, node_id, edges, state
            )
        else:
            # Pass through other values unchanged
            resolved[input_name] = input_value

    # Special handling for model_parameters: merge edge-connected params
    if "model_parameters" in resolved:
        model_params = resolved["model_parameters"] if isinstance(resolved["model_parameters"], dict) else {}

        # Check for model parameter inputs connected via edges
        for edge in edges:
            if edge["target"] == node_id:
                target_handle = edge.get("targetHandle", "")
                # If target handle is a model parameter (not a standard input)
                if target_handle not in ["prompt", "model", "temperature", "output_type", "json_schema", "model_parameters"]:
                    # This is likely a model parameter
                    source_node_id = edge["source"]
                    source_handle = edge.get("sourceHandle", "response")

                    if source_node_id in state:
                        source_output = state[source_node_id]
                        value = None

                        if isinstance(source_output, dict) and source_handle in source_output:
                            value = source_output[source_handle]
                        elif isinstance(source_output, dict) and "response" in source_output:
                            value = source_output["response"]
                        elif isinstance(source_output, dict) and "output" in source_output:
                            value = source_output["output"]
                        else:
                            value = source_output

                        if value is not None:
                            model_params[target_handle] = value
                            logger.info(f"   🔗 Model param from edge: {target_handle} = {value}")

        resolved["model_parameters"] = model_params

    return resolved


def get_edge_value(
    input_name: str,
    node_id: str,
    edges: list[dict[str, Any]],
    state: dict[str, Any],
) -> Any:
    """
    Get value from a connected edge for a specific input.

    Args:
        input_name: Name of the input to look up
        node_id: ID of the current node
        edges: List of all edges in the workflow
        state: Dictionary of all previous node outputs

    Returns:
        Value from connected node, or None if no edge connection
    """
    # Find edges connecting to this node's input
    incoming_edges = [
        edge
        for edge in edges
        if edge["target"] == node_id and edge.get("targetHandle") == input_name
    ]

    if incoming_edges:
        # Get the source node output
        source_edge = incoming_edges[0]
        source_node_id = source_edge["source"]
        source_handle = source_edge.get("sourceHandle", "response")

        # Look up the output from the source node
        if source_node_id in state:
            source_output = state[source_node_id]

            # Get the specific output handle value
            if isinstance(source_output, dict) and source_handle in source_output:
                return source_output[source_handle]
            elif isinstance(source_output, dict) and "response" in source_output:
                return source_output["response"]
            elif isinstance(source_output, dict) and "output" in source_output:
                return source_output["output"]
            else:
                return str(source_output)

    return None


def resolve_variables_in_string(
    text: str,
    node_id: str,
    edges: list[dict[str, Any]],
    state: dict[str, Any],
) -> str:
    """
    Resolve {{variable}} placeholders in a string with actual values.

    Args:
        text: The text containing {{variable}} placeholders
        node_id: ID of the current node
        edges: List of all edges in the workflow
        state: Dictionary of all previous node outputs

    Returns:
        String with variables replaced by actual values
    """
    # Find all {{variable}} patterns
    pattern = r"\{\{([^}]+)\}\}"
    matches = re.finditer(pattern, text)

    resolved_text = text

    for match in matches:
        variable_name = match.group(1).strip()
        logger.debug(f"   🔍 Resolving variable: {{{{{variable_name}}}}}")

        # Find edges connecting to this node's input with name matching variable_name
        incoming_edges = [
            edge
            for edge in edges
            if edge["target"] == node_id and edge.get("targetHandle") == variable_name
        ]

        if incoming_edges:
            # Get the source node output
            source_edge = incoming_edges[0]
            source_node_id = source_edge["source"]
            source_handle = source_edge.get("sourceHandle", "response")

            # Look up the output from the source node
            if source_node_id in state:
                source_output = state[source_node_id]
                # Get the specific output handle value
                if isinstance(source_output, dict) and source_handle in source_output:
                    value = source_output[source_handle]
                elif isinstance(source_output, dict) and "response" in source_output:
                    value = source_output["response"]
                elif isinstance(source_output, dict) and "output" in source_output:
                    value = source_output["output"]
                else:
                    value = str(source_output)

                logger.info(
                    f"   ✅ Resolved {{{{{variable_name}}}}} -> '{str(value)[:100]}...'"
                )
                resolved_text = resolved_text.replace(
                    f"{{{{{variable_name}}}}}", str(value)
                )
            else:
                logger.warning(f"   ⚠️  Source node {source_node_id} has no output yet")
        else:
            logger.warning(f"   ⚠️  No connection found for variable: {variable_name}")

    return resolved_text
