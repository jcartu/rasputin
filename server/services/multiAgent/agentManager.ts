/**
 * Multi-Agent Manager
 * Manages agent lifecycle, spawning, and communication
 */

import { getDb } from "../../db";
import {
  agents,
  interAgentMessages,
  agentSubtasks,
} from "../../../drizzle/schema";
import { eq, and, desc, isNull, sql } from "drizzle-orm";
import {
  Agent,
  AgentType,
  AgentStatus,
  AgentConfig,
  AgentCapabilities,
  AgentMessage,
  MessageType,
  TaskPriority,
  Subtask,
  SubtaskStatus,
  TaskDelegation,
  AgentResult,
  AGENT_CONFIGS,
} from "./types";
import { invokeLLM } from "../../_core/llm";

export class AgentManager {
  private activeAgents: Map<number, Agent> = new Map();

  /**
   * Spawn a new agent
   */
  async spawnAgent(
    userId: number,
    config: Partial<AgentConfig> & { type: AgentType },
    parentAgentId?: number,
    taskId?: number
  ): Promise<Agent> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get default config for this agent type
    const defaultConfig = AGENT_CONFIGS[config.type];
    const finalConfig = { ...defaultConfig, ...config };

    // Use raw SQL to avoid Drizzle ORM issues with optional columns
    const agentName = config.name || `${config.type}-agent-${Date.now()}`;
    const systemPromptValue = finalConfig.systemPrompt || null;
    const capabilitiesValue = finalConfig.capabilities
      ? JSON.stringify(finalConfig.capabilities)
      : null;

    // Build the raw SQL insert - only include columns that have values
    const result = await db.execute(sql`
      INSERT INTO agents (userId, name, agentType, status, systemPrompt, capabilities, messagesProcessed, toolCallsMade, tokensUsed)
      VALUES (${userId}, ${agentName}, ${config.type}, 'idle', ${systemPromptValue}, ${capabilitiesValue}, 0, 0, 0)
    `);

    // Get the inserted ID from the result
    const insertedId = (result[0] as any).insertId;
    const inserted = { id: insertedId };

    const agent: Agent = {
      id: inserted.id,
      parentAgentId,
      taskId,
      userId,
      name: config.name || `${config.type}-agent-${Date.now()}`,
      agentType: config.type,
      status: "idle",
      systemPrompt: finalConfig.systemPrompt,
      capabilities: finalConfig.capabilities,
      messagesProcessed: 0,
      toolCallsMade: 0,
      tokensUsed: 0,
      createdAt: new Date(),
    };

    this.activeAgents.set(agent.id, agent);
    return agent;
  }

  /**
   * Get an agent by ID
   */
  async getAgent(agentId: number): Promise<Agent | null> {
    // Check cache first
    if (this.activeAgents.has(agentId)) {
      return this.activeAgents.get(agentId)!;
    }

    const db = await getDb();
    if (!db) return null;

    const [row] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!row) return null;

    const agent: Agent = {
      id: row.id,
      parentAgentId: row.parentAgentId || undefined,
      taskId: row.taskId || undefined,
      userId: row.userId,
      name: row.name,
      agentType: row.agentType as AgentType,
      status: row.status as AgentStatus,
      systemPrompt: row.systemPrompt || undefined,
      capabilities: row.capabilities as unknown as
        | AgentCapabilities
        | undefined,
      currentGoal: row.currentGoal || undefined,
      context: row.context as Record<string, unknown> | undefined,
      messagesProcessed: row.messagesProcessed || 0,
      toolCallsMade: row.toolCallsMade || 0,
      tokensUsed: row.tokensUsed || 0,
      startedAt: row.startedAt || undefined,
      completedAt: row.completedAt || undefined,
      createdAt: row.createdAt,
    };

    this.activeAgents.set(agent.id, agent);
    return agent;
  }

  /**
   * Update agent status
   */
  async updateAgentStatus(
    agentId: number,
    status: AgentStatus,
    goal?: string
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db
      .update(agents)
      .set({
        status,
        currentGoal: goal,
        ...(status === "executing" && { startedAt: new Date() }),
        ...(status === "completed" || status === "failed"
          ? { completedAt: new Date() }
          : {}),
      })
      .where(eq(agents.id, agentId));

    // Update cache
    const cached = this.activeAgents.get(agentId);
    if (cached) {
      cached.status = status;
      if (goal) cached.currentGoal = goal;
    }
  }

  /**
   * Send a message between agents
   */
  async sendMessage(
    fromAgentId: number,
    toAgentId: number,
    messageType: MessageType,
    content: string,
    options: {
      metadata?: Record<string, unknown>;
      taskDescription?: string;
      priority?: TaskPriority;
    } = {}
  ): Promise<AgentMessage> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    const [inserted] = await db
      .insert(interAgentMessages)
      .values({
        fromAgentId,
        toAgentId,
        messageType,
        content,
        metadata: options.metadata,
        taskDescription: options.taskDescription,
        taskPriority: options.priority || "normal",
        isRead: 0,
      })
      .$returningId();

    return {
      id: inserted.id,
      fromAgentId,
      toAgentId,
      messageType,
      content,
      metadata: options.metadata,
      taskDescription: options.taskDescription,
      taskPriority: options.priority || "normal",
      isRead: false,
      createdAt: new Date(),
    };
  }

  /**
   * Get unread messages for an agent
   */
  async getUnreadMessages(agentId: number): Promise<AgentMessage[]> {
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select()
      .from(interAgentMessages)
      .where(
        and(
          eq(interAgentMessages.toAgentId, agentId),
          eq(interAgentMessages.isRead, 0)
        )
      )
      .orderBy(desc(interAgentMessages.createdAt));

    return rows.map(row => ({
      id: row.id,
      fromAgentId: row.fromAgentId,
      toAgentId: row.toAgentId,
      messageType: row.messageType as MessageType,
      content: row.content,
      metadata: row.metadata as Record<string, unknown> | undefined,
      taskDescription: row.taskDescription || undefined,
      taskPriority: (row.taskPriority || "normal") as TaskPriority,
      isRead: row.isRead === 1,
      readAt: row.readAt || undefined,
      createdAt: row.createdAt,
    }));
  }

  /**
   * Mark messages as read
   */
  async markMessagesRead(messageIds: number[]): Promise<void> {
    const db = await getDb();
    if (!db || messageIds.length === 0) return;

    const now = new Date();
    await Promise.all(
      messageIds.map(id =>
        db
          .update(interAgentMessages)
          .set({
            isRead: 1,
            readAt: now,
          })
          .where(eq(interAgentMessages.id, id))
      )
    );
  }

  /**
   * Create a subtask and assign to an agent
   */
  async createSubtask(
    parentTaskId: number,
    createdByAgentId: number,
    delegation: TaskDelegation
  ): Promise<Subtask> {
    const db = await getDb();
    if (!db) throw new Error("Database not available");

    // Get the creating agent to find the user
    const creatingAgent = await this.getAgent(createdByAgentId);
    if (!creatingAgent) throw new Error("Creating agent not found");

    // Spawn a specialized agent for this subtask
    const specializedAgent = await this.spawnAgent(
      creatingAgent.userId,
      { type: delegation.targetAgentType },
      createdByAgentId,
      parentTaskId
    );

    const [inserted] = await db
      .insert(agentSubtasks)
      .values({
        parentTaskId,
        assignedAgentId: specializedAgent.id,
        createdByAgentId,
        title: delegation.subtaskTitle,
        description: delegation.description,
        status: "assigned",
        priority: delegation.priority,
        input: delegation.input,
        dependsOn: delegation.dependsOn,
      })
      .$returningId();

    // Send task message to the specialized agent
    await this.sendMessage(
      createdByAgentId,
      specializedAgent.id,
      "task",
      delegation.description,
      {
        taskDescription: delegation.subtaskTitle,
        priority: delegation.priority,
        metadata: { input: delegation.input },
      }
    );

    return {
      id: inserted.id,
      parentTaskId,
      assignedAgentId: specializedAgent.id,
      createdByAgentId,
      title: delegation.subtaskTitle,
      description: delegation.description,
      status: "assigned",
      priority: delegation.priority,
      input: delegation.input,
      dependsOn: delegation.dependsOn,
      createdAt: new Date(),
    };
  }

  /**
   * Update subtask status and output
   */
  async updateSubtask(
    subtaskId: number,
    status: SubtaskStatus,
    output?: Record<string, unknown>
  ): Promise<void> {
    const db = await getDb();
    if (!db) return;

    await db
      .update(agentSubtasks)
      .set({
        status,
        output,
        ...(status === "in_progress" && { startedAt: new Date() }),
        ...(status === "completed" || status === "failed"
          ? { completedAt: new Date() }
          : {}),
      })
      .where(eq(agentSubtasks.id, subtaskId));
  }

  /**
   * Get subtasks for a parent task
   */
  async getSubtasks(parentTaskId: number): Promise<Subtask[]> {
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select()
      .from(agentSubtasks)
      .where(eq(agentSubtasks.parentTaskId, parentTaskId));

    return rows.map(row => ({
      id: row.id,
      parentTaskId: row.parentTaskId,
      assignedAgentId: row.assignedAgentId,
      createdByAgentId: row.createdByAgentId,
      title: row.title,
      description: row.description || undefined,
      status: row.status as SubtaskStatus,
      priority: (row.priority || "normal") as TaskPriority,
      input: row.input as Record<string, unknown> | undefined,
      output: row.output as Record<string, unknown> | undefined,
      dependsOn: row.dependsOn as number[] | undefined,
      startedAt: row.startedAt || undefined,
      completedAt: row.completedAt || undefined,
      createdAt: row.createdAt,
    }));
  }

  /**
   * Execute an agent's task
   */
  async executeAgent(agentId: number, task: string): Promise<AgentResult> {
    const startTime = Date.now();
    const agent = await this.getAgent(agentId);

    if (!agent) {
      return {
        success: false,
        error: "Agent not found",
        tokensUsed: 0,
        executionTimeMs: Date.now() - startTime,
      };
    }

    await this.updateAgentStatus(agentId, "thinking", task);

    try {
      // Build the prompt with agent's system prompt
      const messages = [
        {
          role: "system" as const,
          content: agent.systemPrompt || "You are a helpful assistant.",
        },
        { role: "user" as const, content: task },
      ];

      // Call LLM
      const response = await invokeLLM({ messages });
      const content = response.choices[0]?.message?.content || "";
      const tokensUsed = response.usage?.total_tokens || 0;

      // Update agent stats
      const db = await getDb();
      if (db) {
        await db
          .update(agents)
          .set({
            messagesProcessed: (agent.messagesProcessed || 0) + 1,
            tokensUsed: (agent.tokensUsed || 0) + tokensUsed,
          })
          .where(eq(agents.id, agentId));
      }

      await this.updateAgentStatus(agentId, "completed");

      return {
        success: true,
        output: content,
        tokensUsed,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      await this.updateAgentStatus(agentId, "failed");

      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        tokensUsed: 0,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Terminate an agent
   */
  async terminateAgent(agentId: number): Promise<void> {
    await this.updateAgentStatus(agentId, "terminated");
    this.activeAgents.delete(agentId);
  }

  /**
   * List all agents for a user
   */
  async listAgents(userId: number): Promise<Agent[]> {
    return this.getUserAgents(userId);
  }

  /**
   * Create a new agent
   */
  async createAgent(
    userId: number,
    name: string,
    type: AgentType,
    options: {
      systemPrompt?: string;
      capabilities?: Partial<AgentCapabilities>;
    } = {}
  ): Promise<Agent> {
    return this.spawnAgent(userId, {
      type,
      name,
      systemPrompt: options.systemPrompt,
      capabilities: options.capabilities as AgentCapabilities,
    });
  }

  /**
   * Get messages for an agent
   */
  async getAgentMessages(
    agentId: number,
    userId: number
  ): Promise<AgentMessage[]> {
    const db = await getDb();
    if (!db) return [];

    // Verify ownership
    const agent = await this.getAgent(agentId);
    if (!agent || agent.userId !== userId) {
      return [];
    }

    const rows = await db
      .select()
      .from(interAgentMessages)
      .where(eq(interAgentMessages.toAgentId, agentId))
      .orderBy(desc(interAgentMessages.createdAt));

    return rows.map(row => ({
      id: row.id,
      fromAgentId: row.fromAgentId,
      toAgentId: row.toAgentId,
      messageType: row.messageType as MessageType,
      content: row.content,
      metadata: row.metadata as Record<string, unknown> | undefined,
      taskDescription: row.taskDescription || undefined,
      taskPriority: (row.taskPriority || "normal") as TaskPriority,
      isRead: row.isRead === 1,
      readAt: row.readAt || undefined,
      createdAt: row.createdAt,
    }));
  }

  /**
   * Get all active agents for a user
   */
  async getUserAgents(userId: number): Promise<Agent[]> {
    const db = await getDb();
    if (!db) return [];

    const rows = await db
      .select()
      .from(agents)
      .where(eq(agents.userId, userId))
      .orderBy(desc(agents.createdAt));

    return rows.map(row => ({
      id: row.id,
      parentAgentId: row.parentAgentId || undefined,
      taskId: row.taskId || undefined,
      userId: row.userId,
      name: row.name,
      agentType: row.agentType as AgentType,
      status: row.status as AgentStatus,
      systemPrompt: row.systemPrompt || undefined,
      capabilities: row.capabilities as unknown as
        | AgentCapabilities
        | undefined,
      currentGoal: row.currentGoal || undefined,
      context: row.context as Record<string, unknown> | undefined,
      messagesProcessed: row.messagesProcessed || 0,
      toolCallsMade: row.toolCallsMade || 0,
      tokensUsed: row.tokensUsed || 0,
      startedAt: row.startedAt || undefined,
      completedAt: row.completedAt || undefined,
      createdAt: row.createdAt,
    }));
  }

  /**
   * Get agent hierarchy (parent and children)
   */
  async getAgentHierarchy(agentId: number): Promise<{
    parent?: Agent;
    children: Agent[];
  }> {
    const db = await getDb();
    if (!db) return { children: [] };

    const agent = await this.getAgent(agentId);
    if (!agent) return { children: [] };

    // Get parent
    let parent: Agent | undefined;
    if (agent.parentAgentId) {
      parent = (await this.getAgent(agent.parentAgentId)) || undefined;
    }

    // Get children
    const childRows = await db
      .select()
      .from(agents)
      .where(eq(agents.parentAgentId, agentId));

    const children: Agent[] = childRows.map(row => ({
      id: row.id,
      parentAgentId: row.parentAgentId || undefined,
      taskId: row.taskId || undefined,
      userId: row.userId,
      name: row.name,
      agentType: row.agentType as AgentType,
      status: row.status as AgentStatus,
      systemPrompt: row.systemPrompt || undefined,
      capabilities: row.capabilities as unknown as
        | AgentCapabilities
        | undefined,
      currentGoal: row.currentGoal || undefined,
      context: row.context as Record<string, unknown> | undefined,
      messagesProcessed: row.messagesProcessed || 0,
      toolCallsMade: row.toolCallsMade || 0,
      tokensUsed: row.tokensUsed || 0,
      startedAt: row.startedAt || undefined,
      completedAt: row.completedAt || undefined,
      createdAt: row.createdAt,
    }));

    return { parent, children };
  }
}

// Singleton instance
export const agentManager = new AgentManager();
