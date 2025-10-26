"""
ProtoDynamicTextNode - Compose text with variable interpolation
"""

import re
from collections.abc import AsyncGenerator
from typing import Any

from config.settings import logger
from nodes.base import BaseNode


class ProtoDynamicTextNode(BaseNode):
    """
    Dynamic text node that interpolates variables from connected nodes.
    Uses {{variable}} syntax where variable names match input handle names.
    """

    async def execute(
        self, state: dict[str, Any]
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Execute the dynamic text node by interpolating variables.

        Args:
            state: Current workflow state (all previous node outputs)

        Yields:
            Dictionary with 'output' key containing the interpolated text
        """
        logger.info(f"🎯 Executing ProtoDynamicTextNode: {self.node_id}")

        # Get the text template
        text_template = self.node_inputs.get("text", "")
        logger.info(f"   📝 Template: '{text_template}'")

        # Collect values from all connected inputs
        variable_values = {}
        for edge in self.edges:
            if edge["target"] == self.node_id:
                source_node_id = edge["source"]
                source_handle = edge.get("sourceHandle", "output")
                target_handle = edge.get("targetHandle", "")

                logger.info(
                    f"   🔗 Edge: {source_node_id}[{source_handle}] → {target_handle}"
                )

                if source_node_id in state:
                    source_output = state[source_node_id]
                    logger.info(
                        f"   💾 Source output keys: {list(source_output.keys()) if isinstance(source_output, dict) else 'not a dict'}"
                    )

                    # Get the value from the source output
                    if (
                        isinstance(source_output, dict)
                        and source_handle in source_output
                    ):
                        value = source_output[source_handle]
                        logger.info(
                            f"   ✅ Found value in source_output[{source_handle}]"
                        )
                    elif (
                        isinstance(source_output, dict) and "response" in source_output
                    ):
                        value = source_output["response"]
                        logger.info("   ✅ Found value in source_output['response']")
                    elif isinstance(source_output, dict) and "output" in source_output:
                        value = source_output["output"]
                        logger.info("   ✅ Found value in source_output['output']")
                    else:
                        value = str(source_output)
                        logger.info("   ⚠️ Using str(source_output)")

                    # Store with the target handle name as the variable name
                    if target_handle:
                        variable_values[target_handle] = value
                        logger.info(
                            f"   📥 Stored variable '{target_handle}' = '{str(value)[:100]}'"
                        )
                else:
                    logger.warning(
                        f"   ⚠️ Source node {source_node_id} not in state yet"
                    )

        logger.info(f"   🗂️ Collected variables: {list(variable_values.keys())}")

        # Replace {{variable}} with values from connected nodes
        output_text = text_template
        for match in re.finditer(r"\{\{([^}]+)\}\}", text_template):
            variable_name = match.group(1).strip()
            # Get value from collected variable values
            variable_value = variable_values.get(
                variable_name, f"{{{{missing: {variable_name}}}}}"
            )
            logger.info(
                f"   🔄 Replacing {{{{{variable_name}}}}} with '{str(variable_value)[:50]}'"
            )
            output_text = output_text.replace(match.group(0), str(variable_value))

        logger.info(f"   📤 Final output: '{output_text}'")
        result = {"output": output_text}
        logger.info(f"✅ ProtoDynamicTextNode complete: {len(output_text)} characters")

        yield result
