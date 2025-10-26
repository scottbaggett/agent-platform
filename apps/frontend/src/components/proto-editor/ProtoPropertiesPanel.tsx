/**
 * ProtoPropertiesPanel - Simple properties panel for configuring nodes
 * Shows inputs/widgets for the selected node
 */

import type { Node } from "@xyflow/react";
import { X, Settings, Plug, PlugZap } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { JsonSchemaModal } from "./JsonSchemaModal";
import { DynamicTextInput } from "./DynamicTextInput";
import {
  useModelConfig,
  getTemperatureRange,
} from "@/hooks/use-model-registry";

type ProtoPropertiesPanelProps = {
  selectedNode: Node | null;
  onClose: () => void;
  onUpdateNode: (nodeId: string, data: any) => void;
};

export const ProtoPropertiesPanel = ({
  selectedNode,
  onClose,
  onUpdateNode,
}: ProtoPropertiesPanelProps) => {
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);

  const {
    nodeDef,
    nodeInputs = {},
    exposedInputs = [],
  } = selectedNode?.data || {};

  // Get available context variables from exposed inputs
  const availableVariables = useMemo(() => {
    if (!exposedInputs) return [];
    return exposedInputs.filter((inputName: string) => {
      // Don't include the current input as a variable for itself
      return true;
    });
  }, [exposedInputs]);

  // Get model config for the currently selected model
  const currentModel = nodeInputs["model"];
  const { modelConfig } = useModelConfig(currentModel);

  if (!selectedNode) return null;

  const handleInputChange = (inputName: string, value: any) => {
    const updatedInputs = { ...nodeInputs, [inputName]: value };
    onUpdateNode(selectedNode.id, {
      ...selectedNode.data,
      nodeInputs: updatedInputs,
    });
  };

  const handleModelParameterChange = (paramName: string, value: any) => {
    const currentParams = nodeInputs["model_parameters"] || {};
    const updatedParams = { ...currentParams, [paramName]: value };
    handleInputChange("model_parameters", updatedParams);
  };

  const toggleInputExposed = (inputName: string) => {
    const newExposedInputs = exposedInputs.includes(inputName)
      ? exposedInputs.filter((name: string) => name !== inputName)
      : [...exposedInputs, inputName];

    onUpdateNode(selectedNode.id, {
      ...selectedNode.data,
      exposedInputs: newExposedInputs,
    });
  };

  const renderInput = (input: any) => {
    const currentValue = nodeInputs[input.name] ?? input.default ?? "";
    const widget = input.widget;
    const widgetType = widget?.widgetType;

    // Hide generic model_parameters JSON editor - we'll render specific inputs dynamically
    if (input.name === "model_parameters" && widgetType === "JSON_EDITOR") {
      return null;
    }

    // JSON Schema Editor
    if (widgetType === "JSON_SCHEMA") {
      // For agent nodes, only show if output_type is 'json'
      // For schema nodes, always show
      const nodeType = selectedNode.data.nodeType;
      const isSchemaNode = nodeType === "ProtoSchemaNode";
      const outputType = nodeInputs["output_type"] || "text";

      if (!isSchemaNode && outputType !== "json") {
        return null;
      }

      return (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSchemaModalOpen(true)}
            className="w-full"
          >
            <Settings className="mr-2 h-4 w-4" />
            Configure Schema
          </Button>
          <JsonSchemaModal
            open={isSchemaModalOpen}
            onOpenChange={setIsSchemaModalOpen}
            schema={currentValue}
            onSave={(schema) => handleInputChange(input.name, schema)}
          />
        </div>
      );
    }

    // Slider
    if (widgetType === "SLIDER") {
      // Special handling for temperature slider based on model config
      if (input.name === "temperature") {
        // Hide temperature slider if no model selected or model doesn't support it
        if (!currentModel || !modelConfig || !modelConfig.supports_temp) {
          return null;
        }

        // Use model-specific temperature range
        const [modelMin, modelMax] = getTemperatureRange(modelConfig);
        const min = modelMin;
        const max = modelMax;
        const step = widget?.parameters?.step ?? 0.1;
        const numValue =
          typeof currentValue === "number"
            ? currentValue
            : parseFloat(currentValue) || min;

        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">
                {numValue.toFixed(1)}
              </span>
              <span className="text-xs text-gray-500">
                {min} - {max}
              </span>
            </div>
            <Slider
              value={[numValue]}
              onValueChange={([value]) => handleInputChange(input.name, value)}
              min={min}
              max={max}
              step={step}
              className="w-full"
            />
          </div>
        );
      }

      // Default slider for non-temperature inputs
      const min = widget?.parameters?.min ?? 0;
      const max = widget?.parameters?.max ?? 1;
      const step = widget?.parameters?.step ?? 0.1;
      const numValue =
        typeof currentValue === "number"
          ? currentValue
          : parseFloat(currentValue) || min;

      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">{numValue.toFixed(1)}</span>
            <span className="text-xs text-gray-500">
              {min} - {max}
            </span>
          </div>
          <Slider
            value={[numValue]}
            onValueChange={([value]) => handleInputChange(input.name, value)}
            min={min}
            max={max}
            step={step}
            className="w-full"
          />
        </div>
      );
    }

    // Multiline text with context support
    if (widgetType === "DYNAMIC_STRING" || widget?.parameters?.multiline) {
      // Filter out current input from available variables
      const contextVars = availableVariables.filter(
        (v: string) => v !== input.name,
      );

      return (
        <DynamicTextInput
          value={currentValue}
          onChange={(value) => handleInputChange(input.name, value)}
          placeholder={widget?.parameters?.placeholder || "Enter text..."}
          availableVariables={contextVars}
          nodeId={selectedNode.id}
        />
      );
    }

    // Select/Combo
    if (widgetType === "COMBO" && widget?.options) {
      return (
        <Select
          value={currentValue || undefined}
          onValueChange={(value) => handleInputChange(input.name, value)}
        >
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Select an option" />
          </SelectTrigger>
          <SelectContent>
            {widget.options.map((opt: string) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    // Default text input
    return (
      <Input
        value={currentValue}
        onChange={(e) => handleInputChange(input.name, e.target.value)}
        placeholder={
          widget?.parameters?.placeholder || `Enter ${input.name}...`
        }
        className="text-sm"
      />
    );
  };

  return (
    <div className="bg-editor-panel pointer-events-auto absolute top-4 right-4 flex w-96 flex-col gap-4 rounded-lg border p-4 shadow-xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-foreground text-lg font-semibold">
            {selectedNode.data.label}
          </h3>
          {nodeDef?.category && (
            <span className="bg-mint-4 text-mint-11 mt-1 inline-block rounded px-2 py-0.5 text-xs">
              {nodeDef.category}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Description */}
      {nodeDef?.short_description && (
        <p className="text-muted-foreground text-sm">
          {nodeDef.short_description}
        </p>
      )}

      {/* Inputs */}
      {nodeDef?.inputs && nodeDef.inputs.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-muted-foreground text-sm font-medium">
            Configuration
          </h4>
          {nodeDef.inputs.map((input: any) => {
            const renderedInput = renderInput(input);
            // Skip rendering if null (hidden based on conditions)
            if (renderedInput === null) return null;

            const isExposed = exposedInputs.includes(input.name);
            const nodeType = selectedNode.data.nodeType;
            const isSchemaNode = nodeType === "ProtoSchemaNode";
            const isOutputNode = nodeType === "ProtoOutputNode";

            // Don't show connect button for schema nodes or output nodes (config only)
            const showConnectButton = !isSchemaNode && !isOutputNode;

            // Check if this is a compact inline input (COMBO, non-multiline)
            const isInlineInput =
              input.widget?.widgetType === "COMBO" ||
              (input.widget?.widgetType === "SLIDER" &&
                input.name !== "temperature");

            return (
              <div
                key={input.name}
                className={isInlineInput ? "space-y-0" : "space-y-2"}
              >
                {isInlineInput ? (
                  // Inline layout for dropdowns/compact inputs
                  <div className="flex items-center justify-between gap-3">
                    <label className="text-muted-foreground text-sm font-medium whitespace-nowrap">
                      {input.name
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="w-[180px]">{renderedInput}</div>
                      {showConnectButton && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 px-0 flex-shrink-0"
                          onClick={() => toggleInputExposed(input.name)}
                          title={
                            isExposed
                              ? "Hide input handle"
                              : "Expose input handle"
                          }
                        >
                          {isExposed ? (
                            <PlugZap className="h-4 w-4" />
                          ) : (
                            <Plug className="h-4 w-4 opacity-40" />
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  // Stacked layout for text areas and other inputs
                  <>
                    <div className="flex items-center justify-between">
                      <label className="text-muted-foreground text-sm font-medium">
                        {input.name
                          .replace(/_/g, " ")
                          .replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </label>
                      {showConnectButton && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 px-0 flex-shrink-0"
                          onClick={() => toggleInputExposed(input.name)}
                          title={
                            isExposed
                              ? "Hide input handle"
                              : "Expose input handle"
                          }
                        >
                          {isExposed ? (
                            <PlugZap className="h-4 w-4" />
                          ) : (
                            <Plug className="h-4 w-4 opacity-40" />
                          )}
                        </Button>
                      )}
                    </div>
                    {renderedInput}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Dynamic Model Parameters based on model capabilities */}
      {currentModel && modelConfig && modelConfig.valid_params && (
        <div className="space-y-3">
          <h4 className="text-muted-foreground text-sm font-medium">
            Model Parameters
          </h4>
          {Object.entries(modelConfig.valid_params).map(
            ([paramName, paramConfig]) => {
              // Skip temperature - it's already rendered above
              if (paramName === "temperature") return null;

              const modelParams = nodeInputs["model_parameters"] || {};
              const currentValue = modelParams[paramName];

              // Determine default value - use registry default if available
              const getDefaultValue = () => {
                // Use default from model registry if available
                if (paramConfig.default !== undefined) {
                  return paramConfig.default;
                }

                // Fallback defaults based on type
                if (paramConfig.type === "int") {
                  return paramConfig.min || 1;
                }
                if (paramConfig.type === "float") {
                  return paramConfig.range ? paramConfig.range[0] : 0;
                }
                if (paramConfig.type === "enum" && paramConfig.values) {
                  return paramConfig.values[0];
                }
                if (paramConfig.type === "bool") {
                  return false;
                }
                return "";
              };

              const value = currentValue ?? getDefaultValue();

              // Render based on parameter type
              const label = paramName
                .replace(/_/g, " ")
                .replace(/\b\w/g, (l: string) => l.toUpperCase());

              // Enum type - render as select dropdown (inline)
              if (paramConfig.type === "enum" && paramConfig.values) {
                const enumValue = value || paramConfig.values[0];
                const isExposed = exposedInputs.includes(paramName);
                return (
                  <div
                    key={paramName}
                    className="flex items-center justify-between gap-3"
                  >
                    <label className="text-muted-foreground text-sm font-medium whitespace-nowrap">
                      {label}
                    </label>
                    <div className="flex items-center gap-2">
                      <Select
                        value={enumValue}
                        onValueChange={(newValue) =>
                          handleModelParameterChange(paramName, newValue)
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Select an option" />
                        </SelectTrigger>
                        <SelectContent>
                          {paramConfig.values.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 px-0 flex-shrink-0"
                        onClick={() => toggleInputExposed(paramName)}
                        title={
                          isExposed
                            ? "Hide input handle"
                            : "Expose input handle"
                        }
                      >
                        {isExposed ? (
                          <PlugZap className="h-4 w-4" />
                        ) : (
                          <Plug className="h-4 w-4 opacity-40" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              }

              // Bool type - render as switch (inline)
              if (paramConfig.type === "bool") {
                const boolValue = typeof value === "boolean" ? value : false;
                const isExposed = exposedInputs.includes(paramName);
                return (
                  <div
                    key={paramName}
                    className="flex items-center justify-between"
                  >
                    <label className="text-muted-foreground text-sm font-medium">
                      {label}
                    </label>
                    <div className="flex items-center gap-2">
                      <Switch
                        checked={boolValue}
                        onCheckedChange={(checked) =>
                          handleModelParameterChange(paramName, checked)
                        }
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 px-0 flex-shrink-0"
                        onClick={() => toggleInputExposed(paramName)}
                        title={
                          isExposed
                            ? "Hide input handle"
                            : "Expose input handle"
                        }
                      >
                        {isExposed ? (
                          <PlugZap className="h-4 w-4" />
                        ) : (
                          <Plug className="h-4 w-4 opacity-40" />
                        )}
                      </Button>
                    </div>
                  </div>
                );
              }

              // Int/Float type - render as slider (compact inline)
              if (paramConfig.type === "int" || paramConfig.type === "float") {
                const min = paramConfig.min || paramConfig.range?.[0] || 0;
                const max = paramConfig.max || paramConfig.range?.[1] || 100;
                const step = paramConfig.type === "float" ? 0.01 : 1;
                const isExposed = exposedInputs.includes(paramName);

                return (
                  <div key={paramName} className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <label className="text-muted-foreground text-sm font-medium whitespace-nowrap">
                        {label}
                      </label>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span className="font-medium text-gray-400">
                            {paramConfig.type === "float"
                              ? value.toFixed(2)
                              : value}
                          </span>
                          <span className="text-gray-600">
                            {min} - {max}
                          </span>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 px-0 flex-shrink-0"
                          onClick={() => toggleInputExposed(paramName)}
                          title={
                            isExposed
                              ? "Hide input handle"
                              : "Expose input handle"
                          }
                        >
                          {isExposed ? (
                            <PlugZap className="h-4 w-4" />
                          ) : (
                            <Plug className="h-4 w-4 opacity-40" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <Slider
                      value={[Number(value)]}
                      onValueChange={([newValue]) =>
                        handleModelParameterChange(paramName, newValue)
                      }
                      min={min}
                      max={max}
                      step={step}
                      className="w-full"
                    />
                  </div>
                );
              }

              return null;
            },
          )}
        </div>
      )}

      {/* No inputs message */}
      {(!nodeDef?.inputs || nodeDef.inputs.length === 0) && (
        <div className="text-center text-sm text-gray-500">
          No configuration needed
        </div>
      )}
    </div>
  );
};
