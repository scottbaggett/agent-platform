/**
 * Hook to fetch and access the model registry
 * Provides model capabilities and parameter configurations
 */

import { useQuery } from "@tanstack/react-query";
import { protoEngineConfig } from "@/lib/config/protoEngine";

export type ParamConfig = {
  type: "int" | "float" | "enum" | "bool";
  min?: number;
  max?: number;
  range?: [number, number];
  values?: string[]; // For enum type
  default?: any; // Default value for the parameter
};

export type ModelConfig = {
  provider: "openai" | "anthropic" | "google";
  supports_temp: boolean;
  valid_params?: Record<string, ParamConfig>;
};

export type ModelRegistry = Record<string, ModelConfig>;

/**
 * Fetch model registry from the backend
 */
async function fetchModelRegistry(): Promise<ModelRegistry> {
  const endpoint = protoEngineConfig.getModelsEndpoint();
  console.log("[Model Registry] Fetching from:", endpoint);

  const response = await fetch(endpoint);

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[Model Registry] Fetch failed:", response.status, errorText);
    throw new Error(
      `Failed to fetch model registry: ${response.status} ${errorText}`,
    );
  }

  const data = await response.json();
  console.log("[Model Registry] Received data:", data);

  if (!data.models) {
    console.error("[Model Registry] Invalid response structure:", data);
    throw new Error('Invalid model registry response - missing "models" field');
  }

  return data.models;
}

/**
 * Hook to access model registry
 */
export function useModelRegistry() {
  return useQuery({
    queryKey: ["modelRegistry"],
    queryFn: fetchModelRegistry,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });
}

/**
 * Hook to get configuration for a specific model
 */
export function useModelConfig(modelName: string | undefined) {
  const {
    data: registry,
    isLoading,
    isError,
    error,
    ...query
  } = useModelRegistry();

  const modelConfig = modelName && registry ? registry[modelName] : null;

  // Log if model not found in registry
  if (modelName && registry && !modelConfig) {
    console.warn(
      `[Model Registry] Model "${modelName}" not found in registry. Available models:`,
      Object.keys(registry),
    );
  }

  return {
    ...query,
    isLoading,
    isError,
    error,
    modelConfig,
    isReady: query.isSuccess && !!modelConfig,
  };
}

/**
 * Helper to check if a model supports a specific parameter
 */
export function modelSupportsParam(
  config: ModelConfig | null | undefined,
  paramName: string,
): boolean {
  if (!config) return false;

  if (paramName === "temperature") {
    return config.supports_temp;
  }

  return config.valid_params?.[paramName] !== undefined;
}

/**
 * Helper to get temperature range for a model
 */
export function getTemperatureRange(
  config: ModelConfig | null | undefined,
): [number, number] {
  if (!config?.supports_temp) return [0, 1];

  const tempConfig = config.valid_params?.temperature;
  if (tempConfig?.range) {
    return tempConfig.range;
  }

  return [0, 1]; // Default range
}
