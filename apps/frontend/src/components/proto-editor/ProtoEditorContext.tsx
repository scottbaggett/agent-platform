/**
 * ProtoEditorContext - Provides execute function to all nodes
 */

import { createContext } from "react";

type ProtoEditorContextType = {
  onExecuteFromNode: (nodeId: string) => void;
};

export const ProtoEditorContext = createContext<ProtoEditorContextType>({
  onExecuteFromNode: () => {},
});
