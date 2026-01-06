/**
 * Multi-Agent Orchestration System
 *
 * Provides:
 * - Agent spawning and lifecycle management
 * - Inter-agent communication
 * - Task delegation and subtask management
 * - Multi-agent orchestration for complex tasks
 */

export * from "./types";
export { agentManager, AgentManager } from "./agentManager";
export {
  multiAgentOrchestrator,
  MultiAgentOrchestrator,
} from "./multiAgentOrchestrator";
