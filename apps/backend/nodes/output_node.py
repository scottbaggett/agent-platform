"""
ProtoOutputNode - Displays output from connected nodes
"""

from collections.abc import AsyncGenerator
from typing import Any

from config.settings import logger
from nodes.base import BaseNode


class ProtoOutputNode(BaseNode):
    """
    Output node that displays content from connected nodes.
    This node doesn't produce output itself, it just receives and displays.
    """

    async def execute(
        self, state: dict[str, Any]
    ) -> AsyncGenerator[dict[str, Any], None]:
        """
        Execute the output node by gathering content from connected nodes.

        Args:
            state: Current workflow state (all previous node outputs)

        Yields:
            Dictionary with 'content' key containing the connected value
        """
        logger.info(f"🎯 Executing ProtoOutputNode: {self.node_id}")

        # Find the edge connecting to this output node
        content = ""
        for edge in self.edges:
            if edge["target"] == self.node_id:
                source_node_id = edge["source"]
                source_handle = edge.get("sourceHandle", "output")
                target_handle = edge.get("targetHandle", "content")

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
                        content = str(source_output[source_handle])
                        logger.info(
                            f"   ✅ Found value in source_output[{source_handle}]: '{content[:100]}'"
                        )
                    elif (
                        isinstance(source_output, dict) and "response" in source_output
                    ):
                        content = str(source_output["response"])
                        logger.info(
                            f"   ✅ Found value in source_output['response']: '{content[:100]}'"
                        )
                    elif isinstance(source_output, dict) and "output" in source_output:
                        content = str(source_output["output"])
                        logger.info(
                            f"   ✅ Found value in source_output['output']: '{content[:100]}'"
                        )
                    else:
                        content = str(source_output)
                        logger.info(f"   ⚠️ Using str(source_output): '{content[:100]}'")
                    break
                else:
                    logger.warning(
                        f"   ⚠️ Source node {source_node_id} not in state yet"
                    )

        result = {"content": content}
        logger.info(f"✅ ProtoOutputNode complete: {len(content)} characters")

        yield result
