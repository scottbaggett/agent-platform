/**
 * ProtoOutputNode - Special output node that displays streaming content
 * Shows accumulated output as it streams in from connected nodes
 */

import { Position, type NodeProps, useReactFlow } from "@xyflow/react";
import { Copy, FileText, Code, Globe } from "lucide-react";
import { memo, useContext, useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { NodeColor } from "@/lib/nodeColors";
import { ProtoEditorContext } from "./ProtoEditorContext";
import { ProtoNodeFooter } from "./ProtoNodeFooter";
import { ProtoNodeFrame } from "./ProtoNodeFrame";
import { ProtoNodeHandle } from "./ProtoNodeHandle";
import { ProtoNodeHeader } from "./ProtoNodeHeader";
import { useLLMOutput } from "@llm-ui/react";
import {
  codeBlockLookBack,
  findCompleteCodeBlock,
  findPartialCodeBlock,
} from "@llm-ui/code";
import { markdownLookBack } from "@llm-ui/markdown";
import { CodeBlock } from "./CodeBlock";
import { MarkdownBlock } from "./MarkdownBlock";
import { HTMLRenderer } from "./HTMLRenderer";
import type { ProtoOutputNodeData } from "./types";

export const ProtoOutputNode = memo(({ data, selected, id }: NodeProps) => {
  const {
    label,
    streamingContent,
    isStreaming,
    width: dataWidth = 400,
    height: dataHeight = 250,
    executionTime,
    tokenCount,
  } = data as ProtoOutputNodeData;
  const [width, setWidth] = useState(dataWidth);
  const [height, setHeight] = useState(dataHeight);
  const [viewMode, setViewMode] = useState<"raw" | "formatted">("formatted");
  const { updateNodeData } = useReactFlow();
  const { onExecuteFromNode } = useContext(ProtoEditorContext);

  // Use llm-ui for parsing and rendering streamed content
  const { blockMatches } = useLLMOutput({
    llmOutput: streamingContent ?? "",
    fallbackBlock: {
      component: MarkdownBlock,
      lookBack: markdownLookBack(),
    },
    blocks: [
      {
        component: CodeBlock,
        findCompleteMatch: findCompleteCodeBlock(),
        findPartialMatch: findPartialCodeBlock(),
        lookBack: codeBlockLookBack(),
      },
    ],
    isStreamFinished: !isStreaming,
  });

  // Detect if content is HTML and extract it
  const htmlContent = useMemo(() => {
    if (!streamingContent) return null;
    const content = streamingContent.trim();

    // Check for ```html code fence
    const htmlCodeFence = content.match(/^```html\s*\n([\s\S]*?)\n```$/);
    if (htmlCodeFence) {
      return htmlCodeFence[1];
    }

    // Check for raw HTML patterns
    const htmlPatterns = [
      /^<!DOCTYPE\s+html/i,
      /^<html[\s>]/i,
      /<\/html>\s*$/i,
      /^<body[\s>]/i,
      /^<div[\s>]/i,
      /^<head[\s>]/i,
    ];

    if (htmlPatterns.some(pattern => pattern.test(content))) {
      return content;
    }

    return null;
  }, [streamingContent]);

  // Sync with data when it changes externally
  useEffect(() => {
    setWidth(dataWidth);
    setHeight(dataHeight);
  }, [dataWidth, dataHeight]);

  const handleCopy = () => {
    if (streamingContent) {
      navigator.clipboard.writeText(streamingContent);
    }
  };

  const handleDelete = () => {
    // TODO: Implement delete functionality
    console.log("Delete node:", id);
  };

  const handleResize = (newWidth: number, newHeight: number) => {
    // Update local state immediately for smooth resizing
    setWidth(newWidth);
    setHeight(newHeight);
  };

  const handleResizeEnd = (newWidth: number, newHeight: number) => {
    // Persist to React Flow data when done
    updateNodeData(id, { width: newWidth, height: newHeight });
  };

  const handles = (
    <ProtoNodeHandle
      id="content"
      type="target"
      position={Position.Left}
      index={0}
      totalCount={1}
      color="#3b82f6"
    />
  );

  return (
    <ProtoNodeFrame
      selected={selected}
      color={NodeColor.STANDARD_GRAY}
      width={width}
      height={height}
      minWidth={300}
      maxWidth={1200}
      minHeight={150}
      maxHeight={800}
      nodeId={id}
      onExecute={onExecuteFromNode}
      handles={handles}
      className="flex flex-col"
      resizable={true}
      onResize={handleResize}
      onResizeEnd={handleResizeEnd}
    >
      {/* Header */}
      <div className="flex shrink-0 p-2">
        <ProtoNodeHeader
          onExecute={() => onExecuteFromNode(id)}
          icon={"monitor"}
          title={label}
          rightContent={
            <>
              {isStreaming && (
                <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              )}
              {streamingContent && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-node-input size-7 text-node-foreground"
                  onClick={() =>
                    setViewMode(viewMode === "raw" ? "formatted" : "raw")
                  }
                  title={viewMode === "raw" ? "Show Formatted" : "Show Raw"}
                >
                  {viewMode === "raw" ? (
                    <FileText className="h-3 w-3" />
                  ) : (
                    <Code className="h-3 w-3" />
                  )}
                </Button>
              )}
              {streamingContent && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="hover:bg-node-input size-7 text-node-foreground"
                  onClick={handleCopy}
                  title="Copy output"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              )}
            </>
          }
          actions={[
            {
              label: "Delete",
              icon: "trash2",
              onClick: handleDelete,
            },
          ]}
        />
      </div>

      <div className="bg-node text-node-foreground flex-1 overflow-y-auto no-scrollbar nowheel p-2 text-sm">
        {streamingContent ? (
          viewMode === "formatted" ? (
            htmlContent ? (
              <HTMLRenderer html={htmlContent} />
            ) : (
              <div className="llm-output">
                {blockMatches.map((blockMatch, index) => {
                  const Component = blockMatch.block.component;
                  return <Component key={index} blockMatch={blockMatch} />;
                })}
                {isStreaming && <span className="animate-pulse">▊</span>}
              </div>
            )
          ) : (
            <div className="nowheel h-full break-words whitespace-pre-wrap">
              {streamingContent}
              {isStreaming && <span className="animate-pulse">▊</span>}
            </div>
          )
        ) : (
          <div className="text-node-foreground text-center">
            Waiting for input...
          </div>
        )}
      </div>

      {/* Footer with metrics */}
      {streamingContent && (
        <ProtoNodeFooter
          metrics={[
            {
              label: "Characters",
              value: streamingContent.length,
              icon: "hash",
            },
            ...(executionTime
              ? [
                  {
                    label: "Time",
                    value: `${executionTime}ms`,
                    icon: "clock",
                  },
                ]
              : []),
            ...(tokenCount
              ? [{ label: "Tokens", value: tokenCount, icon: "hash" }]
              : []),
          ]}
        />
      )}
    </ProtoNodeFrame>
  );
});

ProtoOutputNode.displayName = "ProtoOutputNode";
