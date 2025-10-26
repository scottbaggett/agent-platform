"""
ProtoAgentNode - LLM agent with streaming support
"""

import json
from collections.abc import AsyncGenerator
from typing import Any

from config.model_registry import MODEL_REGISTRY
from config.settings import logger
from llm.streaming import stream_llm_response
from nodes.base import BaseNode
from workflow.resolver import resolve_inputs


class ProtoAgentNode(BaseNode):
    """
    Agent node that calls an LLM with streaming support.
    Supports both text and structured JSON output.
    """

    async def execute(self, state: dict[str, Any]) -> AsyncGenerator[dict[str, Any], None]:
        """
        Execute the agent node by calling the LLM and streaming the response.

        Args:
            state: Current workflow state (all previous node outputs)

        Yields:
            Partial results during streaming, final result last
        """
        logger.info(f"🎯 Executing ProtoAgentNode: {self.node_id}")

        # Resolve inputs (handles {{variable}} replacement)
        resolved_inputs = resolve_inputs(self.node_inputs, state, self.edges, self.node_id)

        # Extract parameters
        prompt = resolved_inputs.get("prompt", "")
        model = resolved_inputs.get("model", "claude-haiku-4-5")
        output_type = resolved_inputs.get("output_type", "text")
        json_schema = resolved_inputs.get("json_schema", {})

        model_params_raw = resolved_inputs.get("model_parameters", {})
        if isinstance(model_params_raw, str):
            try:
                model_params = json.loads(model_params_raw)
            except json.JSONDecodeError:
                logger.warning("Malformed model_parameters JSON, defaulting to {}")
                model_params = {}
        else:
            model_params = model_params_raw

        llm_kwargs = model_params.copy()

        model_info = MODEL_REGISTRY.get(model)
        if model_info and not model_info.supports_temp:
            llm_kwargs.pop("temperature", None)
            logger.info(f"Temperature ignored for restricted model: {model}")
        elif model_info and model_info.provider == "anthropic":
            # Anthropic models don't allow both temperature and top_p
            # Temperature takes precedence, so remove top_p if present
            if "temperature" in llm_kwargs and "top_p" in llm_kwargs:
                llm_kwargs.pop("top_p")
                logger.debug("Removed top_p (mutually exclusive with temperature for Anthropic)")

        logger.debug(f"   Resolved prompt: '{prompt[:100]}...'")
        logger.info(f"   Model: {model}")
        logger.info(f"   Temperature: {llm_kwargs.get('temperature', 'not set')}")
        logger.info(f"   Output type: {output_type}")

        # Check if json_schema input has a direct connection from schema node
        schema_edges = [
            edge
            for edge in self.edges
            if edge["target"] == self.node_id and edge.get("targetHandle") == "json_schema"
        ]

        if schema_edges and not json_schema:
            # Get schema from connected schema node
            source_edge = schema_edges[0]
            source_node_id = source_edge["source"]
            source_handle = source_edge.get("sourceHandle", "schema")

            if source_node_id in state:
                source_output = state[source_node_id]
                if isinstance(source_output, dict) and source_handle in source_output:
                    json_schema = source_output[source_handle]
                elif isinstance(source_output, dict) and "schema" in source_output:
                    json_schema = source_output["schema"]
                logger.info(f"   📥 Loaded schema from connected node {source_node_id}")

        # Stream LLM response with real-time yielding
        accumulated = ""
        try:
            async for chunk in stream_llm_response(
                prompt, model, output_type, json_schema, **llm_kwargs
            ):
                accumulated += chunk
                logger.debug(f"📤 Streaming token: '{chunk}'")
                # Yield partial result for real-time streaming
                yield {"response": accumulated}
        except Exception as e:
            logger.error(f"❌ LLM Error: {e!s}")
            accumulated = f"Error: {e!s}"
            yield {"response": accumulated}
            return

        # Parse JSON output and extract properties if schema is used
        if output_type == "json":
            try:
                # Try to parse the JSON response
                parsed_json = json.loads(accumulated)
                # Store the full response
                result = {"response": accumulated}
                # Also add individual properties as separate outputs
                if isinstance(parsed_json, dict):
                    for key, value in parsed_json.items():
                        result[key] = value
                    logger.info(
                        f"✅ ProtoAgentNode complete: JSON with {len(parsed_json)} properties"
                    )
                else:
                    logger.info(f"✅ ProtoAgentNode complete: {len(accumulated)} chars")
            except json.JSONDecodeError:
                logger.warning("⚠️ Failed to parse JSON output, storing as text")
                result = {"response": accumulated}
                logger.info(f"✅ ProtoAgentNode complete: {len(accumulated)} chars")
        else:
            result = {"response": accumulated}
            logger.info(f"✅ ProtoAgentNode complete: {len(accumulated)} chars")

        # Yield final result
        yield result
