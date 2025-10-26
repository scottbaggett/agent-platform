"""
Node definitions for the frontend UI
These define what nodes are available and how they appear in the UI
"""

from config.model_registry import MODEL_REGISTRY

EXPERIMENTAL_NODES = {
    "ProtoAgentNode": {
        "name": "ProtoAgentNode",
        "display_name": "Agent",
        "category": "experimental",
        "short_description": "LangGraph agent with LLM and tools",
        "icon": "brain",
        "inputs": [
            {
                "name": "prompt",
                "type": "STRING",
                "widget": {
                    "widgetType": "DYNAMIC_STRING",
                    "parameters": {
                        "multiline": True,
                        "placeholder": "Enter your prompt with {{variables}}...",
                    },
                },
            },
            {
                "name": "model",
                "type": "STRING",
                "widget": {
                    "widgetType": "COMBO",
                    "options": list(MODEL_REGISTRY.keys()),
                },
            },
            {
                "name": "temperature",
                "type": "FLOAT",
                "widget": {
                    "widgetType": "SLIDER",
                    "parameters": {
                        "min": 0.0,
                        "max": 2.0,
                        "step": 0.1,
                    },
                },
                "default": 0.7,
            },
            {
                "name": "output_type",
                "type": "STRING",
                "widget": {
                    "widgetType": "COMBO",
                    "options": ["text", "json"],
                },
                "default": "text",
            },
            {
                "name": "json_schema",
                "type": "JSON",
                "widget": {
                    "widgetType": "JSON_SCHEMA",
                },
                "default": None,
            },
            {
                "name": "model_parameters",
                "display_name": "Advanced Parameters",
                "type": "JSON",
                "widget": {
                    "widgetType": "JSON_EDITOR",
                    "parameters": {
                        "placeholder": '{\n  "top_k": 40,\n  "max_tokens": 1024\n}',
                        "tooltip": "Provider-specific params (e.g., top_k for Anthropic, max_output_tokens for Google)",
                    },
                },
                "default": {},
            },
        ],
        "outputs": [
            {"name": "response", "type": "STRING"},
        ],
        "widgets": [],
    },
    "ProtoOutputNode": {
        "name": "ProtoOutputNode",
        "display_name": "Output Viewer",
        "category": "output",
        "short_description": "Displays streaming output from connected nodes",
        "icon": "monitor",
        "inputs": [
            {
                "name": "content",
                "type": "STRING",
            }
        ],
        "outputs": [],
        "widgets": [],
    },
    "ProtoSchemaNode": {
        "name": "ProtoSchemaNode",
        "display_name": "JSON Schema",
        "category": "data",
        "short_description": "Define reusable JSON schema for structured LLM output",
        "icon": "braces",
        "inputs": [
            {
                "name": "schema_definition",
                "type": "JSON",
                "widget": {
                    "widgetType": "JSON_SCHEMA",
                },
                "default": {},
            }
        ],
        "outputs": [
            {"name": "schema", "type": "JSON"},
        ],
        "widgets": [],
    },
    "ProtoDynamicTextNode": {
        "name": "ProtoDynamicTextNode",
        "display_name": "Dynamic Text",
        "category": "text",
        "short_description": "Compose text with variable interpolation using {{variable}} syntax",
        "icon": "type",
        "inputs": [
            {
                "name": "text",
                "type": "STRING",
                "widget": {
                    "widgetType": "DYNAMIC_STRING",
                    "parameters": {
                        "multiline": True,
                        "placeholder": "Enter text with {{variables}}...",
                    },
                },
                "default": "",
            }
        ],
        "outputs": [
            {"name": "output", "type": "STRING"},
        ],
        "widgets": [],
    },
}
