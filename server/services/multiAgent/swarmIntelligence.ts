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
  emitCollectiveProblemStart,
  emitSubProblemAssigned,
  emitSubProblemSolved,
  emitKnowledgeShared,
  emitSolutionSynthesized,
  emitRoleAdaptation,
  emitStigmergyMarker,
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

export interface CollectiveProblem {
  problemId: string;
  description: string;
  subProblems: SubProblem[];
  sharedKnowledge: KnowledgeFragment[];
  currentPhase: "decomposition" | "solving" | "synthesis" | "complete";
  contributors: number[];
}

export interface SubProblem {
  id: string;
  description: string;
  assignedAgentId: number | null;
  status: "pending" | "in_progress" | "solved" | "blocked";
  solution: string | null;
  dependencies: string[];
  confidence: number;
}

export interface KnowledgeFragment {
  id: string;
  contributorAgentId: number;
  content: string;
  type: "insight" | "constraint" | "solution" | "warning";
  relevanceScore: number;
  timestamp: number;
}

export interface RoleAdaptation {
  agentId: number;
  originalRole: AgentType;
  adaptedRole: AgentType;
  reason: string;
  timestamp: number;
  performance: number;
}

export interface StigmergyMarker {
  id: string;
  type: "pheromone" | "artifact" | "signal";
  taskContext: string;
  decayingStrength: number;
  message: string;
  createdBy: number;
  createdAt: number;
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
  private collectiveProblems: Map<string, CollectiveProblem> = new Map();
  private roleAdaptations: Map<number, RoleAdaptation> = new Map();
  private stigmergyMarkers: Map<string, StigmergyMarker[]> = new Map();
  private swarmKnowledge: KnowledgeFragment[] = [];

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

  async initiateCollectiveProblemSolving(
    userId: number,
    problemDescription: string,
    teamId?: string
  ): Promise<CollectiveProblem> {
    const problemId = `problem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    let agents: Agent[];
    if (teamId) {
      const team = this.activeTeams.get(teamId);
      agents = team?.members || [];
    } else {
      agents = await agentManager.getUserAgents(userId);
      agents = agents.filter(
        a => a.status === "idle" || a.status === "waiting"
      );
    }

    if (agents.length === 0) {
      throw new Error("No agents available for collective problem solving");
    }

    const subProblems = await this.decomposeProblems(
      problemDescription,
      agents
    );

    const problem: CollectiveProblem = {
      problemId,
      description: problemDescription,
      subProblems,
      sharedKnowledge: [],
      currentPhase: "decomposition",
      contributors: agents.map(a => a.id),
    };

    this.collectiveProblems.set(problemId, problem);

    emitCollectiveProblemStart({
      problemId,
      description: problemDescription,
      subProblemCount: subProblems.length,
      contributorCount: agents.length,
    });

    await this.assignSubProblems(problem, agents);

    problem.currentPhase = "solving";
    return problem;
  }

  private async decomposeProblems(
    description: string,
    agents: Agent[]
  ): Promise<SubProblem[]> {
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a problem decomposition expert. Break down complex problems into smaller, parallelizable sub-problems.
Respond with JSON: {"subProblems": [{"description": "...", "dependencies": ["id1"], "complexity": 1-10}]}`,
          },
          {
            role: "user",
            content: `Decompose this problem for ${agents.length} agents to solve collaboratively:\n\n${description}`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const rawContent = response.choices[0]?.message?.content;
      const content = typeof rawContent === "string" ? rawContent : "{}";
      const parsed = JSON.parse(content);

      return (parsed.subProblems || []).map(
        (
          sp: {
            description: string;
            dependencies?: string[];
            complexity?: number;
          },
          i: number
        ) => ({
          id: `sp-${i}`,
          description: sp.description,
          assignedAgentId: null,
          status: "pending" as const,
          solution: null,
          dependencies: sp.dependencies || [],
          confidence: 0,
        })
      );
    } catch {
      return [
        {
          id: "sp-0",
          description,
          assignedAgentId: null,
          status: "pending" as const,
          solution: null,
          dependencies: [],
          confidence: 0,
        },
      ];
    }
  }

  private async assignSubProblems(
    problem: CollectiveProblem,
    agents: Agent[]
  ): Promise<void> {
    const unassigned = problem.subProblems.filter(sp => !sp.assignedAgentId);
    const available = [...agents];

    for (const subProblem of unassigned) {
      if (available.length === 0) break;

      const bestAgent = this.findBestAgentForSubProblem(subProblem, available);
      if (bestAgent) {
        subProblem.assignedAgentId = bestAgent.id;
        subProblem.status = "in_progress";
        available.splice(available.indexOf(bestAgent), 1);

        emitSubProblemAssigned({
          problemId: problem.problemId,
          subProblemId: subProblem.id,
          description: subProblem.description,
          agentId: bestAgent.id,
          agentName: bestAgent.name,
        });
      }
    }
  }

  private findBestAgentForSubProblem(
    subProblem: SubProblem,
    agents: Agent[]
  ): Agent | null {
    if (agents.length === 0) return null;

    const scored = agents.map(agent => {
      let score = 50;

      const adaptation = this.roleAdaptations.get(agent.id);
      if (adaptation && adaptation.performance > 0.7) {
        score += 20;
      }

      const agentMarkers = this.getMarkersForAgent(agent.id);
      const relevantMarkers = agentMarkers.filter(m =>
        subProblem.description
          .toLowerCase()
          .includes(m.message.toLowerCase().slice(0, 20))
      );
      score += relevantMarkers.length * 5;

      if (agent.agentType === "specialist" || agent.agentType === "code") {
        score += 10;
      }

      return { agent, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored[0]?.agent || null;
  }

  async contributeKnowledge(
    problemId: string,
    agentId: number,
    content: string,
    type: KnowledgeFragment["type"]
  ): Promise<void> {
    const problem = this.collectiveProblems.get(problemId);
    if (!problem) return;

    const fragment: KnowledgeFragment = {
      id: `kf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      contributorAgentId: agentId,
      content,
      type,
      relevanceScore: this.calculateKnowledgeRelevance(content, problem),
      timestamp: Date.now(),
    };

    problem.sharedKnowledge.push(fragment);
    this.swarmKnowledge.push(fragment);

    const agent = await agentManager.getAgent(agentId);
    emitKnowledgeShared({
      problemId,
      agentId,
      agentName: agent?.name || `Agent ${agentId}`,
      knowledgeType: type,
      relevanceScore: fragment.relevanceScore,
    });

    if (fragment.relevanceScore > 0.7) {
      await this.propagateKnowledge(problem, fragment);
    }
  }

  private calculateKnowledgeRelevance(
    content: string,
    problem: CollectiveProblem
  ): number {
    const contentLower = content.toLowerCase();
    const descLower = problem.description.toLowerCase();

    const words = descLower.split(/\s+/).filter(w => w.length > 3);
    const matches = words.filter(w => contentLower.includes(w)).length;

    return Math.min(1, matches / Math.max(words.length, 1));
  }

  private async propagateKnowledge(
    problem: CollectiveProblem,
    fragment: KnowledgeFragment
  ): Promise<void> {
    for (const agentId of problem.contributors) {
      if (agentId === fragment.contributorAgentId) continue;

      await agentManager.sendMessage(
        fragment.contributorAgentId,
        agentId,
        "status",
        `[Swarm Knowledge] ${fragment.type}: ${fragment.content}`,
        { metadata: { problemId: problem.problemId, knowledgeId: fragment.id } }
      );
    }
  }

  async adaptAgentRole(
    agentId: number,
    newRole: AgentType,
    reason: string
  ): Promise<RoleAdaptation> {
    const agent = await agentManager.getAgent(agentId);
    if (!agent) throw new Error("Agent not found");

    const adaptation: RoleAdaptation = {
      agentId,
      originalRole: agent.agentType,
      adaptedRole: newRole,
      reason,
      timestamp: Date.now(),
      performance: 0.5,
    };

    this.roleAdaptations.set(agentId, adaptation);

    emitRoleAdaptation({
      agentId,
      agentName: agent.name,
      originalRole: agent.agentType,
      newRole,
      reason,
    });

    return adaptation;
  }

  async updateAdaptationPerformance(
    agentId: number,
    performance: number
  ): Promise<void> {
    const adaptation = this.roleAdaptations.get(agentId);
    if (!adaptation) return;

    adaptation.performance = Math.max(0, Math.min(1, performance));

    if (adaptation.performance < 0.3) {
      this.roleAdaptations.delete(agentId);
    }
  }

  async placeStigmergyMarker(
    agentId: number,
    taskContext: string,
    message: string,
    type: StigmergyMarker["type"] = "pheromone"
  ): Promise<StigmergyMarker> {
    const marker: StigmergyMarker = {
      id: `marker-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      taskContext,
      decayingStrength: 1.0,
      message,
      createdBy: agentId,
      createdAt: Date.now(),
    };

    const contextMarkers = this.stigmergyMarkers.get(taskContext) || [];
    contextMarkers.push(marker);
    this.stigmergyMarkers.set(taskContext, contextMarkers);

    emitStigmergyMarker({
      markerId: marker.id,
      agentId,
      taskContext,
      markerType: type,
      message,
    });

    return marker;
  }

  getMarkersForContext(taskContext: string): StigmergyMarker[] {
    const markers = this.stigmergyMarkers.get(taskContext) || [];
    const now = Date.now();
    const decayRate = 0.1;

    return markers
      .map(m => ({
        ...m,
        decayingStrength: Math.max(
          0,
          m.decayingStrength - decayRate * ((now - m.createdAt) / 60000)
        ),
      }))
      .filter(m => m.decayingStrength > 0.1);
  }

  private getMarkersForAgent(agentId: number): StigmergyMarker[] {
    const allMarkers: StigmergyMarker[] = [];
    for (const markers of Array.from(this.stigmergyMarkers.values())) {
      allMarkers.push(
        ...markers.filter((m: StigmergyMarker) => m.createdBy === agentId)
      );
    }
    return allMarkers;
  }

  async synthesizeCollectiveSolution(
    problemId: string
  ): Promise<{ solution: string; confidence: number } | null> {
    const problem = this.collectiveProblems.get(problemId);
    if (!problem) return null;

    const solvedSubProblems = problem.subProblems.filter(
      sp => sp.status === "solved" && sp.solution
    );

    if (solvedSubProblems.length === 0) {
      return null;
    }

    const highValueKnowledge = problem.sharedKnowledge
      .filter(k => k.relevanceScore > 0.5)
      .map(k => `[${k.type}] ${k.content}`)
      .join("\n");

    try {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a synthesis expert. Combine sub-solutions and shared knowledge into a coherent final solution.
Respond with JSON: {"solution": "...", "confidence": 0.0-1.0}`,
          },
          {
            role: "user",
            content: `Original problem: ${problem.description}

Sub-solutions:
${solvedSubProblems.map(sp => `- ${sp.description}: ${sp.solution}`).join("\n")}

Shared knowledge:
${highValueKnowledge || "None"}

Synthesize a complete solution.`,
          },
        ],
        response_format: { type: "json_object" },
      });

      const rawSynthesisContent = response.choices[0]?.message?.content;
      const synthContent =
        typeof rawSynthesisContent === "string" ? rawSynthesisContent : "{}";
      const parsed = JSON.parse(synthContent);

      problem.currentPhase = "complete";

      emitSolutionSynthesized({
        problemId,
        confidence: parsed.confidence || 0.5,
        subProblemsSolved: solvedSubProblems.length,
      });

      return {
        solution: parsed.solution || "No solution generated",
        confidence: parsed.confidence || 0.5,
      };
    } catch {
      return null;
    }
  }

  async solveSubProblem(
    problemId: string,
    subProblemId: string,
    solution: string,
    confidence: number
  ): Promise<void> {
    const problem = this.collectiveProblems.get(problemId);
    if (!problem) return;

    const subProblem = problem.subProblems.find(sp => sp.id === subProblemId);
    if (!subProblem) return;

    subProblem.solution = solution;
    subProblem.confidence = confidence;
    subProblem.status = "solved";

    const solvedCount = problem.subProblems.filter(
      sp => sp.status === "solved"
    ).length;

    emitSubProblemSolved({
      problemId,
      subProblemId,
      agentId: subProblem.assignedAgentId || 0,
      confidence,
      solvedCount,
      totalCount: problem.subProblems.length,
    });

    if (subProblem.assignedAgentId) {
      await this.placeStigmergyMarker(
        subProblem.assignedAgentId,
        problemId,
        `Solved: ${subProblem.description.slice(0, 50)}`,
        "artifact"
      );
    }

    const allSolved = problem.subProblems.every(sp => sp.status === "solved");
    if (allSolved) {
      problem.currentPhase = "synthesis";
    }
  }

  getCollectiveProblem(problemId: string): CollectiveProblem | null {
    return this.collectiveProblems.get(problemId) || null;
  }

  getSwarmKnowledge(limit: number = 50): KnowledgeFragment[] {
    return this.swarmKnowledge
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, limit);
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
