# Task: 003 Automatic Node Definition Refresh System

**Date:** 2025-10-25
**Status:** Completed (MVP)
**Priority:** Medium
**Assignee:** (unassigned)
**Updates:** Initial implementation complete. Basic auto-refresh working on workflow load and manual refresh. Future iteration needed for dirty node detection, user prompts, and selective refresh controls.

## Problem Statement

When the backend node definitions are updated (e.g., adding new model parameters, changing input schemas, updating defaults), existing nodes in saved workflows retain their old, stale node definitions. This creates several issues:

1. **Stale UI**: Nodes don't show newly added inputs or parameters until manually recreated
2. **Missing Features**: Users can't access new model parameters on existing agent nodes
3. **Inconsistent Behavior**: Newly created nodes behave differently than existing nodes of the same type
4. **Poor DX**: Developers must manually delete and recreate all nodes after backend changes

Example: When we added dynamic model parameters from the registry, existing ProtoAgentNodes didn't expose the new model-specific parameters (top_k, top_p, max_tokens, etc.) because their nodeDef was frozen at creation time.

## Current Solution (MVP)

Implemented automatic node definition refresh using React Query caching and a utility function:

### 1. Created `/hooks/use-node-definitions.ts`

- Fetches node definitions from `/nodes` endpoint
- Uses React Query with 5-minute cache
- Returns definitions as a map keyed by node name

### 2. Created `/lib/utils/refreshNodeDefinitions.ts`

- Utility to merge latest definitions into existing nodes
- Preserves all node state (nodeInputs, exposedInputs, streaming state)
- Only updates `nodeDef` and `label` fields

### 3. Updated `ProtoEditor.tsx`

- Fetches node definitions on mount
- Automatically refreshes all nodes when definitions load
- Logs refresh operations to console

### 4. Updated `ProtoNodeBrowser.tsx`

- Uses shared `useNodeDefinitions` hook
- "Refresh" button invalidates cache and triggers re-fetch
- Causes automatic update to all workflow nodes

### Current Behavior

**Automatic Refresh:**

- On page load/reload, node definitions are fetched from backend
- All existing workflow nodes are updated with latest definitions
- User sees updates immediately without manual intervention

**Manual Refresh:**

- Click "Refresh" in Node Browser
- Invalidates React Query cache
- Re-fetches from backend
- All nodes in current workflow are updated

**State Preservation:**

- Node inputs, values, and connections are preserved
- Execution state (streaming, timing) is preserved
- Only the schema (nodeDef) is updated

## Known Limitations

1. **No Dirty Detection**: Always refreshes, even if definitions haven't changed
2. **No User Control**: Automatic with no opt-out or confirmation
3. **No Conflict Resolution**: Doesn't detect if user has customized nodes
4. **Silent Updates**: No UI feedback about what changed
5. **No Rollback**: Can't undo a refresh
6. **Per-Node Updates**: Updates all-or-nothing, can't selectively refresh

## Future Improvements (TODO)

### Phase 2: Dirty Node Detection

- [ ] Add version/hash to node definitions
- [ ] Track definition version in node data
- [ ] Only refresh nodes with stale definitions
- [ ] Log which nodes were updated and why

### Phase 3: User Awareness & Control

- [ ] Show badge/indicator on nodes with stale definitions
- [ ] Add "Update Available" notification in properties panel
- [ ] Prompt user before auto-refreshing on load
- [ ] Add "Refresh All Nodes" button to toolbar
- [ ] Show diff of what changed in definition

### Phase 4: Smart Conflict Detection

- [ ] Detect if user has modified nodeInputs beyond defaults
- [ ] Warn if new definition removes an input user was using
- [ ] Provide migration suggestions for breaking changes
- [ ] Allow rollback to previous definition version

### Phase 5: Granular Control

- [ ] Checkbox in Node Browser: "Auto-update existing nodes"
- [ ] Per-node refresh option in context menu
- [ ] Bulk operations: "Update all Agent nodes"
- [ ] Workflow-level setting: "Lock node definitions"

## Technical Details

### Files Modified

**Frontend:**

- `/hooks/use-node-definitions.ts` (new)
- `/lib/utils/refreshNodeDefinitions.ts` (new)
- `/components/proto-editor/ProtoEditor.tsx`
- `/components/proto-editor/ProtoNodeBrowser.tsx`

**Backend:**

- None (uses existing `/nodes` endpoint)

### Data Flow

```
Backend Changes → /nodes endpoint updated
                ↓
useNodeDefinitions hook fetches (React Query)
                ↓
ProtoEditor useEffect detects new definitions
                ↓
refreshNodeDefinitions() merges into workflow nodes
                ↓
setNodes() updates React Flow state
                ↓
User sees updated nodes in UI
```

### Edge Cases Handled

- Empty workflows (skip refresh)
- Missing node definitions (log warning, skip that node)
- Null/undefined checks for node data
- JSON comparison to avoid unnecessary re-renders

### Edge Cases NOT Handled Yet

- Multiple workflows open (only refreshes current)
- Nodes being edited during refresh (could lose changes)
- Breaking definition changes (removed inputs)
- Cross-version compatibility

## Testing Checklist

Current manual testing:

- [x] Load workflow with old nodes → sees updated definitions
- [x] Click "Refresh" → nodes update
- [x] Node inputs/values preserved after refresh
- [x] Edge connections preserved after refresh
- [x] Console logs refresh operations

Needs automated testing:

- [ ] Unit tests for refreshNodeDefinitions()
- [ ] Integration test: definition change → refresh → UI update
- [ ] Regression test: ensure no state loss
- [ ] Performance test: large workflows (100+ nodes)

## Migration Notes

**Breaking Changes:** None (backward compatible)

**Upgrade Path:**

- Existing workflows work as-is
- First load after update will auto-refresh nodes
- No manual intervention needed

**Rollback:**

- To disable: comment out useEffect in ProtoEditor.tsx
- No data loss risk (preserves all node state)

## Related Tasks

- Task 002: Model Registry (triggered need for this feature)
- Future: Node versioning system
- Future: Workflow migration framework

## References

- Implementation PR: (link when available)
- React Query docs: https://tanstack.com/query/latest
- Node definition schema: `/config/node_definitions.py`
