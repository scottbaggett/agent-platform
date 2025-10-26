"""
Node classes for workflow execution
"""

from nodes.agent_node import ProtoAgentNode
from nodes.base import BaseNode
from nodes.dynamic_text_node import ProtoDynamicTextNode
from nodes.output_node import ProtoOutputNode
from nodes.schema_node import ProtoSchemaNode

# Map node type names to their classes
NODE_REGISTRY = {
    "ProtoAgentNode": ProtoAgentNode,
    "ProtoOutputNode": ProtoOutputNode,
    "ProtoSchemaNode": ProtoSchemaNode,
    "ProtoDynamicTextNode": ProtoDynamicTextNode,
}

__all__ = [
    "NODE_REGISTRY",
    "BaseNode",
    "ProtoAgentNode",
    "ProtoDynamicTextNode",
    "ProtoOutputNode",
    "ProtoSchemaNode",
]
