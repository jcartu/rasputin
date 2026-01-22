import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
  Terminal,
  Activity,
} from "lucide-react";
import { useTheme } from "@/contexts/JarvisThemeContext";
import { playSound } from "@/lib/sound";

interface ReasoningStep {
  id: string;
  text: string;
  status: "pending" | "active" | "complete";
  timestamp: number;
  type?: "default" | "exec" | "net" | "db";
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: ReasoningStep[];
  isThinking?: boolean;
  timestamp: number;
}

interface IntelligenceStreamProps {
  scenario: string;
  onComplete?: () => void;
  onLog?: (log: { agent: string; msg: string; type: string }) => void;
}

export const IntelligenceStream: React.FC<IntelligenceStreamProps> = ({
  scenario,
  onComplete,
  onLog,
}) => {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [expandedReasoning, setExpandedReasoning] = useState<string | null>(
    null
  );
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, expandedReasoning]);

  // Simulation Logic
  useEffect(() => {
    let _isMounted = true;

    const runSimulation = async () => {
      // Initial User Query
      const initialQuery = getInitialQuery(scenario);
      addMessage("user", initialQuery);

      await wait(1000);

      // Turn 1: Execution Plan
      const msgId = addMessage("assistant", "", true);
      setExpandedReasoning(msgId);

      await simulateReasoning(msgId, getReasoningSteps(scenario, 1));

      // Final Answer Turn 1
      updateMessageContent(msgId, getAnswer(scenario, 1));
      setExpandedReasoning(null);

      await wait(2000);

      // Turn 2: Follow-up / Confirmation
      const followUp = getFollowUpQuery(scenario);
      addMessage("user", followUp);

      await wait(1000);

      // Turn 2: Final Execution
      const msgId2 = addMessage("assistant", "", true);
      setExpandedReasoning(msgId2);

      await simulateReasoning(msgId2, getReasoningSteps(scenario, 2));

      // Final Answer Turn 2
      updateMessageContent(msgId2, getAnswer(scenario, 2));
      setExpandedReasoning(null);

      if (onComplete) onComplete();
    };

    runSimulation();

    return () => {
      _isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario]);

  const addMessage = (
    role: "user" | "assistant",
    content: string,
    isThinking = false
  ) => {
    const id = Math.random().toString(36).substr(2, 9);
    setMessages(prev => [
      ...prev,
      {
        id,
        role,
        content,
        isThinking,
        reasoning: isThinking ? [] : undefined,
        timestamp: Date.now(),
      },
    ]);
    playSound(role === "user" ? "type" : "processing", theme);
    return id;
  };

  const updateMessageContent = (id: string, content: string) => {
    setMessages(prev =>
      prev.map(m => (m.id === id ? { ...m, content, isThinking: false } : m))
    );
    playSound("success", theme);
  };

  const simulateReasoning = async (msgId: string, steps: string[]) => {
    for (const stepText of steps) {
      setMessages(prev =>
        prev.map(m => {
          if (m.id !== msgId) return m;
          const newStep: ReasoningStep = {
            id: Math.random().toString(36).substr(2, 9),
            text: stepText,
            status: "active",
            timestamp: Date.now(),
            type: getStepType(stepText),
          };

          // Emit log to parent
          if (onLog) {
            onLog({
              agent: getAgentForStep(stepText),
              msg: stepText,
              type: getLogTypeForStep(stepText),
            });
          }

          // Mark previous steps as complete
          const updatedReasoning = (m.reasoning || []).map(s => ({
            ...s,
            status: "complete" as const,
          }));
          return { ...m, reasoning: [...updatedReasoning, newStep] };
        })
      );
      playSound("type", theme);
      await wait(600 + Math.random() * 800); // Faster than research mode
    }
    // Mark all complete
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== msgId) return m;
        return {
          ...m,
          reasoning: (m.reasoning || []).map(s => ({
            ...s,
            status: "complete" as const,
          })),
        };
      })
    );
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto p-6 space-y-6 font-mono text-sm">
      {messages.map(msg => (
        <motion.div
          key={msg.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[90%] w-full ${msg.role === "user" ? "bg-primary/10 border border-primary/30" : "bg-card/50 border border-border"} rounded-lg p-4 shadow-lg backdrop-blur-sm overflow-hidden`}
          >
            {/* User Message */}
            {msg.role === "user" && (
              <div className="text-foreground flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Terminal className="w-4 h-4 text-primary" />
                </div>
                {msg.content}
              </div>
            )}

            {/* Assistant Message */}
            {msg.role === "assistant" && (
              <div className="space-y-4">
                {/* Reasoning Block */}
                {msg.reasoning && msg.reasoning.length > 0 && (
                  <div className="border-l-2 border-primary/30 pl-4 my-2">
                    <button
                      onClick={() =>
                        setExpandedReasoning(
                          expandedReasoning === msg.id ? null : msg.id
                        )
                      }
                      className="flex items-center space-x-2 text-xs text-muted-foreground hover:text-primary transition-colors mb-2"
                    >
                      {msg.isThinking ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Activity className="w-3 h-3" />
                      )}
                      <span className="uppercase tracking-wider font-bold">
                        {msg.isThinking
                          ? "EXECUTION PROTOCOL ACTIVE"
                          : "OPERATION LOG"}
                      </span>
                      {expandedReasoning === msg.id ? (
                        <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronRight className="w-3 h-3" />
                      )}
                    </button>

                    <AnimatePresence>
                      {(expandedReasoning === msg.id || msg.isThinking) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="space-y-2 overflow-hidden"
                        >
                          {msg.reasoning.map(step => (
                            <div
                              key={step.id}
                              className="flex items-start space-x-2 text-xs"
                            >
                              <div className="mt-0.5">
                                {step.status === "complete" ? (
                                  <CheckCircle2 className="w-3 h-3 text-green-500" />
                                ) : (
                                  <div className="w-3 h-3 rounded-full bg-primary/50 animate-pulse" />
                                )}
                              </div>
                              <span
                                className={cn(
                                  "font-mono",
                                  step.status === "active"
                                    ? "text-primary"
                                    : "text-muted-foreground",
                                  step.type === "exec" && "text-yellow-400",
                                  step.type === "net" && "text-blue-400",
                                  step.type === "db" && "text-purple-400"
                                )}
                              >
                                {step.text}
                              </span>
                            </div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                {/* Final Content */}
                {msg.content && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-foreground leading-relaxed whitespace-pre-wrap break-words border-t border-border/50 pt-4 mt-2 overflow-x-auto"
                  >
                    {msg.content}
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};

// Helper Functions
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
const cn = (...classes: (string | undefined | null | false)[]) =>
  classes.filter(Boolean).join(" ");

const getStepType = (text: string) => {
  if (
    text.includes("Executing") ||
    text.includes("Running") ||
    text.includes("Compiling")
  )
    return "exec";
  if (
    text.includes("Scanning") ||
    text.includes("Connecting") ||
    text.includes("Fetching")
  )
    return "net";
  if (
    text.includes("Querying") ||
    text.includes("Retrieving") ||
    text.includes("Saving")
  )
    return "db";
  return "default";
};

const getAgentForStep = (text: string) => {
  if (text.includes("Scanning") || text.includes("Vision")) return "VISION";
  if (text.includes("Executing") || text.includes("Running")) return "EXEC";
  if (text.includes("Querying") || text.includes("Retrieving")) return "MEMORY";
  if (text.includes("Analyzing") || text.includes("Calculating"))
    return "PLANNER";
  return "SYSTEM";
};

const getLogTypeForStep = (text: string) => {
  if (text.includes("Error") || text.includes("Failed")) return "error";
  if (text.includes("Success") || text.includes("Complete")) return "success";
  if (text.includes("Warning") || text.includes("Alert")) return "warning";
  return "info";
};

const getInitialQuery = (scenario: string) => {
  switch (scenario) {
    case "security":
      return "Initiate global cyber-defense audit. Scan all subnets for anomalies and patch vulnerabilities.";
    case "saas":
      return "Deploy a full-stack SaaS for 'CryptoTracker'. Stack: React, Node, Postgres. Deploy to Vercel.";
    case "market":
      return "Execute high-frequency arbitrage across Binance and Coinbase. Target: BTC/USD spread > 0.5%.";
    case "bugfix":
      return "Analyze screen buffer. Identify the infinite loop in the active Python script and apply fix.";
    default:
      return "Awaiting command...";
  }
};

const getFollowUpQuery = (scenario: string) => {
  switch (scenario) {
    case "security":
      return "Isolate the compromised nodes in Subnet 4 and deploy honeypots.";
    case "saas":
      return "Run integration tests and verify SSL certificate propagation.";
    case "market":
      return "Increase leverage to 5x and rebalance portfolio for delta neutrality.";
    case "bugfix":
      return "Verify the fix with a dry run.";
    default:
      return "Proceed.";
  }
};

const getReasoningSteps = (scenario: string, turn: number) => {
  if (scenario === "security") {
    return turn === 1
      ? [
          "Initializing NMAP scan on 192.168.0.0/16...",
          "Analyzing packet headers for signature matches...",
          "Detected anomaly in Subnet 192.168.4.x (High Latency)...",
          "Cross-referencing CVE-2025-4032 database...",
          "Flagging 3 nodes as potentially compromised...",
        ]
      : [
          "Severing connection to 192.168.4.12...",
          "Rerouting traffic through secure VLAN...",
          "Deploying 'Ghost' honeypot containers...",
          "Patching firewall rules (Block port 4444)...",
          "Verifying network integrity...",
        ];
  }
  if (scenario === "saas") {
    return turn === 1
      ? [
          "Scaffolding Next.js 15 project structure...",
          "Configuring Prisma schema for PostgreSQL...",
          "Generating API routes for /prices and /users...",
          "Compiling frontend assets (Webpack)...",
          "Pushing to git remote origin...",
        ]
      : [
          "Triggering Vercel deployment hook...",
          "Running Jest test suite (420/420 passed)...",
          "Provisioning SSL certificate via Let's Encrypt...",
          "Warming up serverless functions...",
          "Health check: 200 OK...",
        ];
  }
  if (scenario === "market") {
    return turn === 1
      ? [
          "Connecting to Binance WebSocket feed...",
          "Connecting to Coinbase Pro API...",
          "Calculating latency delta (12ms)...",
          "Detecting spread: 0.85% on BTC/USD...",
          "Executing flash loan (100 BTC)...",
        ]
      : [
          "Adjusting leverage to 5x (Risk: High)...",
          "Heding position with ETH perp shorts...",
          "Monitoring liquidation price...",
          "Closing arbitrage loop...",
          "Settling profit: +4.20%...",
        ];
  }
  if (scenario === "bugfix") {
    return turn === 1
      ? [
          "Capturing screen buffer (2560x1440)...",
          "Running OCR text extraction...",
          "Parsing Python Abstract Syntax Tree (AST)...",
          "Tracing control flow graph...",
          "Identified infinite loop: line 42 (variable 'i' never increments)...",
        ]
      : [
          "Generating patch: 'i += 1'...",
          "Injecting code into active editor window...",
          "Running syntax check...",
          "Executing unit test: test_loop_termination()...",
          "Test passed. Fix applied.",
        ];
  }
  return ["Processing..."];
};

const getAnswer = (scenario: string, turn: number) => {
  if (scenario === "security") {
    return turn === 1
      ? "**Audit Report:**\n\nScan complete. Detected **3 critical anomalies** in Subnet 192.168.4.0/24.\n\n*   **Threat Level:** High\n*   **Signature:** Reverse Shell (Port 4444)\n*   **Affected Nodes:** Workstation-04, Server-DB-02\n\nAwaiting authorization to isolate."
      : "**Countermeasures Deployed:**\n\nCompromised nodes have been isolated to VLAN-99 (Quarantine). Honeypots are active and logging attacker traffic.\n\n**Status:** Network Secure. Firewall rules updated.";
  }
  if (scenario === "saas") {
    return turn === 1
      ? "**Build Complete:**\n\n'CryptoTracker' v1.0.0 has been built successfully.\n\n*   **Frontend:** Next.js 15 (App Router)\n*   **Backend:** Node.js / GraphQL\n*   **Database:** PostgreSQL (Supabase)\n\nReady for deployment."
      : "**Deployment Successful:**\n\nApp is live at `https://crypto-tracker.jarvis.ai`.\n\n*   **SSL:** Active\n*   **Latency:** 45ms (Global Edge)\n*   **Tests:** 100% Coverage\n\nAdmin credentials sent to secure vault.";
  }
  if (scenario === "market") {
    return turn === 1
      ? "**Arbitrage Opportunity Detected:**\n\nSpread found: **0.85%** between Binance ($98,200) and Coinbase ($99,035).\n\n*   **Volume:** 150 BTC\n*   **Est. Profit:** $125,250\n*   **Execution Time:** 450ms\n\nExecuting initial buy orders..."
      : "**Execution Complete:**\n\nTrade settled successfully.\n\n*   **Net Profit:** +$12,450 (after fees)\n*   **ROI:** 4.20%\n*   **Risk Status:** Neutral (Hedged)\n\nPortfolio rebalanced.";
  }
  if (scenario === "bugfix") {
    return turn === 1
      ? "**Bug Identified:**\n\nInfinite loop detected on **line 42**.\n\n```python\nwhile i < 100:\n    print(process(i))\n    # MISSING INCREMENT\n```\n\nThe variable `i` is never updated, causing the loop to run forever."
      : "**Fix Applied:**\n\nCode patched successfully.\n\n```python\nwhile i < 100:\n    print(process(i))\n    i += 1  # Fixed\n```\n\nDry run confirmed termination. System stable.";
  }
  return "Command executed.";
};
