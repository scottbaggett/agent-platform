/**
 * Proto Workflow Store
 * Simple store for saving/loading workflows to local storage
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Node, Edge } from "@xyflow/react";

export interface ProtoWorkflow {
  id: string;
  name: string;
  nodes: Node[];
  edges: Edge[];
  viewport?: {
    x: number;
    y: number;
    zoom: number;
  };
  createdAt: number;
  updatedAt: number;
}

interface ProtoWorkflowStore {
  workflows: ProtoWorkflow[];
  currentWorkflowId: string | null;

  // Actions
  createWorkflow: (name: string) => string;
  saveWorkflow: (
    id: string,
    nodes: Node[],
    edges: Edge[],
    viewport?: { x: number; y: number; zoom: number },
  ) => void;
  loadWorkflow: (id: string) => ProtoWorkflow | null;
  deleteWorkflow: (id: string) => void;
  renameWorkflow: (id: string, name: string) => void;
  setCurrentWorkflow: (id: string | null) => void;
  getCurrentWorkflow: () => ProtoWorkflow | null;
}

export const useProtoWorkflowStore = create<ProtoWorkflowStore>()(
  persist(
    (set, get) => ({
      workflows: [],
      currentWorkflowId: null,

      createWorkflow: (name: string) => {
        const id = `workflow-${Date.now()}`;
        const newWorkflow: ProtoWorkflow = {
          id,
          name,
          nodes: [],
          edges: [],
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };

        set((state) => ({
          workflows: [...state.workflows, newWorkflow],
          currentWorkflowId: id,
        }));

        return id;
      },

      saveWorkflow: (
        id: string,
        nodes: Node[],
        edges: Edge[],
        viewport?: { x: number; y: number; zoom: number },
      ) => {
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === id
              ? { ...w, nodes, edges, viewport, updatedAt: Date.now() }
              : w,
          ),
        }));
      },

      loadWorkflow: (id: string) => {
        const workflow = get().workflows.find((w) => w.id === id);
        return workflow || null;
      },

      deleteWorkflow: (id: string) => {
        set((state) => ({
          workflows: state.workflows.filter((w) => w.id !== id),
          currentWorkflowId:
            state.currentWorkflowId === id ? null : state.currentWorkflowId,
        }));
      },

      renameWorkflow: (id: string, name: string) => {
        set((state) => ({
          workflows: state.workflows.map((w) =>
            w.id === id ? { ...w, name, updatedAt: Date.now() } : w,
          ),
        }));
      },

      setCurrentWorkflow: (id: string | null) => {
        set({ currentWorkflowId: id });
      },

      getCurrentWorkflow: () => {
        const { currentWorkflowId, workflows } = get();
        if (!currentWorkflowId) return null;
        return workflows.find((w) => w.id === currentWorkflowId) || null;
      },
    }),
    {
      name: "proto-workflows-storage",
      partialize: (state) => ({
        workflows: state.workflows,
        currentWorkflowId: state.currentWorkflowId,
      }),
    },
  ),
);
