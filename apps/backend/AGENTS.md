# Agent Guidelines for Proto Execution Engine

**IMPORTANT:** Always read `/docs/P0_CHARTER.md` first to understand the project's mission, core principles, and success metrics.

## Environment Setup

### Virtual Environment (venv)

**Create venv (first time only):**
```bash
python3 -m venv venv
```

**Activate venv:**
- **Bash/Zsh**: `source venv/bin/activate`
- **Fish**: `source venv/bin/activate.fish`
- **Verify activation**: Look for `(venv)` in your prompt, or run `which python`

**Deactivate venv:**
```bash
deactivate
```

### Installation

- **Upgrade pip**: `python -m pip install --upgrade pip`
- **Install dependencies**: `pip install -r requirements.txt`
- **Install dev dependencies**: `pip install -r requirements-dev.txt`
- **Python version**: 3.9+

## Build & Test Commands

- **Run server**: `python main.py` (auto-reload enabled, runs on http://localhost:8001)
- **Note**: No test framework configured; manual testing via curl or FastAPI /docs endpoint recommended

## Linting & Type Checking

Using ruff for linting/formatting and mypy for type checking.

**Quick commands (using Makefile):**
- `make check` - Run all checks (lint + format check + typecheck)
- `make fix` - Auto-fix issues and format code
- `make lint` - Check for linting issues
- `make format` - Format code
- `make typecheck` - Run type checker

**Direct commands:**
- **Lint code**: `ruff check .` (check for issues)
- **Format code**: `ruff format .` (auto-format code)
- **Fix auto-fixable issues**: `ruff check --fix .`
- **Type check**: `mypy .`
- **Run all checks**: `ruff check . && ruff format --check . && mypy .`

## Code Style Guidelines

### Imports
- Standard library first, then third-party, then local imports (not enforced but consistent in codebase)
- Use absolute imports: `from workflow.executor import WorkflowExecutor`
- Group logically: stdlib → external packages → local modules

### Type Hints
- Use Python type hints throughout: `async def execute(self, state: Dict[str, Any]) -> AsyncGenerator[Dict[str, Any], None]`
- Import types from `typing` module: `Dict`, `List`, `Any`, `AsyncGenerator`, `Union`
- Type all function parameters and return types

### Naming Conventions
- Classes: PascalCase (`BaseNode`, `WorkflowExecutor`, `CORSMiddleware`)
- Functions/methods: snake_case (`execute_workflow`, `get_execution_order`)
- Constants: UPPER_SNAKE_CASE (`EXPERIMENTAL_NODES`, `CORS_ORIGINS`)
- Private members: prefix with underscore (`_cors_env`)

### Formatting
- Docstrings: Google-style triple-quoted format
  ```python
  def function(arg1: str) -> bool:
      """
      One-line summary.

      Args:
          arg1: Description

      Returns:
          Description of return value
      """
  ```
- Line length: ~100 characters (not strict, based on observed code)
- Indentation: 4 spaces

### Error Handling
- Use try/except in async generators (see `workflow/executor.py` for pattern)
- Log errors with logger: `logger.error("message")`, `logger.info("message")`
- Pydantic models for request validation: `class WorkflowRequest(BaseModel)`

### Architecture Patterns
- Use abstract base classes for extensibility: `class BaseNode(ABC)`
- Implement `@abstractmethod` for required implementations
- Use dependency injection (pass dependencies to `__init__`)
- Async/await throughout for FastAPI endpoints: `async def execute_workflow()`
- Generator patterns for streaming: `AsyncGenerator[Dict[str, Any], None]`


### Confirmation
If you have read this entire document and understand, respond only with: `Aye Aye, Bot Master!~`
