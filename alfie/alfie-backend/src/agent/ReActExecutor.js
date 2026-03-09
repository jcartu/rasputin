import Anthropic from '@anthropic-ai/sdk';
import { buildSystemPrompt, NEXT_STEP_PROMPT, PLANNING_PROMPT } from './prompts.js';

function getAnthropicKey() {
  return process.env.ANTHROPIC_API_KEY || '';
}

export class ReActExecutor {
  constructor(options = {}) {
    this.model = options.model || 'claude-opus-4-6';
    this.maxIterations = options.maxIterations || 30;
    this.toolRegistry = options.toolRegistry || null;
    this.onThinking = options.onThinking || (() => {});
    this.onToolCall = options.onToolCall || (() => {});
    this.onToolResult = options.onToolResult || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onError = options.onError || (() => {});
    this.planningPrompt = options.planningPrompt || PLANNING_PROMPT;
    this.nextStepPrompt = options.nextStepPrompt || NEXT_STEP_PROMPT;
  }

  async execute(userTask, context = {}) {
    const client = new Anthropic({ apiKey: getAnthropicKey() });
    const tools = this.toolRegistry ? this.toolRegistry.toAnthropicTools() : [];
    const toolDescriptions = this.toolRegistry ? this.toolRegistry.list() : [];
    const systemPrompt = buildSystemPrompt(toolDescriptions);

    const messages = [
      { role: 'user', content: userTask },
    ];

    let iteration = 0;
    let finalOutput = '';
    const allSteps = [];

    while (iteration < this.maxIterations) {
      iteration += 1;

      this.onThinking({ iteration, maxIterations: this.maxIterations });

      let response;
      try {
        const requestParams = {
          model: this.model,
          max_tokens: 4096,
          system: systemPrompt,
          messages,
        };
        if (tools.length > 0) {
          requestParams.tools = tools;
        }
        response = await client.messages.create(requestParams);
      } catch (error) {
        this.onError({ iteration, error: error.message });
        throw error;
      }

      const contentBlocks = Array.isArray(response?.content) ? response.content : [];
      const textBlocks = [];
      const toolUseBlocks = [];

      for (const block of contentBlocks) {
        if (block.type === 'text') {
          textBlocks.push(block.text);
        } else if (block.type === 'tool_use') {
          toolUseBlocks.push(block);
        }
      }

      const thinkingText = textBlocks.join('\n');
      if (thinkingText) {
        this.onThinking({ iteration, content: thinkingText });
      }

      messages.push({ role: 'assistant', content: contentBlocks });

      if (toolUseBlocks.length === 0) {
        finalOutput = thinkingText;
        this.onComplete({
          iteration,
          output: finalOutput,
          reason: response?.stop_reason || 'end_turn',
        });
        break;
      }

      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        this.onToolCall({
          iteration,
          tool: toolUse.name,
          input: toolUse.input,
          toolUseId: toolUse.id,
        });

        let result;
        try {
          if (this.toolRegistry) {
            result = await this.toolRegistry.execute(
              toolUse.name,
              toolUse.input,
              { ...context, iteration }
            );
          } else {
            result = { success: false, error: 'No tool registry available' };
          }
        } catch (error) {
          result = { success: false, error: error.message };
        }

        const resultContent = result?.success
          ? (typeof result.output === 'string' ? result.output : JSON.stringify(result.output))
          : `Error: ${result?.error || 'Unknown error'}`;

        this.onToolResult({
          iteration,
          tool: toolUse.name,
          result: resultContent,
          success: Boolean(result?.success),
          toolUseId: toolUse.id,
        });

        allSteps.push({
          iteration,
          type: 'tool_call',
          tool: toolUse.name,
          input: toolUse.input,
          output: resultContent,
          success: Boolean(result?.success),
        });

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: resultContent,
        });
      }

      messages.push({ role: 'user', content: toolResults });
    }

    if (iteration >= this.maxIterations) {
      finalOutput = finalOutput || 'Maximum iterations reached.';
      this.onComplete({ iteration, output: finalOutput, reason: 'max_iterations' });
    }

    return {
      output: finalOutput,
      iterations: iteration,
      steps: allSteps,
      messages,
    };
  }
}
