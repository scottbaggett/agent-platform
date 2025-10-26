# Task: 002 Implement Model Registry for Advanced LLM Configuration

**Date:** 2025-10-25
**Status:** To Do
**Priority:** High
**Assignee:** (unassigned)
**Updates:** Incorporated feedback from SB-AI-GROK review (2025-10-25). Key integrations: Pydantic validation for registry entries; expanded model config with `valid_params`; type coercion and `supports_temp` enforcement in agent node; provider-specific hooks (e.g., Google streaming); enhanced error surfacing and testing criteria. Estimated effort: +10-15 lines for validation, no major scope creep.

## Problem Statement

The current ProtoAgentNode and llm/streaming.py implementation is too rigid:

1. **Fragile Provider Logic**: llm/streaming.py relies on if "gpt" in model.lower() to determine the provider, which is brittle and unscalable.

2. **Hard-Coded Parameters**: The ProtoAgentNode UI only supports temperature. It cannot pass other critical parameters like top_k, top_p, or max_tokens.

3. **Inflexible Restrictions**: We have no way to enforce model-specific rules, such as gpt-5 not supporting temperature changes.

This makes it difficult to add new models (like Google's Gemini) or properly support the advanced features of existing models.

## Goals

1. **Centralize Model Metadata**: Create a single source of truth (MODEL_REGISTRY) that defines every supported model, its provider, and its capabilities (e.g., supports_temp, valid_params for filtering/validation).

2. **Decouple Logic**: Refactor llm/streaming.py to use the registry, eliminating all string-matching logic.

3. **Enable Advanced Configuration**: Allow users to pass a generic JSON object of advanced parameters (top_k, max_tokens, etc.) from the ProtoAgentNode, with runtime validation and type coercion.

4. **Maintain Simplicity**: The simple temperature slider should still work and override any temperature setting in the advanced JSON for ease of use.

## Proposed Solution

### 1. Create config/model_registry.py

This file will be the new single source of truth for all model information, using Pydantic for validation and extensibility.

```python
# config/model_registry.py
from pydantic import BaseModel, Field
from typing import Dict, Any, Optional

class ModelConfig(BaseModel):
    provider: str
    supports_temp: bool
    valid_params: Optional[Dict[str, Dict[str, Any]]] = Field(default_factory=dict)  # e.g., {"temperature": {"type": "float", "range": [0, 2]}}

MODEL_REGISTRY: Dict[str, ModelConfig] = {
    # OpenAI
    "gpt-4o": ModelConfig(
        provider="openai",
        supports_temp=True,
        valid_params={"temperature": {"type": "float", "range": [0, 2]}, "max_tokens": {"type": "int", "min": 1}}
    ),
    "gpt-5": ModelConfig(
        provider="openai",
        supports_temp=False,  # Enforces restriction
        valid_params={"max_tokens": {"type": "int", "min": 1}}
    ),

    # Anthropic
    "claude-3-5-sonnet-20240620": ModelConfig(
        provider="anthropic",
        supports_temp=True,
        valid_params={"temperature": {"type": "float", "range": [0, 1]}, "top_k": {"type": "int", "min": 1}, "top_p": {"type": "float", "range": [0, 1]}}
    ),

    # Google
    "gemini-1.5-pro-latest": ModelConfig(
        provider="google",
        supports_temp=True,
        valid_params={"temperature": {"type": "float", "range": [0, 1]}, "max_output_tokens": {"type": "int", "min": 1}, "top_k": {"type": "int", "min": 1}}
    )
}
```

### 2. Refactor llm/streaming.py

Update stream_llm_response to accept **kwargs, use the registry for provider selection and param filtering/validation, and include provider-specific hooks. Add error yielding for graceful failures.

```python
# llm/streaming.py
from config.model_registry import MODEL_REGISTRY, ModelConfig
from langchain_google_genai import ChatGoogleGenerativeAI  # Add
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain.schema import HumanMessage
from config.settings import logger
import json

async def stream_llm_response(
    prompt: str,
    model: str,
    output_type: str = "text",
    json_schema: dict = None,
    **kwargs,  # Accept advanced parameters
):
    model_info: Optional[ModelConfig] = MODEL_REGISTRY.get(model)
    if not model_info:
        logger.error(f"Unknown model: {model}")
        yield f"Error: Unknown model {model}"
        return

    provider = model_info.provider
    logger.info(f"🤖 Initializing LLM: {model} ({provider})")

    # Validate and filter kwargs against valid_params
    llm_kwargs = {}
    for key, value in kwargs.items():
        if key in model_info.valid_params:
            param_spec = model_info.valid_params[key]
            # Type coercion and range check (basic; expand as needed)
            if param_spec.get("type") == "float" and isinstance(value, str):
                try:
                    value = float(value)
                except ValueError:
                    logger.warning(f"Invalid {key}: {value}, skipping")
                    continue
            # Add range/min checks here if needed
            llm_kwargs[key] = value
        else:
            logger.warning(f"Invalid param for {model}: {key}")

    # Provider-specific setup
    try:
        if provider == "openai":
            if not model_info.supports_temp:
                llm_kwargs.pop("temperature", None)
            llm = ChatOpenAI(model=model, streaming=True, **llm_kwargs)
        elif provider == "anthropic":
            llm = ChatAnthropic(model=model, **llm_kwargs)
        elif provider == "google":
            llm_kwargs["conversion"] = "streaming"  # Gemini-specific hook
            llm = ChatGoogleGenerativeAI(model=model, streaming=True, **llm_kwargs)
        else:
            raise ValueError(f"Unsupported provider: {provider}")

        logger.info(f" LLM kwargs: {llm_kwargs}")

        # Handle structured output (propagate kwargs where supported)
        if output_type == "json" and json_schema and json_schema.get("properties"):
            logger.info("🎯 Using structured output mode")
            schema = {
                "title": json_schema.get("name", "ResponseSchema"),
                "description": "Structured response matching the specified schema",
                "type": "object",
                "properties": json_schema["properties"],
                "required": list(json_schema["properties"].keys()),
            }
            structured_llm = llm.with_structured_output(schema)
            result = await structured_llm.ainvoke([HumanMessage(content=prompt)])
            import json as json_lib
            json_str = json_lib.dumps(result, indent=2)
            yield json_str
        else:
            # Regular text streaming
            logger.info(f"📡 Starting text stream for prompt: '{prompt[:50]}...'")
            async for chunk in llm.astream([HumanMessage(content=prompt)]):
                if hasattr(chunk, "content") and chunk.content:
                    yield chunk.content

    except Exception as e:
        logger.error(f"❌ Streaming error: {str(e)}")
        yield f"Error: {str(e)}"
```

### 3. Update config/node_definitions.py

Add a new model_parameters JSON input to the ProtoAgentNode.

```python
# config/node_definitions.py - inside "ProtoAgentNode"
"inputs": [
    # ... (prompt, model, temperature, output_type, json_schema) ...
    {
        "name": "model_parameters",
        "display_name": "Advanced Parameters",
        "type": "JSON",
        "widget": {
            "widgetType": "JSON_EDITOR",  # Or fallback to "JSON_SCHEMA" if frontend lacks support
            "parameters": {
                "placeholder": "{\n  \"top_k\": 40,\n  \"max_tokens\": 1024\n}",
                "tooltip": "Provider-specific params (e.g., top_k for Anthropic, max_output_tokens for Google)"
            },
        },
        "default": {},
    },
],
```

### 4. Update nodes/agent_node.py

Modify the execute method to collect all parameters, apply type coercion, enforce restrictions, and pass them as **kwargs.

```python
# nodes/agent_node.py
import json
from typing import Dict, Any
from nodes.base import BaseNode
from llm.streaming import stream_llm_response
from workflow.resolver import resolve_inputs
from config.model_registry import MODEL_REGISTRY
from config.settings import logger

class ProtoAgentNode(BaseNode):
    async def execute(self, state: Dict[str, Any]) -> Dict[str, Any]:
        # ... (logging, resolving inputs) ...

        prompt = resolved_inputs.get("prompt", "")
        model = resolved_inputs.get("model", "gpt-4")
        temperature = resolved_inputs.get("temperature", 0.7)
        output_type = resolved_inputs.get("output_type", "text")
        json_schema = resolved_inputs.get("json_schema", {})

        # --- NEW LOGIC ---
        # Start with advanced parameters from the JSON editor (coerce if str)
        model_params_raw = resolved_inputs.get("model_parameters", {})
        if isinstance(model_params_raw, str):
            try:
                model_params = json.loads(model_params_raw)
            except json.JSONDecodeError:
                logger.warning("Malformed model_parameters JSON, defaulting to {}")
                model_params = {}
        else:
            model_params = model_params_raw

        # Override with the simple 'temperature' slider for convenience
        llm_kwargs = model_params.copy()
        llm_kwargs["temperature"] = temperature

        # Enforce model-specific restrictions post-merge
        model_info = MODEL_REGISTRY.get(model)
        if model_info and not model_info.supports_temp:
            llm_kwargs.pop("temperature", None)
            logger.info(f"Temperature ignored for restricted model: {model}")
        # --- END NEW LOGIC ---

        # ... (logic for loading connected json_schema) ...

        # Stream LLM response
        accumulated = ""
        try:
            async for chunk in stream_llm_response(
                prompt,
                model,
                output_type,
                json_schema,
                **llm_kwargs,  # Pass all parameters
            ):
                accumulated += chunk
                logger.debug(f"📤 Streaming token: '{chunk}'")
                # Note: Streaming to output nodes is now handled by the executor
        except Exception as e:
            logger.error(f"❌ LLM Error: {str(e)}")
            accumulated = f"Error: {str(e)}"

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
                    logger.info(f"✅ ProtoAgentNode complete: JSON with {len(parsed_json)} properties")
                else:
                    logger.info(f"✅ ProtoAgentNode complete: {len(accumulated)} chars")
            except json.JSONDecodeError:
                logger.warning(f"⚠️ Failed to parse JSON output, storing as text")
                result = {"response": accumulated}
                logger.info(f"✅ ProtoAgentNode complete: {len(accumulated)} chars")
        else:
            result = {"response": accumulated}
            logger.info(f"✅ ProtoAgentNode complete: {len(accumulated)} chars")

        return result
```

## Implementation Plan

- [ ] Create config/model_registry.py: Add the MODEL_REGISTRY dict with initial OpenAI, Anthropic, and Google models (seed with 5-10 real 2025 models, e.g., claude-3.5-sonnet-20241022).

- [ ] Update llm/streaming.py:
  - [ ] Import MODEL_REGISTRY, ModelConfig, and ChatGoogleGenerativeAI (with ImportError guard).
  - [ ] Change function signature to accept **kwargs.
  - [ ] Replace if "gpt" in model logic with provider lookup and param validation/filtering.
  - [ ] Implement if/elif blocks for openai, anthropic, and google, including parameter filtering and provider hooks (e.g., conversion="streaming" for Google).
  - [ ] Add logic to check model_info.supports_temp and yield errors as chunks.

- [ ] Update config/node_definitions.py:
  - [ ] Add the model_parameters JSON_EDITOR input to ProtoAgentNode (with tooltip).

- [ ] Update nodes/agent_node.py:
  - [ ] Get model_parameters from resolved_inputs and apply JSON coercion.
  - [ ] Create llm_kwargs dict, merge temperature, and enforce supports_temp post-merge.
  - [ ] Pass **llm_kwargs to stream_llm_response.

- [ ] Update requirements.txt:
  - [ ] Pin langchain-google-genai==0.3.0 for stability.

- [ ] (Optional) Add YAML loading for MODEL_REGISTRY (e.g., from env file) for hot-reloading.

## Success Criteria

- [ ] Backward Compatibility: All existing workflows execute as before.

- [ ] Advanced Params: Executing with gemini-1.5-pro-latest and {"top_k": 5} in model_parameters works (check logs for filtered kwargs).

- [ ] Parameter Override: Setting temperature: 0.2 on the node slider correctly overrides any temperature in the JSON.

- [ ] Parameter Restriction: gpt-5 (as defined in the registry) ignores the temperature setting.

- [ ] Validation: Invalid JSON in model_parameters defaults to {} without crash; unknown params logged but skipped.

- [ ] Clean Code: llm/streaming.py contains no if "gpt" in ... logic.

- [ ] Error Handling: Unknown model yields error chunk in stream, not exception.

## Benefits

- **Scalable**: Adding new models or providers is now trivial (often one line in the registry + optional provider block).

- **Maintainable**: Provider-specific logic is centralized in one place (llm/streaming.py); Pydantic ensures config integrity.

- **Powerful**: Users unlock the full potential of every model (top_k, top_p, etc.), with validation preventing misconfigs.

- **Flexible**: We can easily enforce rules (like disabling temp) for specific models, plus future hooks (e.g., cost estimates in valid_params).

- **Robust**: Type coercion and error yielding make it prod-ready, reducing silent failures.
