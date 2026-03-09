import { describe, expect, it, vi } from 'vitest';
import { BaseTool } from '../agent/BaseTool.js';
import { ToolRegistry, globalRegistry } from '../agent/ToolRegistry.js';

class TestTool extends BaseTool {
  constructor() {
    super({
      name: 'test_tool',
      description: 'A test tool',
      parameters: {
        properties: {
          input: { type: 'string' },
        },
        required: ['input'],
      },
    });
  }

  async execute(input, context) {
    return `Executed with: ${input.input}`;
  }
}

describe('ToolRegistry', () => {
  it('registers and retrieves a tool', () => {
    const registry = new ToolRegistry();
    const tool = new TestTool();

    registry.register(tool);

    expect(registry.has('test_tool')).toBe(true);
    expect(registry.get('test_tool')).toBe(tool);
    expect(registry.size).toBe(1);
  });

  it('returns null for unknown tool', () => {
    const registry = new ToolRegistry();
    expect(registry.get('unknown')).toBeNull();
    expect(registry.has('unknown')).toBe(false);
  });

  it('lists all registered tools', () => {
    const registry = new ToolRegistry();
    const tool = new TestTool();
    registry.register(tool);

    const list = registry.list();

    expect(list).toEqual([
      { name: 'test_tool', description: 'A test tool' },
    ]);
  });

  it('executes a tool successfully', async () => {
    const registry = new ToolRegistry();
    registry.register(new TestTool());

    const result = await registry.execute('test_tool', { input: 'hello' }, {});

    expect(result.success).toBe(true);
    expect(result.output).toBe('Executed with: hello');
  });

  it('returns error for unknown tool execution', async () => {
    const registry = new ToolRegistry();

    const result = await registry.execute('unknown', {}, {});

    expect(result.success).toBe(false);
    expect(result.error).toBe('Unknown tool: unknown');
  });

  it('validates required fields before execution', async () => {
    const registry = new ToolRegistry();
    registry.register(new TestTool());

    const result = await registry.execute('test_tool', {}, {});

    expect(result.success).toBe(false);
    expect(result.error).toBe('Missing required field: input');
  });

  it('converts tools to Anthropic format', () => {
    const registry = new ToolRegistry();
    registry.register(new TestTool());

    const anthropicTools = registry.toAnthropicTools();

    expect(anthropicTools).toEqual([
      {
        name: 'test_tool',
        description: 'A test tool',
        input_schema: {
          type: 'object',
          properties: {
            input: { type: 'string' },
          },
          required: ['input'],
        },
      },
    ]);
  });

  it('throws when registering tool without name', () => {
    const registry = new ToolRegistry();
    const invalidTool = { description: 'no name' };

    expect(() => registry.register(invalidTool)).toThrow('Tool must have a name');
  });
});

describe('BaseTool', () => {
  it('throws when execute is not implemented', async () => {
    const tool = new BaseTool({
      name: 'abstract_tool',
      description: 'test',
      parameters: {},
    });

    await expect(tool.execute({}, {})).rejects.toThrow('abstract_tool: execute() not implemented');
  });

  it('validates passes when no required fields', () => {
    const tool = new BaseTool({
      name: 'no_required',
      description: 'test',
      parameters: { properties: { optional: { type: 'string' } } },
    });

    expect(tool.validate({})).toEqual({ valid: true });
  });

  it('handles execution errors gracefully', async () => {
    const failingTool = new BaseTool({
      name: 'failing_tool',
      description: 'test',
      parameters: {},
    });
    failingTool.execute = async () => {
      throw new Error('Something went wrong');
    };

    const result = await failingTool.executeWithTimeout({}, {});

    expect(result.success).toBe(false);
    expect(result.error).toBe('Something went wrong');
  });

  it('passes abort signal in context', async () => {
    const tool = new BaseTool({
      name: 'signal_tool',
      description: 'test',
      parameters: {},
    });
    let receivedSignal = null;
    tool.execute = async (input, context) => {
      receivedSignal = context.signal;
      return 'done';
    };

    const context = {};
    await tool.executeWithTimeout({}, context);

    expect(receivedSignal).toBeInstanceOf(AbortSignal);
  });
});

describe('globalRegistry', () => {
  it('is a shared ToolRegistry instance', () => {
    expect(globalRegistry).toBeInstanceOf(ToolRegistry);
  });
});
