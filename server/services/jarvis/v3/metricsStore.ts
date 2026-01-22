import { getDb } from "../../../db";
import {
  swarmAgentMetrics,
  consensusVoteLog,
  type ConsensusVoteLog,
} from "../../../../drizzle/schema";
import { eq, sql, desc } from "drizzle-orm";
import type { AgentType, ConsensusVote, ConsensusResult } from "./types";

export async function persistAgentMetrics(
  agentType: AgentType,
  success: boolean,
  durationMs: number,
  tokensUsed?: number,
  cost?: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  const existing = await db
    .select()
    .from(swarmAgentMetrics)
    .where(eq(swarmAgentMetrics.agentType, agentType))
    .limit(1);

  if (existing.length === 0) {
    await db.insert(swarmAgentMetrics).values({
      agentType,
      tasksCompleted: success ? 1 : 0,
      tasksFailed: success ? 0 : 1,
      averageDurationMs: durationMs,
      successRate: success ? "1.0000" : "0.0000",
      lastTaskAt: new Date(),
      totalTokensUsed: tokensUsed ?? 0,
      totalCost: String(cost ?? 0),
    });
  } else {
    const current = existing[0];
    const totalTasks = current.tasksCompleted + current.tasksFailed + 1;
    const newCompleted = current.tasksCompleted + (success ? 1 : 0);
    const newFailed = current.tasksFailed + (success ? 0 : 1);
    const newSuccessRate = newCompleted / totalTasks;
    const newAvgDuration = Math.round(
      (current.averageDurationMs * (totalTasks - 1) + durationMs) / totalTasks
    );

    await db
      .update(swarmAgentMetrics)
      .set({
        tasksCompleted: newCompleted,
        tasksFailed: newFailed,
        averageDurationMs: newAvgDuration,
        successRate: newSuccessRate.toFixed(4),
        lastTaskAt: new Date(),
        totalTokensUsed: sql`${swarmAgentMetrics.totalTokensUsed} + ${tokensUsed ?? 0}`,
        totalCost: sql`${swarmAgentMetrics.totalCost} + ${cost ?? 0}`,
      })
      .where(eq(swarmAgentMetrics.agentType, agentType));
  }
}

export async function persistConsensusVote(
  proposalId: string,
  question: string,
  vote: ConsensusVote,
  taskId?: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(consensusVoteLog).values({
    proposalId,
    taskId,
    question,
    agentType: vote.agentType,
    vote: vote.vote,
    confidence: vote.confidence.toFixed(2),
    reasoning: vote.reasoning,
  });
}

export async function persistConsensusResult(
  proposalId: string,
  result: ConsensusResult
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(consensusVoteLog)
    .set({
      decision:
        result.decision === "approved" || result.decision === "rejected"
          ? result.decision
          : result.decision === "timeout"
            ? "timeout"
            : "insufficient",
      agreementPercentage: (result.agreementPercentage * 100).toFixed(2),
    })
    .where(eq(consensusVoteLog.proposalId, proposalId));
}

interface AgentMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  successRate: number;
  avgDurationMs: number;
  totalTokensUsed: number;
  totalCost: number;
  lastTaskAt: Date | null;
}

export async function getPersistedAgentMetrics(): Promise<
  Partial<Record<AgentType, AgentMetrics>>
> {
  const db = await getDb();
  if (!db) return {};

  const rows = await db.select().from(swarmAgentMetrics);

  const result: Partial<Record<AgentType, AgentMetrics>> = {};
  for (const row of rows) {
    result[row.agentType as AgentType] = {
      tasksCompleted: row.tasksCompleted,
      tasksFailed: row.tasksFailed,
      successRate: parseFloat(String(row.successRate)),
      avgDurationMs: row.averageDurationMs,
      totalTokensUsed: row.totalTokensUsed,
      totalCost: parseFloat(String(row.totalCost)),
      lastTaskAt: row.lastTaskAt,
    };
  }

  return result;
}

export async function getRecentConsensusVotes(limit: number = 20): Promise<
  Array<{
    proposalId: string;
    question: string;
    agentType: AgentType;
    vote: "approve" | "reject" | "abstain";
    confidence: number;
    reasoning: string | null;
    decision: string | null;
    createdAt: Date;
  }>
> {
  const db = await getDb();
  if (!db) return [];

  const rows = await db
    .select()
    .from(consensusVoteLog)
    .orderBy(desc(consensusVoteLog.createdAt))
    .limit(limit);

  return rows.map((r: ConsensusVoteLog) => ({
    proposalId: r.proposalId,
    question: r.question,
    agentType: r.agentType as AgentType,
    vote: r.vote as "approve" | "reject" | "abstain",
    confidence: parseFloat(String(r.confidence)),
    reasoning: r.reasoning,
    decision: r.decision,
    createdAt: r.createdAt,
  }));
}
