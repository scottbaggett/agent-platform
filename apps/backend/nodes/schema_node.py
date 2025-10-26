"""
ProtoSchemaNode - Define JSON schemas for structured LLM output
"""

from collections.abc import AsyncGenerator
from typing import Any

from config.settings import logger
from nodes.base import BaseNode


class ProtoSchemaNode(BaseNode):
    """
    Schema node that outputs a JSON schema definition.
    Used to provide structured output schemas to agent nodes.
    """

    async def execute(
        self, state: dict[str, Any]
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Execute the schema node by outputting the configured schema.

        Args:
            state: Current workflow state (not used by this node)

        Yields:
            Dictionary with 'schema' key containing the schema definition
        """
        logger.info(f"🎯 Executing ProtoSchemaNode: {self.node_id}")

        # Get the schema definition from node inputs
        schema = self.node_inputs.get("schema_definition", {})

        result = {"schema": schema}
        logger.info(
            f"✅ ProtoSchemaNode complete: {schema.get('name', 'unnamed')} schema"
        )

        yield result
