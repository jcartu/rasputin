import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { useTheme } from "@/contexts/JarvisThemeContext";
import { playSound } from "@/lib/sound";

interface ReasoningStep {
  id: string;
  text: string;
  status: "pending" | "active" | "complete";
  timestamp: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  reasoning?: ReasoningStep[];
  isThinking?: boolean;
  timestamp: number;
}

interface DeepChatProps {
  scenario: string;
  onComplete?: () => void;
}

export const DeepChat: React.FC<DeepChatProps> = ({ scenario, onComplete }) => {
  const { theme } = useTheme();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [_isTyping, _setIsTyping] = useState(false);
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

      // Turn 1: Deep Reasoning
      const msgId = addMessage("assistant", "", true);
      setExpandedReasoning(msgId);

      await simulateReasoning(msgId, getReasoningSteps(scenario, 1));

      // Final Answer Turn 1
      updateMessageContent(msgId, getAnswer(scenario, 1));
      setExpandedReasoning(null);

      await wait(2000);

      // Turn 2: Follow-up
      const followUp = getFollowUpQuery(scenario);
      addMessage("user", followUp);

      await wait(1000);

      // Turn 2: Refined Reasoning
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
          };
          // Mark previous steps as complete
          const updatedReasoning = (m.reasoning || []).map(s => ({
            ...s,
            status: "complete" as const,
          }));
          return { ...m, reasoning: [...updatedReasoning, newStep] };
        })
      );
      playSound("type", theme);
      await wait(800 + Math.random() * 1000);
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
            className={`max-w-[80%] ${msg.role === "user" ? "bg-primary/10 border border-primary/30" : "bg-card border border-border"} rounded-lg p-4 shadow-lg backdrop-blur-sm`}
          >
            {/* User Message */}
            {msg.role === "user" && (
              <div className="text-foreground">{msg.content}</div>
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
                        <Brain className="w-3 h-3" />
                      )}
                      <span className="uppercase tracking-wider font-bold">
                        {msg.isThinking
                          ? "Thinking Process Active"
                          : "Reasoning Chain"}
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
                                className={
                                  step.status === "active"
                                    ? "text-primary"
                                    : "text-muted-foreground"
                                }
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
                    className="text-foreground leading-relaxed whitespace-pre-wrap"
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

const getInitialQuery = (scenario: string) => {
  switch (scenario) {
    case "medical":
      return "Patient presents with recurring fever, joint pain, and rash after travel to Brazil. Initial tests for Dengue are negative. Analyze potential rare tropical pathogens.";
    case "legal":
      return "Analyze the precedent set by the 'New York Times v. OpenAI' case regarding fair use in AI training data. How does this impact current copyright law in the EU?";
    case "market":
      return "What is the consensus on the impact of TSMC's Arizona plant delays on the global GPU supply chain for Q3 2025?";
    case "code":
      return "Audit this smart contract for reentrancy vulnerabilities. It uses a checks-effects-interactions pattern but interacts with untrusted external tokens.";
    default:
      return "Initiate deep research protocol.";
  }
};

const getFollowUpQuery = (scenario: string) => {
  switch (scenario) {
    case "medical":
      return "Could it be Chikungunya or Zika? Cross-reference symptoms with recent outbreaks in the region.";
    case "legal":
      return "Does the EU AI Act provide any specific exemptions for research organizations in this context?";
    case "market":
      return "Factor in the potential new export restrictions from the US Department of Commerce.";
    case "code":
      return "What if the external token implements a malicious transfer hook? Generate a test case.";
    default:
      return "Elaborate on that point.";
  }
};

const getReasoningSteps = (scenario: string, turn: number) => {
  if (scenario === "medical") {
    return turn === 1
      ? [
          "Accessing global epidemiological database...",
          "Filtering for vector-borne diseases in Brazil...",
          "Excluding Dengue (negative test)...",
          "Analyzing symptom cluster: Fever + Arthralgia + Rash...",
          "Hypothesis generation: Chikungunya, Zika, Mayaro virus...",
          "Checking cross-reactivity of serological tests...",
        ]
      : [
          "Querying recent outbreak reports (PAHO/WHO)...",
          "Comparing clinical presentation of Chikungunya vs. Zika...",
          "Noting severity of joint pain (points to Chikungunya)...",
          "Checking for conjunctivitis (points to Zika)...",
          "Synthesizing differential diagnosis...",
        ];
  }
  if (scenario === "legal") {
    return turn === 1
      ? [
          "Retrieving full text of NYT v. OpenAI complaint...",
          "Analyzing 'Fair Use' defense arguments (17 U.S.C. § 107)...",
          "Cross-referencing with Google v. Oracle API precedent...",
          "Checking EU AI Act Article 53 (General Purpose AI)...",
          "Synthesizing trans-Atlantic copyright implications...",
        ]
      : [
          "Scanning EU AI Act text for 'Text and Data Mining' (TDM) exceptions...",
          "Analyzing Article 4 of the DSM Directive...",
          "Checking 'opt-out' requirements for rights holders...",
          "Formulating compliance strategy for research labs...",
        ];
  }
  if (scenario === "market") {
    return turn === 1
      ? [
          "Accessing real-time supply chain data (TSMC, NVIDIA)...",
          "Analyzing satellite imagery of Arizona Fab 21 construction...",
          "Parsing earnings call transcripts for 'CoWoS capacity'...",
          "Simulating impact of 6-month delay on H100 availability...",
          "Calculating potential price impact on spot market...",
        ]
      : [
          "Retrieving latest BIS export control updates...",
          "Analyzing 'Entity List' additions for Q1 2025...",
          "Modeling impact on grey market GPU flow to restricted regions...",
          "Synthesizing geopolitical risk factor...",
        ];
  }
  if (scenario === "code") {
    return turn === 1
      ? [
          "Parsing Solidity AST...",
          "Checking for 'Checks-Effects-Interactions' pattern violation...",
          "Analyzing external calls to untrusted contracts...",
          "Simulating reentrancy attack vector...",
          "Verifying state variable updates...",
        ]
      : [
          "Generating malicious ERC20 token mock...",
          "Injecting reentrant call in 'transferFrom' hook...",
          "Running symbolic execution trace...",
          "Confirming vulnerability: State update happens AFTER external call...",
          "Drafting mitigation patch...",
        ];
  }
  return [
    "Decomposing query into semantic tokens...",
    "Retrieving relevant knowledge graph nodes...",
    "Cross-referencing with recent academic papers...",
    "Detecting potential bias in source material...",
    "Synthesizing final response...",
  ];
};

const getAnswer = (scenario: string, turn: number) => {
  if (scenario === "medical") {
    return turn === 1
      ? "**Differential Diagnosis:**\n\nBased on the negative Dengue test and travel history, the primary suspects are **Chikungunya** and **Zika Virus**. \n\n*   **Chikungunya**: High probability due to severe joint pain (arthralgia).\n*   **Zika**: Possible, but usually presents with milder symptoms and conjunctivitis.\n*   **Mayaro Virus**: A rare but plausible alternative found in rural Brazil.\n\nRecommended immediate action: PCR test for Chikungunya RNA."
      : "**Refined Analysis:**\n\nCross-referencing with current PAHO alerts indicates a surge in **Chikungunya** cases in the visited region. \n\n**Key Differentiator:** The severity of the joint pain described is a hallmark of Chikungunya ('that which bends up'). Zika typically presents with red eyes (conjunctivitis), which is absent here.\n\n**Conclusion:** 85% confidence in Chikungunya infection. Proceed with IgM antibody screening.";
  }
  if (scenario === "legal") {
    return turn === 1
      ? "**Precedent Analysis:**\n\nThe *NYT v. OpenAI* case hinges on whether training on copyrighted news constitutes 'transformative use'.\n\n**Key Findings:**\n*   **US Context:** Courts are split, but the *Google v. Oracle* API ruling suggests functional transformation is key. However, generating near-verbatim excerpts (as alleged by NYT) weakens the Fair Use defense.\n*   **EU Context:** The EU AI Act imposes stricter transparency. Unlike the US 'opt-out' ambiguity, the EU requires detailed summaries of training data, potentially exposing OpenAI to liability if TDM exceptions weren't strictly followed."
      : "**EU Research Exemption:**\n\nYes. Under the **DSM Directive (Article 3)**, text and data mining (TDM) for scientific research is broadly permitted and cannot be overridden by contract.\n\n**Strategy:**\nIf your organization qualifies as a 'Research Organization' (university, non-profit lab), you are exempt from the commercial 'opt-out' requirement. Ensure your entity status is legally verified to claim this shield.";
  }
  if (scenario === "market") {
    return turn === 1
      ? "**Supply Chain Impact Assessment:**\n\n**Consensus:** The 6-month delay at TSMC's Arizona Fab 21 is **moderately negative** but priced in.\n\n*   **H100 Availability:** Negligible impact. H100/H200 production is centered in Taiwan (Fab 18), not Arizona.\n*   **Risk:** The main risk is political optics, not immediate capacity. However, packaging capacity (CoWoS) remains the true bottleneck, which is currently expanding in Taiwan, not the US.\n\n**Forecast:** GPU spot prices will remain stable, driven by CoWoS expansion, not Arizona fab shell construction."
      : "**Geopolitical Risk Factor:**\n\n**Alert:** New BIS export controls rumored for Q1 2025 could lower the compute threshold for restricted chips.\n\n**Impact:**\n*   **Grey Market:** Expect a short-term spike in H20 (China-compliant) chip prices as hoarding begins.\n*   **Compliance:** Nvidia may need to further downgrade the H20 to H20-v2 to meet new performance density limits.\n\n**Recommendation:** Secure allocation for non-restricted regions immediately before the new rule publication.";
  }
  if (scenario === "code") {
    return turn === 1
      ? "**Audit Result: CRITICAL VULNERABILITY DETECTED**\n\n**Issue:** Reentrancy Risk\n**Location:** `withdraw()` function, line 42.\n\n**Analysis:**\nThe contract performs an external call `token.transferFrom` **before** updating the user's balance `balances[msg.sender] = 0`.\n\n**Exploit:**\nA malicious token contract could call back into `withdraw()` inside the `transferFrom` hook, draining the contract before the balance is set to zero."
      : "**Exploit Confirmation & Fix:**\n\n**Test Case Generated:** `Exploit.sol` successfully drained 100 ETH in simulation.\n\n**Patch:**\nMove the state update to **before** the external call (Checks-Effects-Interactions pattern).\n\n```solidity\n// FIXED CODE\nbalances[msg.sender] = 0; // Effect\nrequire(token.transfer(msg.sender, amount)); // Interaction\n```\n\n**Status:** Vulnerability patched. Re-running verification...";
  }
  return "Analysis complete. Based on the available data, the consensus indicates a high probability of the hypothesized outcome. Further verification is recommended.";
};
