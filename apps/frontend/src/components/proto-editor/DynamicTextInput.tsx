import { Plus, Maximize2, Circle } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";

type DynamicTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  availableVariables: string[];
  nodeId?: string;
};

export const DynamicTextInput = ({
  value,
  onChange,
  placeholder,
  availableVariables,
}: DynamicTextInputProps) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleInsertVariable = useCallback(
    (variable: string, element?: HTMLTextAreaElement) => {
      const textarea =
        element ?? (document.activeElement as HTMLTextAreaElement);
      if (textarea?.tagName === "TEXTAREA") {
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue =
          value.slice(0, start) + `{{${variable}}}` + value.slice(end);
        onChange(newValue);
      } else {
        onChange(value + `{{${variable}}}`);
      }
      setIsPopoverOpen(false);
    },
    [value, onChange],
  );

  return (
    <>
      <div className="group bg-background focus-within:ring-opacity-50 border-node-input relative flex h-24 flex-row rounded text-sm border p-3">
        <textarea
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="focus:ring:none h-20 w-full resize-none border-none! text-sm outline-none! placeholder:text-sm"
        />
        {/* Bottom-left expand button and bottom-right add context button */}
        <div className="absolute right-1 bottom-1 left-1 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="hover:bg-accent size-6 opacity-0 group-hover:opacity-100"
            onClick={() => setIsModalOpen(true)}
            title="Expand prompt"
          >
            <Maximize2 className="!size-2" />
          </Button>

          {availableVariables.length > 0 && (
            <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  title="Add context"
                  className="text-muted-foreground hover:text-foreground opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <span>Add Context</span>
                  <Plus className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-44 p-2" align="end" side="top">
                <div className="flex max-h-80 flex-col gap-1 overflow-y-auto">
                  {availableVariables.map((variable) => (
                    <Button
                      size="xs"
                      variant="ghost"
                      key={variable}
                      onClick={() => handleInsertVariable(variable)}
                      className="w-full justify-start"
                    >
                      <Circle className="!size-3" />
                      <code className="text-muted-foreground text-xxs truncate">
                        {variable}
                      </code>
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>

      {/* Expand Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogTitle className="text-lg font-semibold">
            Edit prompt
          </DialogTitle>

          <div className="relative">
            <Textarea
              data-modal-textarea
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-96 resize-none pr-12 text-sm"
              placeholder={placeholder}
            />
            {/* Bottom-right add context button in modal */}
            {availableVariables.length > 0 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" title="Add context">
                    <Plus className="h-3 w-3" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-64 p-2" align="end" side="top">
                  <div className="max-h-80 space-y-1 overflow-y-auto">
                    {availableVariables.map((variable) => (
                      <button
                        key={variable}
                        onClick={() => {
                          const textarea = document.querySelector(
                            "[data-modal-textarea]",
                          ) as HTMLTextAreaElement;
                          handleInsertVariable(variable, textarea);
                        }}
                        className="hover:bg-accent flex w-full flex-col gap-0.5 rounded px-2 py-1.5 text-left transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <code className="text-muted-foreground truncate font-mono text-xs">
                            {variable}
                          </code>
                        </div>
                      </button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => setIsModalOpen(false)}>Save</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
