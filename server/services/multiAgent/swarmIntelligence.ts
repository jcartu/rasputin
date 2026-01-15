import { getDb } from "../../db";
import { agentSubtasks } from "../../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { agentManager } from "./agentManager";
import { Agent, AgentType, TaskPriority } from "./types";
import { invokeLLM } from "../../_core/llm";
import {
  emitSwarmNegotiationStart,
  emitSwarmBid,
  emitSwarmNegotiationComplete,
  emitSwarmTeamForming,
  emitSwarmTeamMemberAdded,
  emitSwarmTeamFormed,
  emitSwarmTeamDisbanded,
  emitSwarmConsensusStart,
  emitSwarmVote,
  emitSwarmConsensusComplete,
  emitSwarmBroadcast,
} from "../websocket";

export interface NegotiationProposal {
  taskId: number;
  taskDescription: string;
  proposingAgentId: number;
  targetCapabilities: string[];
  priority: TaskPriority;
  estimatedComplexity: number;
  deadline?: Date;
}

export interface NegotiationBid {
  agentId: number;
  taskId: number;
  confidence: number;
  estimatedDuration: number;
  reasoningScore: number;
  availabilityScore: number;
  experienceScore: number;
}

export interface ConsensusVote {
  agentId: number;
  proposalId: string;
  vote: "approve" | "reject" | "abstain";
  weight: number;
  reasoning?: string;
}

export interface SwarmDecision {
  proposalId: string;
  decision: "approved" | "rejected" | "tie";
  approvalPercentage: number;
  totalVotes: number;
  winningMargin: number;
}

export interface TeamFormationRequest {
  taskDescription: string;
  requiredCapabilities: string[];
  minAgents: number;
  maxAgents: number;
  preferredAgentTypes?: AgentType[];
}

export interface FormedTeam {
  teamId: string;
  members: Agent[];
  leaderId: number;
  taskDescription: string;
  formationReason: string;
}

class SwarmIntelligenceService {
  private activeNegotiations: Map<number, NegotiationBid[]> = new Map();
  private pendingVotes: Map<string, ConsensusVote[]> = new Map();
  private activeTeams: Map<string, FormedTeam> = new Map();

  async initiateTaskNegotiation(
    userId: number,
    proposal: NegotiationProposal
  ): Promise<NegotiationBid[]> {
    emitSwarmNegotiationStart({
      taskId: proposal.taskId,
      taskDescription: proposal.taskDescription,
      requiredCapabilities: proposal.targetCapabilities,
    });

    const availableAgents = await this.findAvailableAgents(
      userId,
      proposal.targetCapabilities
    );

    if (availableAgents.length === 0) {
      return [];
    }

    const bids: NegotiationBid[] = [];

    for (const agent of availableAgents) {
      const bid = await this.generateAgentBid(agent, proposal);
      bids.push(bid);

      emitSwarmBid({
        taskId: proposal.taskId,
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.agentType,
        confidence: bid.confidence,
        availabilityScore: bid.availabilityScore,
        experienceScore: bid.experienceScore,
        estimatedDuration: bid.estimatedDuration,
      });
    }

    bids.sort((a, b) => this.calculateBidScore(b) - this.calculateBidScore(a));

    this.activeNegotiations.set(proposal.taskId, bids);

    return bids;
  }

  private async findAvailableAgents(
    userId: number,
    requiredCapabilities: string[]
  ): Promise<Agent[]> {
    const allAgents = await agentManager.getUserAgents(userId);

    return allAgents.filter(agent => {
      if (agent.status !== "idle" && agent.status !== "waiting") {
        return false;
      }

      if (requiredCapabilities.length === 0) return true;

      const agentCaps = agent.capabilities;
      if (!agentCaps) return false;

      return requiredCapabilities.some(cap => {
        switch (cap) {
          case "code":
            return agentCaps.canExecuteCode;
          case "web":
            return agentCaps.canBrowseWeb || agentCaps.canSearchWeb;
          case "ssh":
            return agentCaps.canSSH;
          case "files":
            return agentCaps.canAccessFiles;
          case "images":
            return agentCaps.canGenerateImages;
          case "infrastructure":
            return agentCaps.canManageInfrastructure;
          default:
            return agentCaps.customTools?.includes(cap) ?? false;
        }
      });
    });
  }

  private async generateAgentBid(
    agent: Agent,
    proposal: NegotiationProposal
  ): Promise<NegotiationBid> {
    const db = await getDb();

    let experienceScore = 0.5;
    if (db) {
      const recentTasks = await db
        .select({ count: sql<number>`count(*)`.as("count") })
        .from(agentSubtasks)
        .where(
          and(
            eq(agentSubtasks.assignedAgentId, agent.id),
            eq(agentSubtasks.status, "completed")
          )
        );
      experienceScore = Math.min(1, (recentTasks[0]?.count || 0) / 10);
    }

    const availabilityScore = agent.status === "idle" ? 1.0 : 0.5;

    const baseConfidence = this.calculateCapabilityMatch(
      agent,
      proposal.targetCapabilities
    );

    const typeBonus = this.getAgentTypeRelevance(
      agent.agentType,
      proposal.targetCapabilities
    );

    const confidence = Math.min(1, baseConfidence * 0.6 + typeBonus * 0.4);

    const estimatedDuration = Math.round(
      proposal.estimatedComplexity * 1000 * (2 - confidence)
    );

    return {
      agentId: agent.id,
      taskId: proposal.taskId,
      confidence,
      estimatedDuration,
      reasoningScore: confidence,
      availabilityScore,
      experienceScore,
    };
  }

  private calculateCapabilityMatch(agent: Agent, required: string[]): number {
    if (required.length === 0) return 0.7;
    if (!agent.capabilities) return 0.3;

    let matched = 0;
    for (const cap of required) {
      const caps = agent.capabilities;
      switch (cap) {
        case "code":
          if (caps.canExecuteCode) matched++;
          break;
        case "web":
          if (caps.canBrowseWeb || caps.canSearchWeb) matched++;
          break;
        case "ssh":
          if (caps.canSSH) matched++;
          break;
        case "files":
          if (caps.canAccessFiles) matched++;
          break;
        case "images":
          if (caps.canGenerateImages) matched++;
          break;
        case "infrastructure":
          if (caps.canManageInfrastructure) matched++;
          break;
        default:
          if (caps.customTools?.includes(cap)) matched++;
      }
    }

    return matched / required.length;
  }

  private getAgentTypeRelevance(
    agentType: AgentType,
    capabilities: string[]
  ): number {
    const typeCapMap: Record<AgentType, string[]> = {
      code: ["code", "files"],
      research: ["web", "files"],
      sysadmin: ["ssh", "infrastructure", "code"],
      data: ["code", "files", "images"],
      orchestrator: [],
      coordinator: [],
      specialist: ["code", "web", "files"],
      worker: ["code", "files"],
      custom: [],
    };

    const typeCaps = typeCapMap[agentType] || [];
    if (typeCaps.length === 0 || capabilities.length === 0) return 0.5;

    const overlap = capabilities.filter(c => typeCaps.includes(c)).length;
    return overlap / Math.max(capabilities.length, 1);
  }

  private calculateBidScore(bid: NegotiationBid): number {
    return (
      bid.confidence * 0.4 +
      bid.availabilityScore * 0.3 +
      bid.experienceScore * 0.2 +
      bid.reasoningScore * 0.1
    );
  }

  async acceptBestBid(taskId: number): Promise<Agent | null> {
    const bids = this.activeNegotiations.get(taskId);
    if (!bids || bids.length === 0) return null;

    const bestBid = bids[0];
    const agent = await agentManager.getAgent(bestBid.agentId);

    if (agent) {
      emitSwarmNegotiationComplete({
        taskId,
        winningAgentId: agent.id,
        winningAgentName: agent.name,
        totalBids: bids.length,
      });
    }

    this.activeNegotiations.delete(taskId);

    return agent;
  }

  async initiateConsensus(
    userId: number,
    proposalId: string,
    question: string,
    participatingAgentIds?: number[]
  ): Promise<string> {
    let agents: Agent[];

    if (participatingAgentIds && participatingAgentIds.length > 0) {
      agents = (
        await Promise.all(
          participatingAgentIds.map(id => agentManager.getAgent(id))
        )
      ).filter((a): a is Agent => a !== null);
    } else {
      agents = await agentManager.getUserAgents(userId);
      agents = agents.filter(
        a => a.status === "idle" || a.status === "waiting"
      );
    }

    if (agents.length === 0) {
      throw new Error("No agents available for consensus");
    }

    this.pendingVotes.set(proposalId, []);

    emitSwarmConsensusStart({
      proposalId,
      question,
      participantCount: agents.length,
    });

    for (const agent of agents) {
      const vote = await this.getAgentVote(agent, proposalId, question);
      const votes = this.pendingVotes.get(proposalId)!;
      votes.push(vote);
    }

    return proposalId;
  }

  private async getAgentVote(
    agent: Agent,
    proposalId: string,
    question: string,
    retryCount = 0
  ): Promise<ConsensusVote> {
    const maxRetries = 2;
    const weight = this.calculateAgentWeight(agent);

    try {
      const prompt = `You are ${agent.name}, a ${agent.agentType} agent.

Question for consensus: ${question}

Based on your expertise and perspective, provide your vote:
- Vote: approve, reject, or abstain
- Reasoning: Brief explanation (1-2 sentences)

Respond ONLY with a JSON object, no other text:
{"vote": "approve|reject|abstain", "reasoning": "your reasoning"}`;

      console.info(
        `[SwarmIntelligence] Getting vote from agent ${agent.name} (attempt ${retryCount + 1})`
      );

      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              'You are a voting agent. Respond only with valid JSON: {"vote": "approve" or "reject" or "abstain", "reasoning": "brief explanation"}',
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : "{}";
      console.info(
        `[SwarmIntelligence] Raw vote response from ${agent.name}: ${content.slice(0, 200)}`
      );

      const jsonMatch = content.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] || "{}");

      const validVotes = ["approve", "reject", "abstain"];
      const voteValue = validVotes.includes(parsed.vote)
        ? parsed.vote
        : "abstain";

      const vote: ConsensusVote = {
        agentId: agent.id,
        proposalId,
        vote: voteValue,
        weight,
        reasoning: parsed.reasoning || "No reasoning provided",
      };

      emitSwarmVote({
        proposalId,
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.agentType,
        vote: vote.vote,
        weight: vote.weight,
        reasoning: vote.reasoning,
      });

      return vote;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      console.error(
        `[SwarmIntelligence] Vote failed for agent ${agent.name} (attempt ${retryCount + 1}):`,
        errorMsg
      );

      if (retryCount < maxRetries) {
        const isTransient =
          errorMsg.includes("rate") ||
          errorMsg.includes("429") ||
          errorMsg.includes("503") ||
          errorMsg.includes("timeout") ||
          errorMsg.includes("ECONNRESET");

        if (isTransient) {
          const delay = Math.pow(2, retryCount) * 1000;
          console.info(
            `[SwarmIntelligence] Retrying vote for ${agent.name} in ${delay}ms`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.getAgentVote(agent, proposalId, question, retryCount + 1);
        }
      }

      const vote: ConsensusVote = {
        agentId: agent.id,
        proposalId,
        vote: "abstain",
        weight,
        reasoning: `Vote failed: ${errorMsg.slice(0, 100)}`,
      };

      emitSwarmVote({
        proposalId,
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.agentType,
        vote: vote.vote,
        weight: vote.weight,
        reasoning: vote.reasoning,
      });

      return vote;
    }
  }

  private calculateAgentWeight(agent: Agent): number {
    let weight = 1.0;

    if (agent.agentType === "orchestrator") weight += 0.3;
    if (agent.agentType === "specialist") weight += 0.2;

    const experience = Math.min(1, (agent.messagesProcessed || 0) / 100);
    weight += experience * 0.2;

    return Math.min(2.0, weight);
  }

  async getConsensusResult(proposalId: string): Promise<SwarmDecision | null> {
    const votes = this.pendingVotes.get(proposalId);
    if (!votes || votes.length === 0) return null;

    let approveWeight = 0;
    let rejectWeight = 0;
    let totalWeight = 0;

    for (const vote of votes) {
      totalWeight += vote.weight;
      if (vote.vote === "approve") {
        approveWeight += vote.weight;
      } else if (vote.vote === "reject") {
        rejectWeight += vote.weight;
      }
    }

    const approvalPercentage =
      totalWeight > 0 ? (approveWeight / totalWeight) * 100 : 0;
    const winningMargin = Math.abs(approveWeight - rejectWeight);

    let decision: SwarmDecision["decision"];
    if (approveWeight > rejectWeight) {
      decision = "approved";
    } else if (rejectWeight > approveWeight) {
      decision = "rejected";
    } else {
      decision = "tie";
    }

    this.pendingVotes.delete(proposalId);

    const result: SwarmDecision = {
      proposalId,
      decision,
      approvalPercentage,
      totalVotes: votes.length,
      winningMargin,
    };

    emitSwarmConsensusComplete({
      proposalId,
      decision: result.decision,
      approvalPercentage: result.approvalPercentage,
      totalVotes: result.totalVotes,
    });

    return result;
  }

  async formTeam(
    userId: number,
    request: TeamFormationRequest
  ): Promise<FormedTeam> {
    const allAgents = await agentManager.getUserAgents(userId);

    const availableAgents = allAgents.filter(
      a => a.status === "idle" || a.status === "waiting"
    );

    const scoredAgents = availableAgents.map(agent => ({
      agent,
      score: this.scoreAgentForTeam(agent, request),
    }));

    scoredAgents.sort((a, b) => b.score - a.score);

    const selectedAgents = scoredAgents
      .slice(0, request.maxAgents)
      .filter(
        (_, i) =>
          i < request.maxAgents && scoredAgents.length >= request.minAgents
      )
      .map(s => s.agent);

    if (selectedAgents.length < request.minAgents) {
      const needed = request.minAgents - selectedAgents.length;
      const newAgents = await this.spawnAgentsForTeam(userId, request, needed);
      selectedAgents.push(...newAgents);
    }

    const leader = this.selectTeamLeader(selectedAgents);

    const teamId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    emitSwarmTeamForming({
      teamId,
      taskDescription: request.taskDescription,
      requiredCapabilities: request.requiredCapabilities,
    });

    for (const agent of selectedAgents) {
      emitSwarmTeamMemberAdded({
        teamId,
        agentId: agent.id,
        agentName: agent.name,
        agentType: agent.agentType,
        isLeader: agent.id === leader.id,
      });
    }

    const team: FormedTeam = {
      teamId,
      members: selectedAgents,
      leaderId: leader.id,
      taskDescription: request.taskDescription,
      formationReason: `Formed with ${selectedAgents.length} agents for: ${request.taskDescription}`,
    };

    this.activeTeams.set(teamId, team);

    emitSwarmTeamFormed({
      teamId,
      memberCount: selectedAgents.length,
      leaderId: leader.id,
      leaderName: leader.name,
    });

    await this.notifyTeamMembers(team);

    return team;
  }

  private scoreAgentForTeam(
    agent: Agent,
    request: TeamFormationRequest
  ): number {
    let score = 0;

    const capabilityMatch = this.calculateCapabilityMatch(
      agent,
      request.requiredCapabilities
    );
    score += capabilityMatch * 40;

    if (
      request.preferredAgentTypes &&
      request.preferredAgentTypes.includes(agent.agentType)
    ) {
      score += 30;
    }

    if (agent.status === "idle") score += 20;
    else if (agent.status === "waiting") score += 10;

    const experience = Math.min(20, (agent.messagesProcessed || 0) / 5);
    score += experience;

    return score;
  }

  private async spawnAgentsForTeam(
    userId: number,
    request: TeamFormationRequest,
    count: number
  ): Promise<Agent[]> {
    const newAgents: Agent[] = [];

    const typesToSpawn = request.preferredAgentTypes || ["worker"];

    for (let i = 0; i < count; i++) {
      const agentType = typesToSpawn[i % typesToSpawn.length];
      const agent = await agentManager.spawnAgent(userId, {
        type: agentType,
        name: `${agentType}-team-${Date.now()}-${i}`,
      });
      newAgents.push(agent);
    }

    return newAgents;
  }

  private selectTeamLeader(agents: Agent[]): Agent {
    const leaderPriority: AgentType[] = [
      "orchestrator",
      "coordinator",
      "specialist",
      "code",
      "research",
      "sysadmin",
      "data",
      "worker",
      "custom",
    ];

    agents.sort((a, b) => {
      const aPriority = leaderPriority.indexOf(a.agentType);
      const bPriority = leaderPriority.indexOf(b.agentType);
      if (aPriority !== bPriority) return aPriority - bPriority;

      return (b.messagesProcessed || 0) - (a.messagesProcessed || 0);
    });

    return agents[0];
  }

  private async notifyTeamMembers(team: FormedTeam): Promise<void> {
    for (const member of team.members) {
      if (member.id === team.leaderId) continue;

      await agentManager.sendMessage(
        team.leaderId,
        member.id,
        "task",
        `You have been assigned to team ${team.teamId}. Leader: Agent ${team.leaderId}. Task: ${team.taskDescription}`,
        {
          priority: "high",
          metadata: { teamId: team.teamId, role: "member" },
        }
      );
    }
  }

  async getTeam(teamId: string): Promise<FormedTeam | null> {
    return this.activeTeams.get(teamId) || null;
  }

  async disbandTeam(teamId: string): Promise<void> {
    const team = this.activeTeams.get(teamId);
    if (!team) return;

    for (const member of team.members) {
      await agentManager.updateAgentStatus(member.id, "idle");
    }

    this.activeTeams.delete(teamId);

    emitSwarmTeamDisbanded(teamId);
  }

  async broadcastToTeam(
    teamId: string,
    fromAgentId: number,
    message: string
  ): Promise<void> {
    const team = this.activeTeams.get(teamId);
    if (!team) return;

    const fromAgent = team.members.find(m => m.id === fromAgentId);

    emitSwarmBroadcast({
      teamId,
      fromAgentId,
      fromAgentName: fromAgent?.name || `Agent ${fromAgentId}`,
      message,
    });

    for (const member of team.members) {
      if (member.id === fromAgentId) continue;

      await agentManager.sendMessage(
        fromAgentId,
        member.id,
        "status",
        message,
        {
          metadata: { teamId, broadcast: true },
        }
      );
    }
  }

  async getActiveTeams(userId: number): Promise<FormedTeam[]> {
    const teams: FormedTeam[] = [];

    for (const team of Array.from(this.activeTeams.values())) {
      if (team.members.some(m => m.userId === userId)) {
        teams.push(team);
      }
    }

    return teams;
  }

  getNegotiationStatus(taskId: number): NegotiationBid[] | null {
    return this.activeNegotiations.get(taskId) || null;
  }

  getVotingStatus(proposalId: string): ConsensusVote[] | null {
    return this.pendingVotes.get(proposalId) || null;
  }
}

export const swarmIntelligence = new SwarmIntelligenceService();

export async function initiateNegotiation(
  userId: number,
  taskId: number,
  taskDescription: string,
  requiredCapabilities: string[] = [],
  priority: TaskPriority = "normal"
): Promise<NegotiationBid[]> {
  return swarmIntelligence.initiateTaskNegotiation(userId, {
    taskId,
    taskDescription,
    proposingAgentId: 0,
    targetCapabilities: requiredCapabilities,
    priority,
    estimatedComplexity: 5,
  });
}

export async function formAgentTeam(
  userId: number,
  taskDescription: string,
  requiredCapabilities: string[] = [],
  minAgents: number = 2,
  maxAgents: number = 5
): Promise<FormedTeam> {
  return swarmIntelligence.formTeam(userId, {
    taskDescription,
    requiredCapabilities,
    minAgents,
    maxAgents,
  });
}

export async function runConsensus(
  userId: number,
  question: string
): Promise<SwarmDecision> {
  const proposalId = `consensus-${Date.now()}`;
  await swarmIntelligence.initiateConsensus(userId, proposalId, question);
  const result = await swarmIntelligence.getConsensusResult(proposalId);
  if (!result) throw new Error("Consensus failed");
  return result;
}
