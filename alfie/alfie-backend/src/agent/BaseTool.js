export class BaseTool {
  constructor({ name, description, parameters }) {
    this.name = name;
    this.description = description;
    this.parameters = parameters;
    this.timeout = 60000;
  }

  async execute(input, context) {
    throw new Error(`${this.name}: execute() not implemented`);
  }

  validate(input) {
    if (!this.parameters?.properties) return { valid: true };
    const required = this.parameters.required || [];
    for (const field of required) {
      if (input[field] === undefined || input[field] === null) {
        return { valid: false, error: `Missing required field: ${field}` };
      }
    }
    return { valid: true };
  }

  toAnthropicTool() {
    return {
      name: this.name,
      description: this.description,
      input_schema: {
        type: 'object',
        ...this.parameters,
      },
    };
  }

  async executeWithTimeout(input, context) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeout);
    try {
      context.signal = controller.signal;
      const result = await this.execute(input, context);
      return { success: true, output: result };
    } catch (error) {
      if (error.name === 'AbortError') {
        return { success: false, error: `Tool ${this.name} timed out after ${this.timeout}ms` };
      }
      return { success: false, error: error.message };
    } finally {
      clearTimeout(timer);
    }
  }
}
