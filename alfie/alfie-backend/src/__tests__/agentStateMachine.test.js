import { describe, expect, it, vi } from 'vitest';
import { AgentStateMachine } from '../services/agentStateMachine.js';

describe('AgentStateMachine', () => {
  it('allows valid transitions through the ReAct loop', () => {
    const sm = new AgentStateMachine('task-1', { maxSteps: 5 });

    sm.transition('running')
      .transition('thinking')
      .transition('acting')
      .transition('observing')
      .transition('thinking')
      .transition('completed');

    expect(sm.status).toBe('completed');
    expect(sm.iteration).toBe(2);
  });

  it('rejects invalid transitions', () => {
    const sm = new AgentStateMachine('task-2');
    expect(() => sm.transition('completed')).toThrow('Invalid transition');

    sm.transition('running')
      .transition('thinking')
      .transition('acting')
      .transition('observing')
      .transition('thinking')
      .transition('completed');

    expect(() => sm.transition('thinking')).toThrow('Invalid transition');
  });

  it('blocks when max iterations is reached', () => {
    const sm = new AgentStateMachine('task-3', { maxSteps: 1 });

    sm.transition('running');
    sm.transition('thinking');

    const guard = sm.checkGuards();
    expect(guard.blocked).toBe(true);
    expect(guard.reason).toContain('Max iterations reached');
  });

  it('blocks when timeout is exceeded', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));

    const sm = new AgentStateMachine('task-4', { timeoutMs: 50 });
    sm.transition('running');

    vi.setSystemTime(new Date('2025-01-01T00:00:00.100Z'));
    const guard = sm.checkGuards();

    expect(guard.blocked).toBe(true);
    expect(guard.reason).toContain('Timeout exceeded');

    vi.useRealTimers();
  });

  it('emits transition events', () => {
    const sm = new AgentStateMachine('task-5');
    const events = [];

    sm.on('transition', (payload) => events.push(payload));

    sm.transition('running');
    sm.transition('thinking');

    expect(events).toEqual([
      { from: 'pending', to: 'running', iteration: 0 },
      { from: 'running', to: 'thinking', iteration: 1 },
    ]);
  });
});
