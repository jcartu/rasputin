import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Copy,
  Check,
  Eye,
  EyeOff,
  Variable,
  Sparkles,
  Type,
  Hash,
  ToggleLeft,
  Braces,
  Plus,
} from "lucide-react";

export interface PromptVariable {
  name: string;
  description?: string;
  defaultValue?: string;
  type: "string" | "number" | "boolean" | "json";
}

interface PromptEditorProps {
  value: string;
  onChange: (value: string) => void;
  variables?: PromptVariable[];
  onVariablesChange?: (vars: PromptVariable[]) => void;
  readOnly?: boolean;
  showLineNumbers?: boolean;
  showVariablePanel?: boolean;
  placeholder?: string;
  className?: string;
  variableValues?: Record<string, string>;
  onVariableValuesChange?: (values: Record<string, string>) => void;
}

const VARIABLE_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

const typeIcons = {
  string: Type,
  number: Hash,
  boolean: ToggleLeft,
  json: Braces,
};

function extractVariableNames(content: string): string[] {
  const names: string[] = [];
  const regex = new RegExp(VARIABLE_PATTERN.source, "g");
  let match = regex.exec(content);
  while (match !== null) {
    if (!names.includes(match[1])) {
      names.push(match[1]);
    }
    match = regex.exec(content);
  }
  return names;
}

export function PromptEditor({
  value,
  onChange,
  variables = [],
  onVariablesChange,
  readOnly = false,
  showLineNumbers = true,
  showVariablePanel = true,
  placeholder = "Write your prompt here...\n\nUse {{variable_name}} for dynamic content.",
  className,
  variableValues = {},
  onVariableValuesChange,
}: PromptEditorProps) {
  const [copied, setCopied] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "variables">("edit");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  const extractedVariables = useMemo((): PromptVariable[] => {
    const uniqueNames = extractVariableNames(value);
    return uniqueNames.map((name) => {
      const existing = variables.find((v) => v.name === name);
      return existing || { name, type: "string" as const, description: undefined, defaultValue: undefined };
    });
  }, [value, variables]);

  useEffect(() => {
    if (onVariablesChange) {
      const existingNames = new Set(variables.map((v) => v.name));
      const extractedNames = new Set(extractedVariables.map((v) => v.name));

      const hasChanges =
        extractedVariables.length !== variables.length ||
        extractedVariables.some((v) => !existingNames.has(v.name)) ||
        variables.some((v) => !extractedNames.has(v.name));

      if (hasChanges) {
        onVariablesChange(extractedVariables);
      }
    }
  }, [extractedVariables, variables, onVariablesChange]);

  const highlightedContent = useMemo(() => {
    if (!value) return "";

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let key = 0;

    const regex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
    let match = regex.exec(value);

    while (match !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={key++}>{value.slice(lastIndex, match.index)}</span>
        );
      }

      parts.push(
        <span
          key={key++}
          className="bg-gradient-to-r from-cyan-500/20 to-teal-500/20 text-cyan-400 rounded px-1 font-semibold border border-cyan-500/30"
        >
          {match[0]}
        </span>
      );

      lastIndex = regex.lastIndex;
      match = regex.exec(value);
    }

    if (lastIndex < value.length) {
      parts.push(<span key={key++}>{value.slice(lastIndex)}</span>);
    }

    return parts;
  }, [value]);

  const previewContent = useMemo(() => {
    let result = value;
    extractedVariables.forEach((variable) => {
      const varValue =
        variableValues[variable.name] ||
        variable.defaultValue ||
        `[${variable.name}]`;
      result = result.replace(
        new RegExp(`\\{\\{${variable.name}\\}\\}`, "g"),
        varValue
      );
    });
    return result;
  }, [value, extractedVariables, variableValues]);

  const lineNumbers = useMemo(() => {
    const content = previewMode ? previewContent : value;
    return content.split("\n").map((_, i) => i + 1);
  }, [value, previewContent, previewMode]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(previewMode ? previewContent : value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [value, previewContent, previewMode]);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const updateVariable = useCallback(
    (index: number, updates: Partial<PromptVariable>) => {
      if (!onVariablesChange) return;
      const newVars = [...extractedVariables];
      newVars[index] = { ...newVars[index], ...updates };
      onVariablesChange(newVars);
    },
    [extractedVariables, onVariablesChange]
  );

  const insertVariable = useCallback(
    (varName: string) => {
      if (!textareaRef.current || readOnly) return;
      const start = textareaRef.current.selectionStart;
      const end = textareaRef.current.selectionEnd;
      const newValue =
        value.slice(0, start) + `{{${varName}}}` + value.slice(end);
      onChange(newValue);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart =
            textareaRef.current.selectionEnd = start + varName.length + 4;
          textareaRef.current.focus();
        }
      }, 0);
    },
    [value, onChange, readOnly]
  );

  return (
    <div className={cn("flex gap-4 h-full min-h-[400px]", className)}>
      <Card className="flex-1 flex flex-col overflow-hidden bg-zinc-950 border-zinc-800">
        <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800 bg-zinc-900/50">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cyan-400" />
            <span className="text-sm font-medium text-zinc-300">
              Prompt Editor
            </span>
            {extractedVariables.length > 0 && (
              <Badge
                variant="secondary"
                className="bg-cyan-500/10 text-cyan-400 border-cyan-500/30"
              >
                {extractedVariables.length} variable
                {extractedVariables.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewMode(!previewMode)}
                  className={cn(
                    "h-8 px-2",
                    previewMode && "bg-cyan-500/10 text-cyan-400"
                  )}
                >
                  {previewMode ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {previewMode ? "Hide Preview" : "Show Preview"}
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 px-2"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copy to clipboard</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 flex">
            {showLineNumbers && (
              <div className="w-12 flex-shrink-0 bg-zinc-900/30 border-r border-zinc-800 overflow-hidden">
                <div className="py-4 px-2 font-mono text-sm text-zinc-600 text-right select-none">
                  {lineNumbers.map((num) => (
                    <div key={num} className="leading-6 h-6">
                      {num}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex-1 relative overflow-hidden">
              {previewMode ? (
                <ScrollArea className="h-full">
                  <div className="p-4 font-mono text-sm leading-6 whitespace-pre-wrap text-zinc-300">
                    {previewContent || (
                      <span className="text-zinc-600">{placeholder}</span>
                    )}
                  </div>
                </ScrollArea>
              ) : (
                <>
                  <div
                    ref={highlightRef}
                    className="absolute inset-0 p-4 font-mono text-sm leading-6 whitespace-pre-wrap overflow-auto pointer-events-none text-zinc-300"
                    aria-hidden="true"
                  >
                    {highlightedContent || (
                      <span className="text-zinc-600">{placeholder}</span>
                    )}
                  </div>

                  <textarea
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onScroll={handleScroll}
                    readOnly={readOnly}
                    placeholder=""
                    className={cn(
                      "absolute inset-0 w-full h-full p-4 font-mono text-sm leading-6",
                      "bg-transparent text-transparent caret-cyan-400",
                      "resize-none outline-none border-none",
                      "selection:bg-cyan-500/30",
                      readOnly && "cursor-default"
                    )}
                    spellCheck={false}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </Card>

      {showVariablePanel && (
        <Card className="w-80 flex flex-col overflow-hidden bg-zinc-950 border-zinc-800">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as "edit" | "variables")}
            className="flex flex-col h-full"
          >
            <div className="border-b border-zinc-800">
              <TabsList className="w-full justify-start rounded-none bg-transparent border-none h-12 p-0">
                <TabsTrigger
                  value="edit"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-400 data-[state=active]:bg-transparent"
                >
                  <Variable className="h-4 w-4 mr-2" />
                  Variables
                </TabsTrigger>
                <TabsTrigger
                  value="variables"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-cyan-400 data-[state=active]:bg-transparent"
                >
                  <Type className="h-4 w-4 mr-2" />
                  Values
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="edit" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-3">
                  {extractedVariables.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                      <Variable className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No variables detected</p>
                      <p className="text-xs mt-1">
                        Use {"{{variable_name}}"} syntax
                      </p>
                    </div>
                  ) : (
                    extractedVariables.map((variable, index) => {
                      const Icon = typeIcons[variable.type];
                      return (
                        <Card
                          key={variable.name}
                          className="p-3 bg-zinc-900/50 border-zinc-800 hover:border-cyan-500/30 transition-colors"
                        >
                          <div className="flex items-start gap-3">
                            <div className="p-2 rounded-lg bg-cyan-500/10">
                              <Icon className="h-4 w-4 text-cyan-400" />
                            </div>
                            <div className="flex-1 min-w-0 space-y-2">
                              <div className="flex items-center justify-between">
                                <code className="text-sm font-semibold text-cyan-400">
                                  {`{{${variable.name}}}`}
                                </code>
                                <select
                                  value={variable.type}
                                  onChange={(e) =>
                                    updateVariable(index, {
                                      type: e.target.value as PromptVariable["type"],
                                    })
                                  }
                                  className="text-xs bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300"
                                >
                                  <option value="string">String</option>
                                  <option value="number">Number</option>
                                  <option value="boolean">Boolean</option>
                                  <option value="json">JSON</option>
                                </select>
                              </div>
                              <Input
                                placeholder="Description (optional)"
                                value={variable.description || ""}
                                onChange={(e) =>
                                  updateVariable(index, {
                                    description: e.target.value,
                                  })
                                }
                                className="h-8 text-xs bg-zinc-800 border-zinc-700"
                              />
                              <Input
                                placeholder="Default value"
                                value={variable.defaultValue || ""}
                                onChange={(e) =>
                                  updateVariable(index, {
                                    defaultValue: e.target.value,
                                  })
                                }
                                className="h-8 text-xs bg-zinc-800 border-zinc-700"
                              />
                            </div>
                          </div>
                        </Card>
                      );
                    })
                  )}

                  {!readOnly && (
                    <div className="pt-3 border-t border-zinc-800">
                      <p className="text-xs text-zinc-500 mb-2">Quick Insert</p>
                      <div className="flex flex-wrap gap-1">
                        {["input", "context", "task", "format", "example"].map(
                          (name) => (
                            <Button
                              key={name}
                              variant="ghost"
                              size="sm"
                              onClick={() => insertVariable(name)}
                              className="h-7 px-2 text-xs hover:bg-cyan-500/10 hover:text-cyan-400"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              {name}
                            </Button>
                          )
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent
              value="variables"
              className="flex-1 m-0 overflow-hidden"
            >
              <ScrollArea className="h-full">
                <div className="p-4 space-y-3">
                  {extractedVariables.length === 0 ? (
                    <div className="text-center py-8 text-zinc-500">
                      <Type className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No variables to fill</p>
                    </div>
                  ) : (
                    extractedVariables.map((variable) => (
                      <div key={variable.name} className="space-y-1.5">
                        <Label className="text-xs text-zinc-400 flex items-center gap-2">
                          <code className="text-cyan-400">{variable.name}</code>
                          {variable.description && (
                            <span className="text-zinc-500 truncate">
                              - {variable.description}
                            </span>
                          )}
                        </Label>
                        <Input
                          value={variableValues[variable.name] || ""}
                          onChange={(e) =>
                            onVariableValuesChange?.({
                              ...variableValues,
                              [variable.name]: e.target.value,
                            })
                          }
                          placeholder={
                            variable.defaultValue || `Enter ${variable.name}`
                          }
                          className="bg-zinc-800 border-zinc-700"
                        />
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </Card>
      )}
    </div>
  );
}

export default PromptEditor;
