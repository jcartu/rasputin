import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { PromptEditor, PromptVariable } from "@/components/PromptEditor";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import {
  Play,
  Square,
  Copy,
  Check,
  Save,
  Clock,
  Zap,
  DollarSign,
  RefreshCw,
  History,
  ChevronRight,
  Sparkles,
  Settings2,
  Loader2,
} from "lucide-react";

interface PlaygroundProps {
  initialPrompt?: string;
  initialVariables?: PromptVariable[];
  onSave?: (prompt: string, variables: PromptVariable[]) => void;
  className?: string;
}

interface RunHistoryItem {
  id: string;
  timestamp: Date;
  model: string;
  input: string;
  output: string;
  latencyMs: number;
  tokens: { input: number; output: number };
  cost: number;
  success: boolean;
}

const MODELS = [
  { id: "gpt-4-turbo", name: "GPT-4 Turbo", provider: "OpenAI" },
  { id: "claude-3-opus", name: "Claude 3 Opus", provider: "Anthropic" },
  { id: "claude-3-sonnet", name: "Claude 3 Sonnet", provider: "Anthropic" },
  { id: "gemini-pro", name: "Gemini Pro", provider: "Google" },
];

export function PromptPlayground({
  initialPrompt = "",
  initialVariables = [],
  onSave,
  className,
}: PlaygroundProps) {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [variables, setVariables] = useState<PromptVariable[]>(initialVariables);
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState("");
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [runHistory, setRunHistory] = useState<RunHistoryItem[]>([]);
  const [lastRun, setLastRun] = useState<{ latencyMs: number; tokens: { input: number; output: number }; cost: number } | null>(null);

  const handleRun = useCallback(async () => {
    setIsRunning(true);
    setOutput("");

    let resolvedPrompt = prompt;
    variables.forEach((v) => {
      const value = variableValues[v.name] || v.defaultValue || "";
      resolvedPrompt = resolvedPrompt.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, "g"), value);
    });

    await new Promise((r) => setTimeout(r, 500));

    const mockOutput = `Based on your prompt, here's a simulated response:

The analysis shows several key points:

1. **First Observation**: The prompt structure is well-defined with clear variable placeholders.

2. **Processing Details**: 
   - Model: ${selectedModel}
   - Temperature: ${temperature}
   - Max Tokens: ${maxTokens}

3. **Variable Values Used**:
${variables.map((v) => `   - ${v.name}: "${variableValues[v.name] || v.defaultValue || "(empty)"}"`).join("\n")}

4. **Recommendations**: Consider adjusting the temperature for more creative or deterministic outputs.

This is a simulated response for demonstration purposes.`;

    for (let i = 0; i < mockOutput.length; i += 10) {
      await new Promise((r) => setTimeout(r, 20));
      setOutput(mockOutput.slice(0, i + 10));
    }
    setOutput(mockOutput);

    const runStats = {
      latencyMs: Math.floor(Math.random() * 2000) + 500,
      tokens: { input: Math.floor(Math.random() * 500) + 100, output: Math.floor(Math.random() * 800) + 200 },
      cost: parseFloat((Math.random() * 0.05).toFixed(4)),
    };

    setLastRun(runStats);

    const historyItem: RunHistoryItem = {
      id: Date.now().toString(),
      timestamp: new Date(),
      model: selectedModel,
      input: resolvedPrompt,
      output: mockOutput,
      ...runStats,
      success: true,
    };
    setRunHistory((prev) => [historyItem, ...prev].slice(0, 10));

    setIsRunning(false);
  }, [prompt, variables, variableValues, selectedModel, temperature, maxTokens]);

  const handleCopyOutput = useCallback(async () => {
    await navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [output]);

  const handleSave = useCallback(() => {
    onSave?.(prompt, variables);
  }, [prompt, variables, onSave]);

  return (
    <div className={cn("h-full flex flex-col bg-zinc-950", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-semibold text-white">Prompt Playground</h2>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className={cn(showHistory && "bg-cyan-500/10 text-cyan-400")}
          >
            <History className="h-4 w-4 mr-2" />
            History
          </Button>
          {onSave && (
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="h-4 w-4 mr-2" />
              Save
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        <PanelGroup direction="horizontal" className="flex-1">
          <Panel defaultSize={50} minSize={30}>
            <div className="h-full flex flex-col border-r border-zinc-800">
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
                <h3 className="text-sm font-medium text-zinc-300 mb-3">Prompt Editor</h3>
              </div>
              <div className="flex-1 overflow-hidden">
                <PromptEditor
                  value={prompt}
                  onChange={setPrompt}
                  variables={variables}
                  onVariablesChange={setVariables}
                  variableValues={variableValues}
                  onVariableValuesChange={setVariableValues}
                  showVariablePanel={false}
                  className="h-full"
                />
              </div>
            </div>
          </Panel>

          <PanelResizeHandle className="w-1 bg-zinc-800 hover:bg-cyan-500/50 transition-colors" />

          <Panel defaultSize={20} minSize={15}>
            <ScrollArea className="h-full">
              <div className="p-4 space-y-6">
                <div>
                  <h3 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    Model Settings
                  </h3>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-500">Model</Label>
                      <Select value={selectedModel} onValueChange={setSelectedModel}>
                        <SelectTrigger className="bg-zinc-900 border-zinc-700">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODELS.map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              <span className="flex items-center gap-2">
                                {model.name}
                                <Badge variant="secondary" className="text-xs">{model.provider}</Badge>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-zinc-500">Temperature</Label>
                        <span className="text-xs text-cyan-400 font-mono">{temperature}</span>
                      </div>
                      <Slider
                        value={[temperature]}
                        onValueChange={([v]) => setTemperature(v)}
                        min={0}
                        max={2}
                        step={0.1}
                        className="w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs text-zinc-500">Max Tokens</Label>
                      <Input
                        type="number"
                        value={maxTokens}
                        onChange={(e) => setMaxTokens(parseInt(e.target.value) || 0)}
                        className="bg-zinc-900 border-zinc-700"
                      />
                    </div>
                  </div>
                </div>

                <Separator className="bg-zinc-800" />

                {variables.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-zinc-300 mb-3">Variables</h3>
                    <div className="space-y-3">
                      {variables.map((v) => (
                        <div key={v.name} className="space-y-1">
                          <Label className="text-xs text-zinc-500 flex items-center gap-1">
                            <code className="text-cyan-400">{v.name}</code>
                            <Badge variant="secondary" className="text-[10px] h-4">{v.type}</Badge>
                          </Label>
                          <Input
                            value={variableValues[v.name] || ""}
                            onChange={(e) => setVariableValues({ ...variableValues, [v.name]: e.target.value })}
                            placeholder={v.defaultValue || `Enter ${v.name}`}
                            className="bg-zinc-900 border-zinc-700 text-sm"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleRun}
                  disabled={isRunning || !prompt}
                  className="w-full bg-cyan-600 hover:bg-cyan-700"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Run Prompt
                    </>
                  )}
                </Button>
              </div>
            </ScrollArea>
          </Panel>

          <PanelResizeHandle className="w-1 bg-zinc-800 hover:bg-cyan-500/50 transition-colors" />

          <Panel defaultSize={30} minSize={20}>
            <div className="h-full flex flex-col">
              <div className="p-4 border-b border-zinc-800 bg-zinc-900/30">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-medium text-zinc-300">Output</h3>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyOutput}
                    disabled={!output}
                    className="h-7 px-2"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <ScrollArea className="flex-1">
                <div className="p-4">
                  {output ? (
                    <div className="prose prose-invert prose-sm max-w-none">
                      <pre className="whitespace-pre-wrap font-mono text-sm text-zinc-300 bg-transparent p-0">
                        {output}
                        {isRunning && <span className="animate-pulse">|</span>}
                      </pre>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-48 text-zinc-500">
                      <Zap className="h-8 w-8 mb-2 opacity-50" />
                      <p className="text-sm">Run your prompt to see output</p>
                    </div>
                  )}
                </div>
              </ScrollArea>

              {lastRun && (
                <div className="p-4 border-t border-zinc-800 bg-zinc-900/30">
                  <div className="flex items-center justify-between text-xs text-zinc-500">
                    <div className="flex items-center gap-4">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {lastRun.latencyMs}ms
                      </span>
                      <span className="flex items-center gap-1">
                        <Zap className="h-3 w-3" />
                        {lastRun.tokens.input + lastRun.tokens.output} tokens
                      </span>
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        ${lastRun.cost.toFixed(4)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Panel>
        </PanelGroup>

        {showHistory && (
          <div className="w-72 border-l border-zinc-800 bg-zinc-900/50">
            <div className="p-4 border-b border-zinc-800">
              <h3 className="text-sm font-medium text-zinc-300">Run History</h3>
            </div>
            <ScrollArea className="h-[calc(100%-57px)]">
              <div className="p-2 space-y-2">
                {runHistory.length === 0 ? (
                  <div className="text-center py-8 text-zinc-500">
                    <History className="h-6 w-6 mx-auto mb-2 opacity-50" />
                    <p className="text-xs">No history yet</p>
                  </div>
                ) : (
                  runHistory.map((run) => (
                    <Card
                      key={run.id}
                      className="bg-zinc-800/50 border-zinc-700 hover:border-cyan-500/30 cursor-pointer transition-colors"
                      onClick={() => setOutput(run.output)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="secondary" className="text-xs">{run.model}</Badge>
                          <span className="text-[10px] text-zinc-500">
                            {run.timestamp.toLocaleTimeString()}
                          </span>
                        </div>
                        <p className="text-xs text-zinc-400 line-clamp-2">{run.output.slice(0, 100)}...</p>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-zinc-500">
                          <span>{run.latencyMs}ms</span>
                          <span>{run.tokens.input + run.tokens.output} tok</span>
                          <span>${run.cost.toFixed(4)}</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}

export default PromptPlayground;
