import {
  test,
  expect,
  TEST_MODELS,
  TEST_PROMPTS,
  PERFORMANCE_THRESHOLDS,
} from '../../fixtures/test-fixtures';

test.describe('Multi-Model AI Capabilities - MANUS Cannot Do This', () => {
  test.describe('Simultaneous Multi-Model Queries', () => {
    test('should query 3 models simultaneously with same prompt', async ({ api }) => {
      const prompt = TEST_PROMPTS.simple;
      const models = TEST_MODELS.slice(0, 3);

      const startTime = Date.now();
      const responses = await Promise.all(
        models.map((model) =>
          api.post('/api/chat/query', {
            prompt,
            model,
            stream: false,
          })
        )
      );
      const totalTime = Date.now() - startTime;

      expect(responses.every((r) => r.status === 200)).toBeTruthy();
      expect(totalTime).toBeLessThan(PERFORMANCE_THRESHOLDS.modelResponse);

      const answers = responses.map((r) => (r.data as { response: string }).response);
      expect(answers.length).toBe(3);
      answers.forEach((answer) => {
        expect(answer).toBeTruthy();
        expect(answer.length).toBeGreaterThan(0);
      });
    });

    test('should run 5 models in parallel for consensus', async ({ api }) => {
      const response = await api.post('/api/consensus', {
        query: TEST_PROMPTS.analytical,
        models: TEST_MODELS,
        strategy: 'parallel',
      });

      expect(response.status).toBe(200);
      const data = response.data as {
        consensus: string;
        confidence: number;
        modelResponses: unknown[];
      };
      expect(data.consensus).toBeTruthy();
      expect(data.confidence).toBeGreaterThan(0);
      expect(data.modelResponses.length).toBe(TEST_MODELS.length);
    });

    test('should compare model responses and detect contradictions', async ({ api }) => {
      const response = await api.post('/api/consensus', {
        query: 'Is water wet?',
        models: TEST_MODELS.slice(0, 3),
        detectContradictions: true,
      });

      expect(response.status).toBe(200);
      const data = response.data as {
        hasContradictions: boolean;
        contradictionDetails?: unknown[];
      };
      expect(typeof data.hasContradictions).toBe('boolean');
    });

    test('should aggregate confidence scores from multiple models', async ({ api }) => {
      const response = await api.post('/api/consensus', {
        query: TEST_PROMPTS.complex,
        models: TEST_MODELS,
        returnConfidenceScores: true,
      });

      expect(response.status).toBe(200);
      const data = response.data as {
        aggregateConfidence: number;
        individualScores: Record<string, number>;
      };
      expect(data.aggregateConfidence).toBeGreaterThanOrEqual(0);
      expect(data.aggregateConfidence).toBeLessThanOrEqual(100);
    });
  });

  test.describe('Model Switching Mid-Conversation', () => {
    test('should switch models while preserving context', async ({ api, testSession }) => {
      await api.sendMessage(testSession.id, 'My name is Alice', 'claude-3-sonnet');

      const response = await api.sendMessage(testSession.id, 'What is my name?', 'gpt-4-turbo');

      expect(response.status).toBe(200);
      const data = response.data as { response: string };
      expect(data.response.toLowerCase()).toContain('alice');
    });

    test('should maintain conversation history across 5 model switches', async ({
      api,
      testSession,
    }) => {
      const models = [
        'claude-3-sonnet',
        'gpt-4-turbo',
        'gemini-pro',
        'claude-3-opus',
        'local-llama-70b',
      ];
      const facts = [
        'The project is called ALFIE',
        'We are building an AI assistant',
        'The deadline is next Friday',
        'Budget is $50,000',
        'Team size is 5 people',
      ];

      for (let i = 0; i < models.length; i++) {
        await api.sendMessage(testSession.id, `Remember: ${facts[i]}`, models[i]);
      }

      const response = await api.sendMessage(
        testSession.id,
        'What are all the facts you remember about the project?',
        'claude-3-sonnet'
      );

      expect(response.status).toBe(200);
      const data = response.data as { response: string };
      facts.forEach((fact) => {
        expect(data.response.toLowerCase()).toContain(
          fact.split(' ').slice(-2).join(' ').toLowerCase()
        );
      });
    });

    test('should handle model fallback when primary is unavailable', async ({ api }) => {
      const response = await api.post('/api/chat/query', {
        prompt: TEST_PROMPTS.simple,
        model: 'unavailable-model',
        fallbackModels: ['claude-3-sonnet', 'gpt-4-turbo'],
      });

      expect(response.status).toBe(200);
      const data = response.data as { model: string; response: string };
      expect(['claude-3-sonnet', 'gpt-4-turbo']).toContain(data.model);
    });
  });

  test.describe('Model Performance Comparison', () => {
    test('should benchmark response times across models', async ({ api }) => {
      const results: Record<string, number> = {};

      for (const model of TEST_MODELS.slice(0, 3)) {
        const start = Date.now();
        await api.post('/api/chat/query', {
          prompt: TEST_PROMPTS.simple,
          model,
          stream: false,
        });
        results[model] = Date.now() - start;
      }

      expect(
        Object.values(results).every((t) => t < PERFORMANCE_THRESHOLDS.modelResponse)
      ).toBeTruthy();
    });

    test('should return token usage for each model', async ({ api }) => {
      const responses = await Promise.all(
        TEST_MODELS.slice(0, 3).map((model) =>
          api.post('/api/chat/query', {
            prompt: TEST_PROMPTS.coding,
            model,
            returnUsage: true,
          })
        )
      );

      responses.forEach((response) => {
        expect(response.status).toBe(200);
        const data = response.data as { usage: { promptTokens: number; completionTokens: number } };
        expect(data.usage).toBeDefined();
        expect(data.usage.promptTokens).toBeGreaterThan(0);
        expect(data.usage.completionTokens).toBeGreaterThan(0);
      });
    });

    test('should track cost per model', async ({ api }) => {
      const response = await api.post('/api/consensus', {
        query: TEST_PROMPTS.analytical,
        models: TEST_MODELS.slice(0, 3),
        trackCost: true,
      });

      expect(response.status).toBe(200);
      const data = response.data as {
        costs: Record<string, number>;
        totalCost: number;
      };
      expect(data.totalCost).toBeGreaterThan(0);
    });
  });

  test.describe('Prompt Template Chaining', () => {
    test('should execute 5-step prompt chain', async ({ api }) => {
      const chain = [
        { template: 'research', variables: { topic: 'quantum computing' } },
        { template: 'summarize', variables: { length: 'brief' } },
        { template: 'critique', variables: { perspective: 'scientist' } },
        { template: 'improve', variables: { focus: 'clarity' } },
        { template: 'format', variables: { style: 'bullet_points' } },
      ];

      const response = await api.post('/api/templates/chain', {
        chain,
        model: 'claude-3-sonnet',
      });

      expect(response.status).toBe(200);
      const data = response.data as {
        finalOutput: string;
        intermediateSteps: unknown[];
      };
      expect(data.intermediateSteps.length).toBe(5);
      expect(data.finalOutput).toBeTruthy();
    });

    test('should support conditional branching in chains', async ({ api }) => {
      const response = await api.post('/api/templates/chain', {
        chain: [
          { template: 'classify', variables: { text: 'This is a technical question about APIs' } },
          {
            conditional: true,
            branches: {
              technical: { template: 'technical_answer' },
              creative: { template: 'creative_answer' },
              default: { template: 'general_answer' },
            },
          },
        ],
        model: 'claude-3-sonnet',
      });

      expect(response.status).toBe(200);
      const data = response.data as { branchTaken: string };
      expect(data.branchTaken).toBe('technical');
    });

    test('should pass variables between chain steps', async ({ api }) => {
      const response = await api.post('/api/templates/chain', {
        chain: [
          {
            template: 'extract_entities',
            variables: { text: 'John works at Google in San Francisco' },
            outputVariable: 'entities',
          },
          {
            template: 'enrich_entities',
            variables: { entities: '{{entities}}' },
          },
        ],
        model: 'claude-3-sonnet',
      });

      expect(response.status).toBe(200);
    });
  });

  test.describe('Fine-tuning Job Management', () => {
    test('should create fine-tuning job', async ({ api }) => {
      const response = await api.post('/api/finetune/jobs', {
        baseModel: 'gpt-3.5-turbo',
        trainingFile: 'test_training_data.jsonl',
        name: 'test-finetune-job',
      });

      expect([200, 201, 202]).toContain(response.status);
    });

    test('should list fine-tuning jobs', async ({ api }) => {
      const response = await api.get('/api/finetune/jobs');

      expect(response.status).toBe(200);
      const data = response.data as { jobs: unknown[] };
      expect(Array.isArray(data.jobs)).toBeTruthy();
    });

    test('should get fine-tuning job status', async ({ api }) => {
      const createResponse = await api.post('/api/finetune/jobs', {
        baseModel: 'gpt-3.5-turbo',
        trainingFile: 'test_training_data.jsonl',
        name: 'status-test-job',
      });

      if (createResponse.status >= 200 && createResponse.status < 300) {
        const jobId = (createResponse.data as { id: string }).id;
        const statusResponse = await api.get(`/api/finetune/jobs/${jobId}`);

        expect(statusResponse.status).toBe(200);
        const data = statusResponse.data as { status: string };
        expect(['pending', 'running', 'completed', 'failed', 'cancelled']).toContain(data.status);
      }
    });

    test('should cancel fine-tuning job', async ({ api }) => {
      const createResponse = await api.post('/api/finetune/jobs', {
        baseModel: 'gpt-3.5-turbo',
        trainingFile: 'test_training_data.jsonl',
        name: 'cancel-test-job',
      });

      if (createResponse.status >= 200 && createResponse.status < 300) {
        const jobId = (createResponse.data as { id: string }).id;
        const cancelResponse = await api.post(`/api/finetune/jobs/${jobId}/cancel`);

        expect([200, 202]).toContain(cancelResponse.status);
      }
    });
  });
});
