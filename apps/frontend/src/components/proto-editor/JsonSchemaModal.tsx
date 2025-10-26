/**
 * JsonSchemaModal - Modal for configuring JSON schema
 * Simple interface to add/remove properties with name, type, and description
 */

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus } from "lucide-react";
import { useState, useEffect } from "react";

interface SchemaProperty {
  name: string;
  type: string;
  description: string;
}

interface JsonSchemaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  schema: any;
  onSave: (schema: any) => void;
}

export const JsonSchemaModal = ({
  open,
  onOpenChange,
  schema,
  onSave,
}: JsonSchemaModalProps) => {
  const [schemaName, setSchemaName] = useState("response_schema");
  const [properties, setProperties] = useState<SchemaProperty[]>([]);

  // Initialize from existing schema
  useEffect(() => {
    if (schema && schema.name) {
      setSchemaName(schema.name);
    }
    if (schema && schema.properties) {
      const props = Object.entries(schema.properties).map(
        ([name, prop]: [string, any]) => ({
          name,
          type: prop.type || "string",
          description: prop.description || "",
        }),
      );
      setProperties(props);
    } else {
      // Default to one empty property
      setProperties([{ name: "name", type: "string", description: "" }]);
    }
  }, [schema, open]);

  const addProperty = () => {
    setProperties([
      ...properties,
      { name: "", type: "string", description: "" },
    ]);
  };

  const removeProperty = (index: number) => {
    setProperties(properties.filter((_, i) => i !== index));
  };

  const updateProperty = (
    index: number,
    field: keyof SchemaProperty,
    value: string,
  ) => {
    const updated = [...properties];
    updated[index][field] = value;
    setProperties(updated);
  };

  const handleSave = () => {
    // Convert to JSON schema format
    const schemaObj = {
      name: schemaName,
      properties: properties.reduce(
        (acc, prop) => {
          if (prop.name) {
            acc[prop.name] = {
              type: prop.type,
              description: prop.description,
            };
          }
          return acc;
        },
        {} as Record<string, any>,
      ),
    };
    onSave(schemaObj);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Structured output (JSON)</DialogTitle>
          <DialogDescription>
            The model will generate a JSON object that matches this schema.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Schema Name */}
          <div>
            <Label htmlFor="schema-name">Name</Label>
            <Input
              id="schema-name"
              value={schemaName}
              onChange={(e) => setSchemaName(e.target.value)}
              placeholder="response_schema"
              className="mt-1"
            />
          </div>

          {/* Properties */}
          <div>
            <Label className="mb-2 block">Properties</Label>
            <div className="space-y-2">
              {/* Header */}
              <div className="grid grid-cols-[1fr_150px_2fr_40px] gap-2 text-sm font-medium text-gray-500">
                <div>Name</div>
                <div>Type</div>
                <div>Description</div>
                <div></div>
              </div>

              {/* Property Rows */}
              {properties.map((prop, index) => (
                <div
                  key={index}
                  className="grid grid-cols-[1fr_150px_2fr_40px] gap-2"
                >
                  <Input
                    value={prop.name}
                    onChange={(e) =>
                      updateProperty(index, "name", e.target.value)
                    }
                    placeholder="Property name"
                  />
                  <Select
                    value={prop.type}
                    onValueChange={(value) =>
                      updateProperty(index, "type", value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="string">STR</SelectItem>
                      <SelectItem value="number">NUM</SelectItem>
                      <SelectItem value="boolean">BOOL</SelectItem>
                      <SelectItem value="array">ARR</SelectItem>
                      <SelectItem value="object">OBJ</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    value={prop.description}
                    onChange={(e) =>
                      updateProperty(index, "description", e.target.value)
                    }
                    placeholder="Add description"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeProperty(index)}
                    className="h-9 w-9"
                    disabled={properties.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Add Property Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={addProperty}
              className="mt-2"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add property
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Update</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
