# Agent Tools: Full Technical Specification

**Status**

**Version**

**Owner**

FINAL

1.0

Architecture Review Board

## 1.0 Overview

### 1.1 Purpose

This document provides the full technical specification for the design and implementation of the "Tools" feature within the agentic workflow system. It synthesizes all architectural feedback and represents the final "source of truth" blueprint for engineering teams.

### 1.2 The Core Problem

Agentic LLM loops (which are iterative, stateful, and "magic") are fundamentally in conflict with the existing graph-based workflow engine (which is declarative, stateless, and explicit).

1.  **The "Black Box" Problem:** An agent that performs many internal steps (e.g., search, calculate, HTTP call) but only outputs a final string is impossible to debug and reuse.
    
2.  **The "Graph Clutter" Problem:** Exposing every _possible_ tool as a separate node in the graph is overwhelming and forces the user to manually orchestrate simple agentic logic.
    
3.  **The "Dynamic Node" Problem:** An agent node that dynamically adds/removes output handles as tools are enabled/disabled will break saved graphs, caching, and reproducibility.
    

### 1.3 The Solution: "Invisible Tools, Visible Results"

This architecture solves these problems by:

1.  **Embedding** tool execution _inside_ the Agent Node. The graph remains simple.
    
2.  **Exposing** tool results via a **stable data contract** on the node's outputs.
    
3.  **Providing** an ergonomic **"Pinned Handle"** system for users to easily wire specific, _expected_ tool results to downstream nodes without breaking the graph.
    

### 1.4 Guiding Principles

The design is driven by four key principles:

1.  **Stability & Reproducibility:** A workflow graph **must never break** due to configuration changes. The node's "shape" (its output handles) must be stable.
    
2.  **Observability & Debuggability:** A user **must** be able to see every step, every tool call, every input, and every output to understand _why_ an agent made a decision.
    
3.  **Security & Safety:** The system **must** be secure by default. Untrusted code, runaway loops, and budget overruns must be impossible.
    
4.  **Ergonomic UX:** The system **must** feel simple and intuitive for 80% of use cases, while providing "escape hatches" for the 20% of advanced users.
    

## 2.0 Core Architecture

### 2.1 Component Diagram

The flow of a tool call is managed through a series of dedicated components that live within the agent node's execution context.

    [Agent Node Execution]
           │
           ▼
    [1. Policy Guard] ◀── (Policy: Max Iterations, Budget, Side-Effects)
    (Check Iteration, Budget)
           │
           ▼
    [2. Tool Calling Loop (LLM)]
    (Prompt + Tool Schemas)
           │
           ▼
    [3. LLM Provider Adapter]
    (Formats request, parses tool calls)
           │
           ▼
    [4. Tool Executor]
           ├─► [4a. Validator (JSON Schema)]
           ├─► [4b. RateLimiter / Budgeter]
           ├─► [4c. Cache (Deterministic ID)]
           ├─► [4d. Secret Resolver]
           └─► [4e. Sandbox / Runtimes]
                  │
                  ▼
    [5. Tool Implementations]
    (HTTP, Python, DB, etc.)
           │
           ▼
    [6. Executor (Returns ToolEnvelope)]
           │
           ▼
    [7. Tracing/Logs (OTel Spans)]
           │
           ▼
    [8. Loop (Back to Step 2)]
    (Add ToolEnvelope to context)
    

### 2.2 Key Component Definitions

-   **2.2.1 Agent Node (The Host):** The graph node that hosts the entire tool-calling loop. It is responsible for its configuration (enabled tools, policies) and exposing the stable outputs.
    
-   **2.2.2 Tool Registry (The Catalog):** A global, versioned registry that maps a `tool@version` string to its implementation class. It stores the tool's schemas and metadata (cache policy, side-effects).
    
-   **2.2.3 Tool Executor (The Runtime):** The core service responsible for safely executing a tool call. It orchestrates validation, rate limiting, caching, sandboxing, and error handling. It **must** execute non-dependent tool calls in parallel.
    
-   **2.2.4 Policy Guard (The Gate):** A P0 service that gate-checks execution. It enforces `max_iterations`, `max_tool_calls`, `max_budget`, and side-effect policies _before_ the LLM is even called and _before_ a tool is executed.
    
-   **2.2.5 LLM Provider Adapters (The Translators):** Converts the system's internal tool schemas into the provider-specific format (e.g., OpenAI JSON, Claude XML). It also parses the provider's response back into a standard list of tool calls.
    

## 3.0 Data Contracts & APIs (Source of Truth)

These contracts are the stable foundation of the entire system.

### 3.1 Agent Node Outputs (Stable Contract)

Every Agent Node **must** output this stable structure. This contract is final and cannot be changed by node configuration.

    type AgentOutputs = {
      /** The final, top-level text answer from the LLM. */
      response: string;
    
      /**
       * A map of all tool calls that were executed, keyed by their deterministic
       * call_id. This is the primary source of truth for downstream access.
       */
      tools_by_id: Record<string, ToolEnvelope>;
    
      /**
       * A list of call_ids in the exact chronological order of execution.
       * This is used to reconstruct the agent's "chain of thought."
       */
      tool_order: string[];
    
      /**
       * A convenience handle containing the ToolEnvelope of the *last*
       * tool that was successfully executed.
       */
      last_tool?: ToolEnvelope;
    
      /** A URL to the OpenTelemetry trace for this agent run. */
      traces_url?: string;
    }
    

-   **Strategy & Rationale:** We provide _both_ a map (`tools_by_id`) for efficient, key-based access and a list (`tool_order`) to preserve chronology. This satisfies both advanced programmatic use cases and simple debugging.
    

### 3.2 The `ToolEnvelope` (The "Receipt")

This is the standardized "receipt" for a _single tool call_. It is the building block for all observability and data outputs.

    type ToolEnvelope = {
      /** The deterministic hash of the tool call. */
      call_id: string;
    
      /** The name of the tool that was called (e.g., "web_search"). */
      name: string;
    
      /** The version of the tool that was called (e.g., "1.2.0"). */
      version: string;
    
      /** The input parameters (the "args") sent to the tool. */
      input: unknown;
    
      /** The structured data returned by the tool. Null if an error occurred. */
      output?: unknown;
    
      /** The structured error object. Null if the call succeeded. */
      error?: ToolError;
    
      /** ISO timestamp of when the tool was invoked. */
      t_start: string;
    
      /** ISO timestamp of when the tool returned. */
      t_end: string;
    
      /** True if this result was served from the executor cache. */
      cached?: boolean;
    
      /** True if the 'output' was truncated dueD to size limits. */
      truncated?: boolean;
    
      /**
       * A list of rich attachments, such as blob URLs for oversized
       * payloads, images, or tables.
       */
      attachments?: {
        kind: 'blob' | 'image' | 'table';
        url: string;
        content_type?: string;
        bytes?: number;
      }[];
    }
    

### 3.3 `BaseTool` Interface

All tools added to the `Tool Registry` **must** implement this interface.

    interface BaseTool<I, O> {
      name: string;
      version: string;
    
      input_schema: JSONSchema7;
      output_schema: JSONSchema7;
    
      metadata: {
        /** High-level category for the UI tool selector. */
        category: 'api' | 'code' | 'data' | 'search' | 'utility';
    
        /**
         * Security manifest for the Policy Guard.
         * 'none': Pure function (e.g., calculator).
         * 'reads': Reads external data (e.g., search, HTTP GET).
         * 'writes': Writes or modifies external state (e.g., DB POST, file write).
         */
        side_effects: 'none' | 'reads' | 'writes';
    
        /** Caching policy for the executor. */
        cache: 'none' | 'ttl' | 'forever';
        cache_ttl_s?: number;
      };
    
      /** The core execution method. */
      execute(input: I, ctx: ToolContext): Promise<O>;
    }
    
    /** Context passed to the tool during execution. */
    type ToolContext = {
      /** The resolved API keys/secrets for this tool. */
      auth: Record<string, string>;
      /** The user/workspace/org ID for tenancy. */
      tenant_id: string;
    }
    

### 3.4 Error Taxonomy (Stable API)

When a tool fails, the `ToolEnvelope.error` field will contain an error object. The `code` field is a stable API that downstream nodes **can** safely branch on.

    type ToolError = {
      /** A stable, machine-readable error code. */
      code:
        | 'VALIDATION_ERROR'   // Input failed JSON schema validation
        | 'TIMEOUT'            // Tool execution exceeded its timeout
        | 'RATE_LIMIT'         // Tool-specific rate limit was exceeded
        | 'POLICY_DENIED'      // Policy Guard (budget, side-effects) blocked call
        | 'AUTH_REQUIRED'      // Missing or invalid secrets
        | 'PROVIDER_ERROR'     // The underlying API (e.g., Google) returned a 5xx
        | 'NETWORK_ERROR'      // DNS or connection failure
        | 'SANDBOX_ERROR'      // Python sandbox failed
        | 'UNKNOWN';           // Unhandled exception
    
      /** A human-readable error message. */
      message: string;
    
      /** Optional details (e.g., validation errors). */
      details?: unknown;
    
      /** If the error is retryable (e.g., RATE_LIMIT), suggests a wait time. */
      retry_after_s?: number;
    };
    

-   **Strategy & Rationale:** By publishing a stable error enum, we treat tool failures as _data_, not exceptions. This enables robust agentic behavior (e.g., the LLM can see a `RATE_LIMIT` error and decide to wait) and allows users to build resilient workflows (e.g., "on `VALIDATION_ERROR`, send to human-in-the-loop").
    

## 4.0 Frontend & User Experience

### 4.1 The Core Conflict & The Solution

-   **Conflict:** An "ergonomic" UI (A2) would dynamically add/remove output handles as tools are toggled, but this creates a "brittle" graph (A1) that breaks connections.
    
-   **Solution:** We will implement **both** a stable contract and an ergonomic UI.
    
    1.  The node's core outputs (`tools_by_id`, etc.) are **always present**.
        
    2.  The UI provides a **"Pinned Handles"** feature for the 80% use case.
        

### 4.2 Pinned Handles

-   **Definition:** A "Pinned Handle" is a user-configured, named output handle that is added to the Agent Node for wiring convenience.
    
-   **Key Behavior:** When a user "pins" the output of the `web_search` tool, a `web_search_result` handle appears. If the user later _disables_ the `web_search` tool, this handle **DOES NOT DISAPPEAR**.
    
-   **`on_missing: 'null'`:** The handle remains on the node and simply outputs `null`. This ensures that any saved graph connections are **never broken**.
    

### 4.2.1 Pinned Handle Configuration

This is the data structure stored in the node's configuration to define its pins.

    type PinnedHandle = {
      /** The name of the handle on the node (e.g., "weather_report"). */
      name: string;
    
      /** The configuration for selecting which tool call populates this handle. */
      selector: {
        /** The tool name to listen for (e.g., "http_request"). */
        tool: string;
    
        /** The strategy to use if multiple calls are made. */
        strategy:
          | 'latest'             // The last call to this tool (default)
          | 'first_success'      // The first successful call
          | 'by_call_id';        // A specific call_id (for advanced use)
    
        call_id?: string;
      };
    
      /** Behavior if the selected tool call is not found. */
      on_missing:
        | 'null'                 // Output null (default, safest)
        | 'error'                // Fail the node
        | 'stale_last_success';  // (Future) Output the value from the last *run*
    };
    

### 4.3 Tool Selector Widget

The agent node's configuration panel will feature a `ToolSelector` widget with:

-   Search and filtering by `category` and `name`.
    
-   A clear badge for each tool's auth status (e.g., "Missing API Key").
    
-   A "Pin" icon next to each tool to add/configure its `PinnedHandle`.
    
-   A warning if a selected tool is `deprecated`.
    

### 4.4 Execution Observability (In-Node UI)

To prevent the node from being a "black box," the node's "Inspector" panel in the UI will show a **live tool timeline** during and after a run. This will display a chronological list of `ToolEnvelope` data (name, latency, cached status, brief result/error).

## 5.0 Security & Safety (P0)

### 5.1 Policy Guard (Detailed)

The `PolicyGuard` is a P0, non-negotiable service that enforces safety _before_ execution.

-   `enabled_tools`: A strict allow-list. If the LLM tries to call a tool _not_ on this list, it will be blocked with a `POLICY_DENIED` error.
    
-   `max_iterations`: Hard cap on the number of LLM-Tool loops (e.g., default: 10).
    
-   `max_tool_calls`: Hard cap on the _total_ number of tool calls in a single run (e.g., default: 25).
    
-   `max_budget`: (P2) A cost limit (tokens/credits) that is accrued live. The run will be hard-stopped if exceeded.
    
-   `side_effects`: The guard will check the tool's `metadata.side_effects` flag against the node's policy (e.g., a "read-only" node can block tools marked as `'writes'`).
    

### 5.2 Secret Management

-   **Scoping:** Secrets will be resolved at execution time with a strict order of precedence: **User-Scoped Key → Workspace-Scoped Key → Org-Scoped Key**.
    
-   **UI:** The `ToolSelector` widget will show the _resolved scope_ (e.g., "Using Workspace Key") and show a warning if it's falling back to a broad (Org) scope.
    
-   **Redaction:** Secrets **must never** be serialized into logs or `ToolEnvelope`s.
    

### 5.3 Sandboxing (Python Execution)

-   **Strategy:** We acknowledge that running arbitrary code is the highest-risk feature.
    
-   **Phase 1 (P1):** Use `RestrictedPython` with all dangerous built-ins, imports, and file/network access disabled. This provides basic protection.
    
-   **Phase 2 (P2):** Implement a micro-VM (e.g., Firecracker) or container-based (e.g., gVisor) sandbox. This is the only acceptable long-term solution for true isolation and will enforce strict quotas (CPU, mem, time, file descriptors).
    

### 5.4 Output Size & Truncation

-   **`max_output_bytes`:** A hard limit (e.g., 2MB) will be enforced on all tool `output` payloads.
    
-   **Truncation Contract:** If a payload exceeds this limit, the `output` will be truncated, and the `ToolEnvelope` will be updated:
    
    -   `truncated: true`
        
    -   `attachments`: Will contain a `kind: 'blob'` entry with a `url` pointing to the full payload in object storage.
        

## 6.0 Observability & Performance

### 6.1 Deterministic `call_id`

-   **Strategy:** A `call_id` will be a deterministic hash: `hash(tool@version, normalized_input, seq_number)`.
    
-   **Rationale:** This single decision unlocks three critical features:
    
    1.  **Caching:** The executor's cache will use this ID as part of its key.
        
    2.  **Observability:** OTel traces can be directly correlated with the `tools_by_id` map.
        
    3.  **Retries:** Retry attempts can be deterministically grouped.
        

### 6.2 Caching

-   **Strategy:** The `ToolExecutor` will maintain a memo-cache (e.g., Redis-backed).
    
-   **Behavior:** Before executing, it checks the `tool.metadata.cache` policy. If `ttl` or `forever`, it computes the deterministic `call_id` and checks the cache. On a hit, it returns the cached `ToolEnvelope` with `cached: true`.
    

### 6.3 Parallel Execution

-   **Requirement (P0):** The `ToolExecutor` **must** be built to be asynchronous. When an LLM adapter returns multiple tool calls, the executor **must** run all non-dependent calls in parallel (e.g., via `asyncio.gather`).
    
-   **Rationale:** Modern LLMs (e.g., Claude 3.5, GPT-4o) return parallel tool calls by default. Sequential execution is a non-starter and will feel slow and broken.
    

### 6.4 Tracing & Replay

-   **Tracing (P0):** Every part of the loop (policy check, LLM call, executor, tool run) **must** emit OpenTelemetry spans, linked in a single trace. The `traces_url` will be exposed on the node.
    
-   **Replay (P0):** A "replay bundle" (initial prompt, messages, tool schemas, and all `ToolEnvelope`s) **must** be persisted. This is the only way to deterministically replay and debug an agent's run.
    

## 7.0 Lifecycle & Versioning

### 7.1 Tool Versioning

-   **Requirement (P0):** All tools in the registry **must** be versioned (`name@version`). The `ToolEnvelope` **must** record the version that was executed.
    
-   **Rationale:** This is the only way to update a tool's schema without silently breaking all existing workflows that depend on the old schema.
    

### 7.2 Deprecation Lifecycle

The `Tool Registry` will support three states for a tool version:

-   `active`: Default state. Discoverable and executable.
    
-   `deprecated`: Hidden from the `ToolSelector` (unless "show deprecated" is checked). Will show a prominent **compile-time warning** in any workflow that still uses it. Still executable.
    
-   `blocked`: Not discoverable. Will produce a hard **run-time error** (`POLICY_DENIED`) if any workflow attempts to execute it.
    

## 8.0 Advanced Features (Future)

### 8.1 "Materialize Tool" Action

-   **Concept:** A "P2" escape hatch for advanced users.
    
-   **Behavior:** A user can right-click a tool in the "Tool Timeline" or a `PinnedHandle` and select "Materialize as Node." This will create a new, dedicated node in the graph (e.g., a `WebSearchNode`) with the exact inputs, auth, and version pre-configured.
    
-   **Rationale:** This allows users to "eject" a step from an agent loop and give it its own explicit graph logic (e.g., custom retries, connections) without sacrificing the simplicity of the agent for the common case.
    

## 9.0 Implementation Plan (Rollout Order)

### P0 (Foundation & Safety)

-   **Stable Outputs:** `tools_by_id` + `tool_order` contract.
    
-   **Pinned Handles:** Implement the core `on_missing: 'null'` behavior.
    
-   **Async Executor:** Build for parallelism from day one.
    
-   **Policy Guard (MVP):** `max_iterations`, `enabled_tools`.
    
-   **Error Taxonomy:** Implement the enum and the "error-to-LLM" loop.
    
-   **Versioning:** Tool registry must use `name@version` keys.
    
-   **Secrets:** Implement User/Workspace/Org scoped secret resolution.
    
-   **Tracing & Replay:** OTel spans and replay bundle persistence.
    
-   **Output Size Cap:** Implement the `truncated: true` contract.
    
-   **Deterministic `call_id`:** Implement the hashing strategy.
    

### P1 (Performance & UX)

-   **Cache:** Implement the executor-level cache.
    
-   **HTTP Tool:** Build the first complex tool with normalization/previews.
    
-   **Frontend UI:** Build the `ToolSelector` (with search/filter) and the `PinSelector` UI (`strategy`, etc.).
    
-   **"Materialize Tool" Action:** Implement the "eject" feature.
    
-   **Sandbox (MVP):** Ship `PythonTool` using `RestrictedPython`.
    

### P2 (Enterprise & Scale)

-   **Micro-VM Sandbox:** Replace `RestrictedPython` with a Firecracker/container solution.
    
-   **Budgeting:** Implement `max_budget` policy and live-accrual.
    
-   **Deprecation:** Implement the `deprecated` / `blocked` states and UI warnings.
    
-   **Usage Analytics:** Add hooks for billing and analytics exports.



