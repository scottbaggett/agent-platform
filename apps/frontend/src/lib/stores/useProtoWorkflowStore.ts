/**
 * Proto Workflow Store
 * Minimal state management for current workflow ID
 * All workflow data is fetched/cached via React Query
 */

import { create } from "zustand";

interface ProtoWorkflowStore {
  currentWorkflowId: string | null;
  setCurrentWorkflow: (id: string | null) => void;
}

export const useProtoWorkflowStore = create<ProtoWorkflowStore>((set) => ({
  currentWorkflowId: null,
  setCurrentWorkflow: (id: string | null) => {
    set({ currentWorkflowId: id });
  },
}));
