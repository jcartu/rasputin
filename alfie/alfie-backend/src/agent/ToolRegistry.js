export class ToolRegistry {
  constructor() {
    this.tools = new Map();
  }

  register(tool) {
    if (!tool.name) throw new Error('Tool must have a name');
    this.tools.set(tool.name, tool);
    return this;
  }

  get(name) {
    return this.tools.get(name) || null;
  }

  has(name) {
    return this.tools.has(name);
  }

  list() {
    return Array.from(this.tools.values()).map(t => ({
      name: t.name,
      description: t.description,
    }));
  }

  toAnthropicTools() {
    return Array.from(this.tools.values()).map(t => t.toAnthropicTool());
  }

  async execute(name, input, context) {
    const tool = this.get(name);
    if (!tool) {
      return { success: false, error: `Unknown tool: ${name}` };
    }
    const validation = tool.validate(input);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }
    return tool.executeWithTimeout(input, context);
  }

  get size() {
    return this.tools.size;
  }
}

export const globalRegistry = new ToolRegistry();
