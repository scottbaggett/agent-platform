/**
 * Proto Editor Page
 * Simple workflow editor for prototyping LangGraph nodes
 * Fresh implementation without the complexity of the main editor
 */

import { ReactFlowProvider } from "@xyflow/react";
import { ProtoEditor } from "./ProtoEditor";
import "@xyflow/react/dist/style.css";

export const ProtoEditorPage = () => {
  return (
    <div className="h-screen w-screen overflow-hidden bg-gray-950">
      <ReactFlowProvider>
        <ProtoEditor />
      </ReactFlowProvider>
    </div>
  );
};
