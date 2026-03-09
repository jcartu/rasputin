const VALID_TRANSITIONS = {
  pending: ['running', 'cancelled'],
  running: ['thinking', 'failed', 'cancelled'],
  thinking: ['acting', 'completed', 'failed', 'cancelled'],
  acting: ['observing', 'failed', 'cancelled'],
  observing: ['thinking', 'completed', 'failed', 'cancelled'],
  completed: [],
  failed: [],
  cancelled: [],
};

const MAX_ITERATIONS = 30;
const MAX_TIMEOUT_MS = 30 * 60 * 1000;

export class AgentStateMachine {
  constructor(taskId, options = {}) {
    this.taskId = taskId;
    this.status = 'pending';
    this.iteration = 0;
    this.maxIterations = options.maxSteps || MAX_ITERATIONS;
    this.timeoutMs = options.timeoutMs || MAX_TIMEOUT_MS;
    this.startedAt = null;
    this.listeners = new Map();
  }

  canTransition(to) {
    return VALID_TRANSITIONS[this.status]?.includes(to) ?? false;
  }

  transition(to) {
    if (!this.canTransition(to)) {
      throw new Error(`Invalid transition: ${this.status} → ${to}`);
    }
    const from = this.status;
    this.status = to;

    if (to === 'running' && !this.startedAt) {
      this.startedAt = Date.now();
    }
    if (to === 'thinking') {
      this.iteration += 1;
    }

    this.emit('transition', { from, to, iteration: this.iteration });
    return this;
  }

  checkGuards() {
    if (this.iteration >= this.maxIterations) {
      return { blocked: true, reason: `Max iterations reached (${this.maxIterations})` };
    }
    if (this.startedAt && (Date.now() - this.startedAt) > this.timeoutMs) {
      return { blocked: true, reason: `Timeout exceeded (${this.timeoutMs}ms)` };
    }
    return { blocked: false };
  }

  on(event, callback) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event).push(callback);
    return this;
  }

  emit(event, data) {
    const callbacks = this.listeners.get(event) || [];
    for (const cb of callbacks) cb(data);
  }

  toJSON() {
    return {
      taskId: this.taskId,
      status: this.status,
      iteration: this.iteration,
      maxIterations: this.maxIterations,
      startedAt: this.startedAt,
      elapsed: this.startedAt ? Date.now() - this.startedAt : 0,
    };
  }
}
