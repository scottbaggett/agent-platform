/**
 * ProtoNodeBrowser - Simple node palette
 * Fetches nodes from proto engine and displays them
 */

import { Search } from "lucide-react";
import { useState } from "react";
import { LucideIcon } from "@/components/icon/LucideIcon";
import { Input } from "@/components/ui/input";
import { useNodeDefinitions } from "@/hooks/use-node-definitions";
import { useQueryClient } from "@tanstack/react-query";

type ProtoNodeBrowserProps = {
  onAddNode: (nodeType: string, nodeDef: any) => void;
};

export const ProtoNodeBrowser = ({ onAddNode }: ProtoNodeBrowserProps) => {
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const {
    data: nodeDefinitions,
    isLoading,
    isError,
    error,
  } = useNodeDefinitions();

  // Convert node definitions map to array for display
  const nodes = nodeDefinitions ? Object.values(nodeDefinitions) : [];

  const handleRefresh = () => {
    console.log("🔄 Manually refreshing node definitions");
    queryClient.invalidateQueries({ queryKey: ["nodeDefinitions"] });
  };

  const filteredNodes = nodes.filter(
    (node) =>
      node.display_name?.toLowerCase().includes(search.toLowerCase()) ??
      node.name?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="bg-editor-panel pointer-events-auto absolute top-4 left-4 flex h-[calc(100vh-120px)] w-80 flex-col gap-3 rounded-lg border p-4 shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-foreground text-lg font-semibold">Proto Nodes</h2>
        <button
          onClick={handleRefresh}
          className="hover:text-foreground text-muted-foreground hover:bg-accent rounded px-2 py-1 text-xs"
          title="Refresh node definitions from backend"
        >
          Refresh
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute top-2.5 left-3 h-4 w-4 text-gray-500" />
        <Input
          type="text"
          placeholder="Search nodes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Node List */}
      <div className="flex-1 space-y-2 overflow-y-auto">
        {isLoading && (
          <div className="text-muted-foreground text-center text-sm">
            Loading nodes...
          </div>
        )}

        {isError && (
          <div className="rounded-lg border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400">
            {error instanceof Error ? error.message : "Failed to fetch nodes"}
          </div>
        )}

        {!isLoading && !isError && filteredNodes.length === 0 && (
          <div className="text-muted-foreground text-center text-sm">
            No nodes found
          </div>
        )}

        {filteredNodes.map((node) => (
          <button
            key={node.name}
            draggable
            onDragStart={(e) => {
              e.dataTransfer.setData(
                "application/reactflow",
                JSON.stringify(node),
              );
              e.dataTransfer.effectAllowed = "move";
            }}
            onClick={() => onAddNode(node.name as string, node)}
            className="hover:bg-accent/50 bg-card border-input w-full cursor-grab rounded-lg border p-3 text-left shadow-xs transition-all active:cursor-grabbing"
          >
            <div className="text-foreground flex items-center gap-1 font-medium">
              <LucideIcon name={node.icon} className="size-4" />
              {node.display_name ?? node.name}
            </div>
            {node.short_description && (
              <div className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                {node.short_description}
              </div>
            )}
            {node.category && (
              <div className="bg-mint-4 text-mint-11 mt-2 inline-block rounded px-2 py-0.5 text-xs">
                {node.category}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
};
