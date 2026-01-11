import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useAuth } from "@/_core/hooks/useAuth";
// Google-only auth - redirect to /login page
import { trpc } from "@/lib/trpc";
import { ChatSidebar } from "@/components/ChatSidebar";
import { ChatMain } from "@/components/ChatMain";
import { StreamingThinkingPanel } from "@/components/StreamingThinkingPanel";
import _SplashScreen from "@/components/SplashScreen";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWebSocket } from "@/hooks/useWebSocket";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { UserProfileMenu } from "@/components/UserProfileMenu";
import { ApprovalBadge, ApprovalWorkflow } from "@/components/ApprovalWorkflow";
import {
  Loader2,
  PanelLeftClose,
  PanelLeft,
  PanelRightClose,
  PanelRight,
  Wifi,
  WifiOff,
  Download,
  Smartphone,
  Bot,
  Activity,
  Server,
  Users,
  GitBranch,
  Webhook,
  ChevronDown,
} from "lucide-react";
import type {
  QueryMode,
  SpeedTier,
  SynthesisStage,
} from "../../../shared/rasputin";

// ============================================================================
// Types
// ============================================================================

interface ModelStatus {
  modelId: string;
  modelName: string;
  status: "pending" | "streaming" | "completed" | "error";
  content: string;
  latencyMs?: number;
  tokenCount?: number;
  cost?: number;
  errorMessage?: string;
}

interface PipelineStageStatus {
  stage: SynthesisStage;
  status: "pending" | "running" | "completed" | "error";
  output?: string;
}

// Model name mapping
const MODEL_NAMES: Record<string, string> = {
  "gpt-5": "GPT-5",
  "gpt-5.2-pro": "GPT-5.2 Pro",
  "claude-sonnet-4.5": "Claude Sonnet 4.5",
  "claude-opus-4.5": "Claude Opus 4.5",
  "gemini-3-flash": "Gemini 3 Flash",
  "gemini-3-pro": "Gemini 3 Pro",
  "grok-4.1": "Grok 4.1",
  "grok-4.1-pro": "Grok 4.1 Pro",
  "sonar-pro": "Sonar Pro",
  "cerebras-llama-70b": "Cerebras Llama 70B",
  "cerebras-qwen-32b": "Cerebras Qwen 32B",
};

// ============================================================================
// Chat Page Component
// ============================================================================

export default function Chat() {
  const params = useParams<{ id?: string }>();
  const [, navigate] = useLocation();
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const {
    isInstallable: _isInstallable,
    isInstalled,
    install,
    showManualInstructions,
    dismissManualInstructions,
    getManualInstructions,
  } = usePWAInstall();

  // UI State
  const [_showSplash, _setShowSplash] = useState(false); // Disabled splash screen
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [thinkingPanelOpen, setThinkingPanelOpen] = useState(true);

  // Chat State
  const [currentChatId, setCurrentChatId] = useState<number | null>(
    params.id ? parseInt(params.id) : null
  );
  const [mode, setMode] = useState<QueryMode>("consensus");
  const [speedTier, setSpeedTier] = useState<SpeedTier>("normal");
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [useStreaming, _setUseStreaming] = useState(true); // Toggle for streaming mode

  // Model/Pipeline State for Thinking Panel
  const [modelStatuses, setModelStatuses] = useState<Map<string, ModelStatus>>(
    new Map()
  );
  const [pipelineStages, setPipelineStages] = useState<PipelineStageStatus[]>(
    []
  );
  const [consensusInProgress, setConsensusInProgress] = useState(false);

  // Refs
  const processingRef = useRef(false);
  const modeInitializedRef = useRef(false);

  // tRPC
  const utils = trpc.useUtils();
  const createChatMutation = trpc.chats.create.useMutation();
  const updateChatMutation = trpc.chats.update.useMutation();
  const submitQueryMutation = trpc.query.submit.useMutation();
  const generateTitleMutation = trpc.chats.generateTitle.useMutation();
  const cleanupEmptyMutation = trpc.chats.cleanupEmpty.useMutation({
    onSuccess: data => {
      if (data.deletedCount > 0) {
        console.info(`[Cleanup] Removed ${data.deletedCount} empty chats`);
        utils.chats.list.invalidate();
      }
    },
  });

  const {
    data: chatData,
    isLoading: chatLoading,
    refetch: refetchChat,
  } = trpc.chats.get.useQuery(
    { chatId: currentChatId! },
    { enabled: !!currentChatId }
  );

  // WebSocket streaming
  const {
    isConnected,
    isQuerying: _isQuerying,
    logs,
    startQuery,
    cancelQuery: _cancelQuery,
    clearLogs,
  } = useWebSocket({
    onModelStatus: update => {
      setModelStatuses(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(update.modelId);
        newMap.set(update.modelId, {
          modelId: update.modelId,
          modelName: MODEL_NAMES[update.modelId] || update.modelId,
          status: update.status,
          content: existing?.content || "",
          latencyMs: update.latencyMs,
          tokenCount: update.tokenCount,
          cost: update.cost,
          errorMessage: update.errorMessage,
        });
        return newMap;
      });
    },
    onModelStream: update => {
      setModelStatuses(prev => {
        const newMap = new Map(prev);
        const existing = newMap.get(update.modelId);
        if (existing) {
          newMap.set(update.modelId, {
            ...existing,
            content: update.fullContent,
          });
        }
        return newMap;
      });
    },
    onPipelineStage: update => {
      setPipelineStages(prev => {
        const newStages = [...prev];
        const index = newStages.findIndex(s => s.stage === update.stage);
        if (index >= 0) {
          newStages[index] = {
            stage: update.stage,
            status: update.status,
            output: update.output,
          };
        }
        return newStages;
      });
    },
    onConsensusStart: () => {
      setConsensusInProgress(true);
    },
    onConsensusComplete: async _data => {
      setConsensusInProgress(false);
      setIsProcessing(false);
      processingRef.current = false;
      const updatedChat = await refetchChat();
      // Auto-generate title if this is the first exchange
      if (
        updatedChat.data?.messageCount === 2 &&
        updatedChat.data?.title === "New Chat" &&
        currentChatId
      ) {
        const messages = updatedChat.data.messages;
        const firstUserMessage = messages?.find(m => m.role === "user");
        if (firstUserMessage) {
          generateTitleMutation.mutate(
            { chatId: currentChatId, firstMessage: firstUserMessage.content },
            {
              onSuccess: () => {
                utils.chats.list.invalidate();
                refetchChat();
              },
            }
          );
        }
      }
      utils.chats.list.invalidate();
    },
    onSynthesisComplete: async _data => {
      setIsProcessing(false);
      processingRef.current = false;
      // Mark all stages as completed
      setPipelineStages(prev =>
        prev.map(s => ({ ...s, status: "completed" as const }))
      );
      const updatedChat = await refetchChat();
      // Auto-generate title if this is the first exchange
      if (
        updatedChat.data?.messageCount === 2 &&
        updatedChat.data?.title === "New Chat" &&
        currentChatId
      ) {
        const messages = updatedChat.data.messages;
        const firstUserMessage = messages?.find(m => m.role === "user");
        if (firstUserMessage) {
          generateTitleMutation.mutate(
            { chatId: currentChatId, firstMessage: firstUserMessage.content },
            {
              onSuccess: () => {
                utils.chats.list.invalidate();
                refetchChat();
              },
            }
          );
        }
      }
      utils.chats.list.invalidate();
    },
    onError: error => {
      console.error("WebSocket error:", error);
      setIsProcessing(false);
      processingRef.current = false;
    },
  });

  // Handle splash screen (disabled)
  // useEffect(() => {
  //   const timer = setTimeout(() => {
  //     _setShowSplash(false);
  //   }, 2000);
  //   return () => clearTimeout(timer);
  // }, []);

  // Auto-cleanup empty chats on initial load (once per session)
  const cleanupRanRef = useRef(false);
  useEffect(() => {
    if (isAuthenticated && !cleanupRanRef.current) {
      cleanupRanRef.current = true;
      // Run cleanup after a short delay to not block initial render
      const timer = setTimeout(() => {
        cleanupEmptyMutation.mutate();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated]);

  // Update URL when chat changes
  useEffect(() => {
    if (params.id) {
      const chatId = parseInt(params.id);
      if (chatId !== currentChatId) {
        setCurrentChatId(chatId);
      }
    }
  }, [params.id, currentChatId]);

  // Sync mode from chat data (only on initial load)
  useEffect(() => {
    if (chatData && !modeInitializedRef.current) {
      setMode(chatData.mode as QueryMode);
      setSpeedTier(chatData.speedTier as SpeedTier);
      modeInitializedRef.current = true;
    }
  }, [chatData]);

  // Reset mode initialized flag when chat changes
  useEffect(() => {
    modeInitializedRef.current = false;
  }, [currentChatId]);

  // Create new chat
  const handleNewChat = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      const newChat = await createChatMutation.mutateAsync({
        title: "New Chat",
        mode,
        speedTier,
      });
      setCurrentChatId(newChat.id);
      navigate(`/chat/${newChat.id}`);
      utils.chats.list.invalidate();
      // Reset thinking panel
      setModelStatuses(new Map());
      setPipelineStages([]);
      clearLogs();
    } catch (error) {
      console.error("Failed to create chat:", error);
    }
  }, [
    isAuthenticated,
    mode,
    speedTier,
    createChatMutation,
    navigate,
    utils,
    clearLogs,
  ]);

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+N or Cmd+N for new chat
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        handleNewChat();
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleNewChat]);

  // Select existing chat
  const handleSelectChat = useCallback(
    (chatId: number) => {
      setCurrentChatId(chatId);
      navigate(`/chat/${chatId}`);
      // Reset thinking panel state
      setModelStatuses(new Map());
      setPipelineStages([]);
      setConsensusInProgress(false);
      clearLogs();
      modeInitializedRef.current = false;
    },
    [navigate, clearLogs]
  );

  // Submit query - with WebSocket streaming or tRPC fallback
  const handleSubmitQuery = useCallback(
    async (query: string) => {
      if (!currentChatId || processingRef.current || !user) return;

      processingRef.current = true;
      setIsProcessing(true);
      setModelStatuses(new Map());
      setConsensusInProgress(false);
      clearLogs();

      // Initialize pipeline stages for synthesis mode
      if (mode === "synthesis") {
        setPipelineStages([
          { stage: "web_search" as SynthesisStage, status: "pending" as const },
          {
            stage: "parallel_proposers" as SynthesisStage,
            status: "pending" as const,
          },
          {
            stage: "information_extraction" as SynthesisStage,
            status: "pending" as const,
          },
          {
            stage: "gap_detection" as SynthesisStage,
            status: "pending" as const,
          },
          {
            stage: "meta_synthesis" as SynthesisStage,
            status: "pending" as const,
          },
        ]);
      } else {
        setPipelineStages([]);
      }

      // Use WebSocket streaming if connected, otherwise fall back to tRPC
      if (useStreaming && isConnected) {
        startQuery({
          chatId: currentChatId,
          query,
          mode,
          speedTier,
          userId: user.id,
        });
      } else {
        // Fallback to tRPC mutation
        try {
          const result = await submitQueryMutation.mutateAsync({
            chatId: currentChatId,
            query,
            mode,
            speedTier,
          });

          // Update model statuses from result
          if (result.mode === "consensus" && result.modelResponses) {
            const newStatuses = new Map<string, ModelStatus>();
            for (const response of result.modelResponses) {
              newStatuses.set(response.modelId, {
                modelId: response.modelId,
                modelName: response.modelName,
                status: response.status as
                  | "pending"
                  | "streaming"
                  | "completed"
                  | "error",
                content: response.content,
                latencyMs: response.latencyMs,
                tokenCount:
                  (response.inputTokens || 0) + (response.outputTokens || 0),
                cost: response.cost,
                errorMessage: response.errorMessage,
              });
            }
            setModelStatuses(newStatuses);
          }

          // Update pipeline stages from result
          if (result.mode === "synthesis" && result.stages) {
            setPipelineStages(
              result.stages.map(s => ({
                stage: s.stageName as SynthesisStage,
                status: "completed" as const,
                output: s.output,
              }))
            );
          }

          // For synthesis mode, also populate model statuses from proposer responses
          if (result.mode === "synthesis" && result.proposerResponses) {
            const newStatuses = new Map<string, ModelStatus>();
            for (const response of result.proposerResponses) {
              newStatuses.set(response.modelId, {
                modelId: response.modelId,
                modelName: response.modelName,
                status: response.status as
                  | "pending"
                  | "streaming"
                  | "completed"
                  | "error",
                content: response.content,
                latencyMs: response.latencyMs,
                tokenCount:
                  (response.inputTokens || 0) + (response.outputTokens || 0),
                cost: response.cost,
                errorMessage: response.errorMessage,
              });
            }
            setModelStatuses(newStatuses);
          }

          await refetchChat();

          // Auto-generate title if this is the first message and title is still "New Chat"
          const updatedChat = await refetchChat();
          if (
            updatedChat.data?.messageCount === 2 &&
            updatedChat.data?.title === "New Chat"
          ) {
            generateTitleMutation.mutate(
              { chatId: currentChatId, firstMessage: query },
              {
                onSuccess: () => {
                  utils.chats.list.invalidate();
                  refetchChat();
                },
              }
            );
          }

          utils.chats.list.invalidate();
        } catch (error) {
          console.error("Failed to submit query:", error);
        } finally {
          processingRef.current = false;
          setIsProcessing(false);
        }
      }
    },
    [
      currentChatId,
      mode,
      speedTier,
      user,
      useStreaming,
      isConnected,
      startQuery,
      submitQueryMutation,
      refetchChat,
      utils,
      clearLogs,
      generateTitleMutation,
    ]
  );

  // Handle mode change
  const handleModeChange = useCallback(
    async (newMode: QueryMode) => {
      setMode(newMode);
      // Reset thinking panel for new mode
      setModelStatuses(new Map());
      setPipelineStages([]);

      // Persist mode change to database
      if (currentChatId) {
        try {
          await updateChatMutation.mutateAsync({
            chatId: currentChatId,
            mode: newMode,
          });
        } catch (error) {
          console.error("Failed to update chat mode:", error);
        }
      }
    },
    [currentChatId, updateChatMutation]
  );

  // Handle speed tier change
  const handleSpeedTierChange = useCallback(
    async (newTier: SpeedTier) => {
      setSpeedTier(newTier);

      // Persist speed tier change to database
      if (currentChatId) {
        try {
          await updateChatMutation.mutateAsync({
            chatId: currentChatId,
            speedTier: newTier,
          });
        } catch (error) {
          console.error("Failed to update chat speed tier:", error);
        }
      }
    },
    [currentChatId, updateChatMutation]
  );

  // Handle selected models change
  const handleSelectedModelsChange = useCallback(
    async (newModels: string[]) => {
      setSelectedModels(newModels);

      // Persist selected models to database
      if (currentChatId) {
        try {
          await updateChatMutation.mutateAsync({
            chatId: currentChatId,
            selectedModels: newModels,
          });
        } catch (error) {
          console.error("Failed to update selected models:", error);
        }
      }
    },
    [currentChatId, updateChatMutation]
  );

  // Splash screen disabled - go directly to chat

  // Auth loading
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated - redirect to Google login page
  if (!isAuthenticated) {
    window.location.href = "/login";
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-background overflow-hidden">
      {/* Sidebar */}
      <div
        className={`
          ${sidebarOpen ? "w-72" : "w-0"} 
          transition-all duration-300 ease-in-out
          border-r border-border bg-sidebar
          flex-shrink-0 h-full
          ${sidebarOpen ? "overflow-y-auto" : "overflow-hidden"}
        `}
      >
        {sidebarOpen && (
          <ChatSidebar
            currentChatId={currentChatId}
            onSelectChat={handleSelectChat}
            onNewChat={handleNewChat}
          />
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-14 border-b border-border flex items-center justify-between px-4 bg-card flex-shrink-0">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-muted-foreground hover:text-foreground"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="h-5 w-5" />
              ) : (
                <PanelLeft className="h-5 w-5" />
              )}
            </Button>
            <h1 className="text-lg font-semibold text-primary">RASPUTIN</h1>
          </div>

          <div className="flex items-center gap-2">
            {/* Agent Mode Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate("/agent")}
              className="text-purple-400 border-purple-400/50 hover:bg-purple-400/10 gap-1"
            >
              <Bot className="h-4 w-4" />
              Agent
            </Button>
            {/* System Pages Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-cyan-400 border-cyan-400/50 hover:bg-cyan-400/10 gap-1"
                >
                  <Activity className="h-4 w-4" />
                  System
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>System Pages</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => navigate("/infrastructure")}>
                  <Server className="h-4 w-4 mr-2" />
                  Infrastructure
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/multi-agent")}>
                  <Users className="h-4 w-4 mr-2" />
                  Multi-Agent
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/codebase")}>
                  <GitBranch className="h-4 w-4 mr-2" />
                  Codebase
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/events")}>
                  <Webhook className="h-4 w-4 mr-2" />
                  Events
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/hosts")}>
                  <Server className="h-4 w-4 mr-2" />
                  SSH Hosts
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Dialog>
              <DialogTrigger asChild>
                <div className="cursor-pointer">
                  <ApprovalBadge />
                </div>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Pending Approvals</DialogTitle>
                  <DialogDescription>
                    Review and approve commands that RASPUTIN wants to execute
                  </DialogDescription>
                </DialogHeader>
                <ApprovalWorkflow />
              </DialogContent>
            </Dialog>
            {!isInstalled && (
              <Button
                variant="outline"
                size="sm"
                onClick={install}
                className="text-primary border-primary hover:bg-primary/10 gap-1"
              >
                <Download className="h-4 w-4" />
                Install
              </Button>
            )}

            {/* WebSocket connection indicator */}
            <div
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                isConnected
                  ? "text-green-400 bg-green-400/10"
                  : "text-red-400 bg-red-400/10"
              }`}
            >
              {isConnected ? (
                <Wifi className="h-3 w-3" />
              ) : (
                <WifiOff className="h-3 w-3" />
              )}
              <span>{isConnected ? "Live" : "Offline"}</span>
            </div>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setThinkingPanelOpen(!thinkingPanelOpen)}
              className="text-muted-foreground hover:text-foreground"
            >
              {thinkingPanelOpen ? (
                <PanelRightClose className="h-5 w-5" />
              ) : (
                <PanelRight className="h-5 w-5" />
              )}
            </Button>

            {/* User Profile Menu */}
            <UserProfileMenu />
          </div>
        </header>

        {/* Chat Area */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          <ChatMain
            chatId={currentChatId}
            messages={chatData?.messages || []}
            isLoading={chatLoading}
            isProcessing={isProcessing}
            mode={mode}
            speedTier={speedTier}
            selectedModels={selectedModels}
            onModeChange={handleModeChange}
            onSpeedTierChange={handleSpeedTierChange}
            onSelectedModelsChange={handleSelectedModelsChange}
            onSubmitQuery={handleSubmitQuery}
            onNewChat={handleNewChat}
          />

          {/* Thinking Panel */}
          <div
            className={`
              ${thinkingPanelOpen ? "w-96" : "w-0"} 
              transition-all duration-300 ease-in-out
              border-l border-border bg-card
              flex-shrink-0 h-full min-h-0
              ${thinkingPanelOpen ? "overflow-y-auto" : "overflow-hidden"}
            `}
          >
            {thinkingPanelOpen && (
              <StreamingThinkingPanel
                mode={mode}
                modelStatuses={modelStatuses}
                pipelineStages={pipelineStages}
                consensusInProgress={consensusInProgress}
                isProcessing={isProcessing}
                streamingLogs={logs}
              />
            )}
          </div>
        </div>
      </div>

      {/* PWA Manual Install Instructions Dialog */}
      <Dialog
        open={showManualInstructions}
        onOpenChange={dismissManualInstructions}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              Install RASPUTIN
            </DialogTitle>
            <DialogDescription>
              Add RASPUTIN to your home screen for quick access and offline
              support.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              To install on <strong>{getManualInstructions().browser}</strong>:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              {getManualInstructions().steps.map((step, index) => (
                <li key={index} className="text-foreground">
                  {step}
                </li>
              ))}
            </ol>
            <Button onClick={dismissManualInstructions} className="w-full">
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
