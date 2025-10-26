"""
LLM streaming functionality for OpenAI, Anthropic, and Google models
"""

import asyncio
import json as json_lib
from typing import Any, Optional

from langchain.schema import HumanMessage
from langchain_anthropic import ChatAnthropic
from langchain_openai import ChatOpenAI

from config.model_registry import MODEL_REGISTRY, ModelConfig
from config.settings import logger

try:
    from langchain_google_genai import ChatGoogleGenerativeAI
except ImportError:
    ChatGoogleGenerativeAI = None

# Default timeout for LLM requests (60 seconds)
LLM_TIMEOUT = 60


async def stream_llm_response(
    prompt: str,
    model: str,
    output_type: str = "text",
    json_schema: Optional[dict[str, Any]] = None,
    **kwargs,
):
    """
    Stream LLM response token by token
    Supports OpenAI, Anthropic, and Google models
    Handles both text and structured JSON output

    Args:
        prompt: The prompt to send to the LLM
        model: Model name (e.g., "gpt-4o", "claude-opus-4-20250514")
        output_type: Either "text" or "json"
        json_schema: Schema for structured JSON output (when output_type="json")
        **kwargs: Advanced parameters (temperature, top_k, max_tokens, etc.)

    Yields:
        String chunks of the LLM response
    """
    model_info: Optional[ModelConfig] = MODEL_REGISTRY.get(model)
    if not model_info:
        logger.error(f"Unknown model: {model}")
        yield f"Error: Unknown model {model}"
        return

    provider = model_info.provider
    logger.info(f"🤖 Initializing LLM: {model} ({provider})")
    logger.info(f"   Output type: {output_type}")
    if output_type == "json" and json_schema:
        logger.debug(f"   JSON schema: {json_schema}")

    try:
        llm_kwargs = {}
        for key, value in kwargs.items():
            if key in model_info.valid_params:
                param_spec = model_info.valid_params[key]
                if param_spec.get("type") == "float" and isinstance(value, str):
                    try:
                        value = float(value)
                    except ValueError:
                        logger.warning(f"Invalid {key}: {value}, skipping")
                        continue
                llm_kwargs[key] = value
            else:
                logger.warning(f"Invalid param for {model}: {key}")

        if provider == "openai":
            if not model_info.supports_temp:
                llm_kwargs.pop("temperature", None)
            llm = ChatOpenAI(model=model, streaming=True, **llm_kwargs)
            temp_display = llm_kwargs.get("temperature", "default (restricted)")
            logger.info(f"   LLM Temperature: {temp_display}")
        elif provider == "anthropic":
            llm = ChatAnthropic(model=model, **llm_kwargs)
            logger.info(f"   LLM Temperature: {llm_kwargs.get('temperature', 'default')}")
        elif provider == "google":
            if ChatGoogleGenerativeAI is None:
                logger.error("langchain-google-genai not installed")
                yield "Error: Google LLM support not installed"
                return
            llm_kwargs["conversion_mode"] = "CONTENT"
            llm = ChatGoogleGenerativeAI(model=model, streaming=True, **llm_kwargs)
            logger.info(f"   LLM Temperature: {llm_kwargs.get('temperature', 'default')}")
        else:
            raise ValueError(f"Unsupported provider: {provider}")

        logger.info(f"   LLM kwargs: {llm_kwargs}")

        if output_type == "json" and json_schema and json_schema.get("properties"):
            logger.info("🎯 Using structured output mode")

            schema = {
                "title": json_schema.get("name", "ResponseSchema"),
                "description": "Structured response matching the specified schema",
                "type": "object",
                "properties": json_schema["properties"],
                "required": list(json_schema["properties"].keys()),
            }

            logger.debug(f"   Schema: {schema}")

            structured_llm = llm.with_structured_output(schema)
            try:
                result = await asyncio.wait_for(
                    structured_llm.ainvoke([HumanMessage(content=prompt)]),
                    timeout=LLM_TIMEOUT,
                )

                json_str = json_lib.dumps(result, indent=2)
                yield json_str
            except asyncio.TimeoutError:
                logger.error(f"❌ LLM request timed out after {LLM_TIMEOUT}s")
                yield f"Error: Request timed out after {LLM_TIMEOUT} seconds"
        else:
            logger.info(f"📡 Starting text stream for prompt: '{prompt[:50]}...'")
            try:
                start_time = asyncio.get_event_loop().time()
                async for chunk in llm.astream([HumanMessage(content=prompt)]):
                    elapsed = asyncio.get_event_loop().time() - start_time
                    if elapsed > LLM_TIMEOUT:
                        logger.error(f"❌ LLM streaming timed out after {elapsed:.1f}s")
                        yield f"\n\nError: Streaming timed out after {LLM_TIMEOUT} seconds"
                        return

                    if hasattr(chunk, "content") and chunk.content:
                        yield chunk.content
            except asyncio.TimeoutError:
                logger.error(f"❌ LLM streaming timed out after {LLM_TIMEOUT}s")
                yield f"Error: Streaming timed out after {LLM_TIMEOUT} seconds"

    except asyncio.TimeoutError:
        logger.error(f"❌ LLM request timed out after {LLM_TIMEOUT}s")
        yield f"Error: Request timed out after {LLM_TIMEOUT} seconds"
    except Exception as e:
        logger.error(f"❌ Streaming error: {e!s}")
        yield f"Error: {e!s}"
