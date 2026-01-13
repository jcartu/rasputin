export type EventType =
  | "OBSERVATION"
  | "PLAN"
  | "TOOL_CALL"
  | "ACTION"
  | "VERIFICATION"
  | "FEEDBACK"
  | "ERROR"
  | "TASK_START"
  | "TASK_END"
  | "STATE_UPDATE"
  | "PLAN_PROPOSED"
  | "ACTION_PROPOSED"
  | "ACTION_RESULT"
  | "CONTROL_CMD";

export interface BusMessage {
  messageId: string;
  taskId: string;
  userId: string;
  sessionId: string;
  type: EventType;
  payload: Record<string, unknown>;
  timestamp: number;
  idempotencyKey?: string;
}

export interface StreamEntry {
  id: string;
  message: BusMessage;
}

export interface LockResult {
  acquired: boolean;
  owner?: string;
  ttlMs?: number;
}

export interface TaskState {
  taskId: string;
  userId: string;
  sessionId: string;
  status: "idle" | "running" | "completed" | "failed" | "paused";
  currentPhase?: string;
  stateHash?: string;
  lastActionId?: string;
  iterationCount: number;
  updatedAt: number;
}

export interface ControlCommand {
  command: "PAUSE" | "RESUME" | "CANCEL" | "RECOVERY" | "REQUIRE_USER";
  reason?: string;
  metadata?: Record<string, unknown>;
}
