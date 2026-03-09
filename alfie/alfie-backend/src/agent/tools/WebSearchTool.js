import { BaseTool } from '../BaseTool.js';

export class WebSearchTool extends BaseTool {
  constructor() {
    super({
      name: 'web_search',
      description: 'Search the web for current information. Returns relevant results with sources.',
      parameters: {
        properties: {
          query: { type: 'string', description: 'Search query' },
        },
        required: ['query'],
      },
    });
    this.timeout = 30000;
  }

  async execute(input) {
    const { search } = await import('../../services/perplexityService.js');
    const result = await search(input.query);
    return typeof result === 'string' ? result : JSON.stringify(result);
  }
}
