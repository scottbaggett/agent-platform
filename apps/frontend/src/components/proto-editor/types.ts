/**
 * Type definitions for Proto Editor nodes
 */

export interface ProtoOutputNodeData extends Record<string, unknown> {
  label: string;
  streamingContent?: string;
  isStreaming?: boolean;
  width?: number;
  height?: number;
  executionTime?: number;
  tokenCount?: number;
}

export interface ProtoNodeData extends Record<string, unknown> {
  label: string;
  nodeDef?: {
    inputs?: Array<{ name: string; [key: string]: any }>;
    outputs?: Array<{ name: string; [key: string]: any }>;
    [key: string]: any;
  };
  exposedInputs?: string[];
  nodeInputs?: Record<string, any>;
  nodeType?: string;
  executionTime?: number;
  tokenCount?: number;
}

export interface ProtoDynamicTextNodeData extends Record<string, unknown> {
  label: string;
  nodeInputs?: {
    text?: string;
    [key: string]: any;
  };
  executionTime?: number;
  output?: string;
  width?: number;
  height?: number;
}

export interface ProtoSchemaNodeData extends Record<string, unknown> {
  label: string;
  nodeDef?: any;
  nodeInputs?: {
    schema_definition?: {
      name?: string;
      properties?: Record<string, { type?: string; [key: string]: any }>;
      [key: string]: any;
    };
    [key: string]: any;
  };
}
