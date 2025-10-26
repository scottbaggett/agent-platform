# Agent Backend

A FastAPI-based execution server for prototyping LangGraph workflows with support for multiple LLM providers (OpenAI, Anthropic, Google).

## Features

- **Multi-LLM Support**: OpenAI, Anthropic Claude, Google Gemini
- **Model Registry**: Dynamic model capabilities and parameter validation
- **Streaming Execution**: Server-Sent Events for real-time workflow progress
- **Node System**: Extensible node architecture
- **Type Safety**: Full Pydantic validation and mypy support
- **Code Quality**: Ruff linting and formatting

## Quick Start

### 1. Environment Setup

Create and activate virtual environment:

```bash
# Create venv (first time only)
python3 -m venv venv

# Activate venv
# Bash/Zsh:
source venv/bin/activate
# Fish:
source venv/bin/activate.fish

# Upgrade pip
python -m pip install --upgrade pip

# Install dependencies
pip install -r requirements.txt

# Install dev dependencies (for linting/type checking)
pip install -r requirements-dev.txt
```

### 2. Configuration

Create a `.env` file in the backend directory:

```bash
# API Keys
OPENAI_API_KEY=your_openai_key
ANTHROPIC_API_KEY=your_anthropic_key
GOOGLE_API_KEY=your_google_key

# CORS (optional, defaults to localhost:3000)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

### 3. Run Server

```bash
python main.py
```

Server runs at: **http://localhost:8001**

API docs: **http://localhost:8001/docs**

## API Endpoints

### `GET /`
Service status and available endpoints.

### `GET /nodes`
Returns available node definitions for the frontend.

**Response:**
```json
{
  "nodes": [
    {
      "name": "ProtoAgentNode",
      "display_name": "Agent",
      "category": "agents",
      "short_description": "LLM agent with configurable model and parameters",
      "inputs": [...],
      "outputs": [...]
    }
  ]
}
```

### `GET /models`
Returns model registry with capabilities and valid parameters for each model.

**Response:**
```json
{
  "models": {
    "gpt-4o": {
      "provider": "openai",
      "supports_temp": true,
      "valid_params": {
        "temperature": {"type": "float", "range": [0, 2]},
        "max_tokens": {"type": "int", "min": 1}
      }
    },
    "claude-opus-4-20250514": {
      "provider": "anthropic",
      "supports_temp": true,
      "valid_params": {
        "temperature": {"type": "float", "range": [0, 1]},
        "top_k": {"type": "int", "min": 1},
        "top_p": {"type": "float", "range": [0, 1]},
        "max_tokens": {"type": "int", "min": 1}
      }
    }
  }
}
```

### `POST /execute`
Executes a workflow and streams progress via Server-Sent Events.

**Request:**
```json
{
  "nodes": {
    "agent_1": {
      "id": "agent_1",
      "data": {
        "nodeType": "ProtoAgentNode",
        "nodeInputs": {
          "model": "gpt-4o",
          "prompt": "Hello, {{input}}!",
          "temperature": 0.7,
          "output_type": "text"
        }
      }
    }
  },
  "edges": [
    {
      "source": "node_1",
      "target": "agent_1",
      "sourceHandle": "output",
      "targetHandle": "input"
    }
  ]
}
```

**SSE Events:**
- `workflow_start` - Execution begins
- `node_start` - Node execution starting
- `node_progress` - Progress updates
- `node_stream` - Streaming content (LLM responses)
- `node_complete` - Node finished with output
- `node_error` - Node encountered error
- `workflow_complete` - Workflow finished

## Architecture

```
backend/
├── config/
│   ├── node_definitions.py  # Node schemas and configurations
│   ├── model_registry.py    # LLM model capabilities
│   └── settings.py          # Environment and logging config
├── nodes/
│   ├── base_node.py         # Abstract base class for nodes
│   ├── agent_node.py        # LLM agent node implementation
│   ├── schema_node.py       # JSON schema node
│   └── output_node.py       # Workflow output node
├── llm/
│   └── streaming.py         # LLM provider streaming logic
├── workflow/
│   └── executor.py          # Workflow execution engine
├── schemas.py               # Pydantic request/response models
└── main.py                  # FastAPI application
```

## Available Nodes

### ProtoAgentNode
LLM-powered agent with configurable model and parameters.

**Inputs:**
- `prompt` - Dynamic string with variable substitution (e.g., `{{input}}`)
- `model` - Model selection (gpt-4o, claude-opus-4, etc.)
- `temperature` - Creativity control (range varies by model)
- `output_type` - Text or structured JSON output
- `json_schema` - JSON Schema for structured output validation
- `model_parameters` - Advanced parameters (top_k, top_p, max_tokens)

### ProtoSchemaNode
Defines JSON schemas for structured output validation.

**Inputs:**
- `json_schema` - JSON Schema definition

### ProtoOutputNode
Captures workflow output values.

**Inputs:**
- `output_value` - Value to capture from workflow

## Development

### Linting & Type Checking

```bash
# Run all checks
make check

# Auto-fix and format
make fix

# Individual commands
make lint       # Ruff linter
make format     # Ruff formatter
make typecheck  # Mypy type checker
```

### Code Style

- **Line length**: 100 characters
- **Imports**: stdlib → third-party → local (grouped and sorted)
- **Type hints**: Required for all functions
- **Docstrings**: Google-style format
- **Naming**: PascalCase (classes), snake_case (functions), UPPER_SNAKE_CASE (constants)

See [CLAUDE.md](./CLAUDE.md) for full development guidelines.

## Adding New Nodes

1. **Define node schema** in `config/node_definitions.py`:
   ```python
   {
       "name": "MyCustomNode",
       "display_name": "My Custom Node",
       "category": "custom",
       "inputs": [...],
       "outputs": [...]
   }
   ```

2. **Implement node class** in `nodes/my_custom_node.py`:
   ```python
   from nodes.base_node import BaseNode

   class MyCustomNode(BaseNode):
       async def execute(self, state):
           # Implementation
           yield {"output": "result"}
   ```

3. **Register in executor** (`workflow/executor.py`):
   ```python
   NODE_REGISTRY = {
       "MyCustomNode": MyCustomNode,
       # ...
   }
   ```

## Model Registry

The model registry (`config/model_registry.py`) defines capabilities for each LLM:

- **Provider**: openai, anthropic, google
- **Temperature support**: Boolean flag
- **Valid parameters**: Type-safe parameter definitions with ranges

This enables the frontend to:
- Show/hide temperature controls based on model support
- Adjust parameter ranges dynamically (e.g., 0-2 for OpenAI, 0-1 for Anthropic)
- Display model-specific advanced parameters (top_k, top_p for Anthropic)

## Testing

Currently using manual testing via:
- FastAPI interactive docs: http://localhost:8001/docs
- cURL commands
- Frontend integration testing

## Deployment Considerations

- Add authentication middleware for production
- Configure CORS for your domain
- Set up proper logging and monitoring
- Use environment variables for all secrets
- Consider rate limiting for LLM API calls
- Add request validation and sanitization

## License

Proprietary - Internal use only
