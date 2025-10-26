from typing import Any, Optional

from pydantic import BaseModel, Field


class ModelConfig(BaseModel):
    provider: str
    supports_temp: bool
    valid_params: Optional[dict[str, dict[str, Any]]] = Field(default_factory=dict)


MODEL_REGISTRY: dict[str, ModelConfig] = {
    # OpenAI GPT‑5 series
    "gpt-5": ModelConfig(
        provider="openai",
        supports_temp=False,
        valid_params={
            "max_completion_tokens": {"type": "int", "min": 1, "max": 8192, "default": 2048},
            "reasoning_effort": {
                "type": "enum",
                "values": ["minimal", "low", "medium", "high"],
                "default": "medium",
            },
            "verbosity": {"type": "enum", "values": ["low", "medium", "high"], "default": "medium"},
            "reasoning_summary": {
                "type": "enum",
                "values": ["auto", "concise", "detailed"],
                "default": "auto",
            },
        },
    ),
    "gpt-5-pro": ModelConfig(
        provider="openai",
        supports_temp=False,
        valid_params={
            "max_completion_tokens": {"type": "int", "min": 1, "max": 16384, "default": 4096},
            "reasoning_effort": {"type": "enum", "values": ["high"], "default": "high"},
            "verbosity": {"type": "enum", "values": ["low", "medium", "high"], "default": "medium"},
            "preamble": {"type": "bool", "default": False},
        },
    ),
    "gpt-5-codex": ModelConfig(
        provider="openai",
        supports_temp=False,
        valid_params={
            "max_completion_tokens": {"type": "int", "min": 1, "max": 8192, "default": 2048},
            "reasoning_effort": {
                "type": "enum",
                "values": ["low", "medium", "high"],
                "default": "medium",
            },
            "verbosity": {"type": "enum", "values": ["low", "medium", "high"], "default": "medium"},
        },
    ),
    "gpt-5-mini": ModelConfig(
        provider="openai",
        supports_temp=False,
        valid_params={
            "max_completion_tokens": {"type": "int", "min": 1, "max": 4096, "default": 1024},
            "reasoning_effort": {
                "type": "enum",
                "values": ["minimal", "low", "medium"],
                "default": "low",
            },
            "verbosity": {"type": "enum", "values": ["low", "medium", "high"], "default": "medium"},
        },
    ),
    "gpt-5-nano": ModelConfig(
        provider="openai",
        supports_temp=False,
        valid_params={
            "max_completion_tokens": {"type": "int", "min": 1, "max": 2048, "default": 512},
            "reasoning_effort": {
                "type": "enum",
                "values": ["minimal", "low"],
                "default": "minimal",
            },
            "verbosity": {"type": "enum", "values": ["low", "medium"], "default": "medium"},
        },
    ),
    # OpenAI O-series
    "o3-pro": ModelConfig(
        provider="openai",
        supports_temp=False,
        valid_params={
            "max_completion_tokens": {"type": "int", "min": 1, "max": 8192, "default": 2048},
            "reasoning_effort": {
                "type": "enum",
                "values": ["low", "medium", "high"],
                "default": "medium",
            },
        },
    ),
    "o3-mini": ModelConfig(
        provider="openai",
        supports_temp=False,
        valid_params={
            "max_completion_tokens": {"type": "int", "min": 1, "max": 4096, "default": 1024},
            "reasoning_effort": {"type": "enum", "values": ["low", "medium"], "default": "low"},
        },
    ),
    "o4-mini": ModelConfig(
        provider="openai",
        supports_temp=False,
        valid_params={
            "max_completion_tokens": {"type": "int", "min": 1, "max": 4096, "default": 1024},
            "reasoning_effort": {
                "type": "enum",
                "values": ["low", "medium", "high"],
                "default": "medium",
            },
        },
    ),
    # Anthropic Claude 4.5 series
    "claude-opus-4-1": ModelConfig(
        provider="anthropic",
        supports_temp=True,
        valid_params={
            "temperature": {"type": "float", "range": [0, 1], "default": 0.5},
            "top_p": {"type": "float", "range": [0, 1], "default": 0.9},
            "max_tokens": {"type": "int", "min": 1, "max": 8192, "default": 2048},
            "top_k": {"type": "int", "min": 1, "max": 500, "default": 5},
        },
    ),
    "claude-sonnet-4-5": ModelConfig(
        provider="anthropic",
        supports_temp=True,
        valid_params={
            "temperature": {"type": "float", "range": [0, 1], "default": 0.5},
            "top_p": {"type": "float", "range": [0, 1], "default": 0.9},
            "top_k": {"type": "int", "min": 1, "max": 500, "default": 5},
            "max_tokens": {"type": "int", "min": 1, "max": 8192, "default": 1024},
        },
    ),
    "claude-haiku-4-5": ModelConfig(
        provider="anthropic",
        supports_temp=True,
        valid_params={
            "temperature": {"type": "float", "range": [0, 1], "default": 0.5},
            "top_p": {"type": "float", "range": [0, 1], "default": 0.9},
            "top_k": {"type": "int", "min": 1, "max": 500, "default": 5},
            "max_tokens": {"type": "int", "min": 1, "max": 4096, "default": 512},
        },
    ),
    # Google Gemini 2.5 series
    "gemini-2.5-pro": ModelConfig(
        provider="google",
        supports_temp=True,
        valid_params={
            "temperature": {"type": "float", "range": [0.0, 2.0], "default": 1.0},
            "top_p": {"type": "float", "range": [0.0, 1.0], "default": 0.95},
            "top_k": {"type": "int", "min": 1, "max": 40, "default": 20},
            "max_output_tokens": {"type": "int", "min": 1, "max": 8192, "default": 500},
            "frequency_penalty": {"type": "float", "range": [-2.0, 2.0], "default": 0.0},
            "presence_penalty": {"type": "float", "range": [-2.0, 2.0], "default": 0.0},
            # Note: Optional params below are skipped in UI for now
            # "seed": {"type": "int", "optional": True, "default": None},
            # "stop_sequences": {"type": "list[str]", "optional": True, "default": []},
            # "logprobs": {"type": "int", "range": [1, 20], "optional": True, "default": None},
            # "response_logprobs": {"type": "bool", "optional": True, "default": False},
        },
    ),
    "gemini-2.5-flash": ModelConfig(
        provider="google",
        supports_temp=True,
        valid_params={
            "temperature": {"type": "float", "range": [0.0, 2.0], "default": 1.0},
            "top_p": {"type": "float", "range": [0.0, 1.0], "default": 0.95},
            "top_k": {"type": "int", "min": 1, "max": 40, "default": 20},
            "max_output_tokens": {"type": "int", "min": 1, "max": 8192, "default": 500},
            "frequency_penalty": {"type": "float", "range": [-2.0, 2.0], "default": 0.0},
            "presence_penalty": {"type": "float", "range": [-2.0, 2.0], "default": 0.0},
            # Note: Optional params below are skipped in UI for now
            # "seed": {"type": "int", "optional": True, "default": None},
            # "stop_sequences": {"type": "list[str]", "optional": True, "default": []},
        },
    ),
    "gemini-2.5-flash-lite": ModelConfig(
        provider="google",
        supports_temp=True,
        valid_params={
            "temperature": {"type": "float", "range": [0.0, 2.0], "default": 1.0},
            "top_p": {"type": "float", "range": [0.0, 1.0], "default": 0.9},
            "top_k": {"type": "int", "min": 1, "max": 40, "default": 20},
            "max_output_tokens": {"type": "int", "min": 1, "max": 8192, "default": 500},
            "frequency_penalty": {"type": "float", "range": [-2.0, 2.0], "default": 0.0},
            "presence_penalty": {"type": "float", "range": [-2.0, 2.0], "default": 0.0},
            # Note: Optional params below are skipped in UI for now
            # "seed": {"type": "int", "optional": True, "default": None},
        },
    ),
    "gemini-2.5-flash-native-audio": ModelConfig(
        provider="google",
        supports_temp=True,
        valid_params={
            "temperature": {"type": "float", "range": [0.0, 2.0], "default": 1.0},
            "top_p": {"type": "float", "range": [0.0, 1.0], "default": 0.95},
            "top_k": {"type": "int", "min": 1, "max": 40, "default": 20},
            "max_output_tokens": {"type": "int", "min": 1, "max": 8192, "default": 500},
        },
    ),
}
