import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface Session {
  id: string;
  name: string;
  createdAt: string;
  messageCount: number;
  model: string;
}

interface Conversation {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
  tokens?: number;
}

interface TestFile {
  path: string;
  content: string;
  type: string;
  size: number;
}

interface Memory {
  id: string;
  content: string;
  embedding?: number[];
  metadata: {
    source: string;
    timestamp: string;
    category: string;
  };
}

export class TestDataGenerator {
  private dataDir: string;

  constructor(dataDir = './data') {
    this.dataDir = dataDir;
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    const dirs = ['sessions', 'conversations', 'files', 'memories'];
    for (const dir of dirs) {
      const fullPath = path.join(this.dataDir, dir);
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
      }
    }
  }

  private generateId(): string {
    return crypto.randomBytes(16).toString('hex');
  }

  private randomChoice<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  async generateSessions(count: number): Promise<Session[]> {
    const models = [
      'claude-3-opus',
      'claude-3-sonnet',
      'gpt-4-turbo',
      'gemini-pro',
      'local-llama-70b',
    ];
    const sessions: Session[] = [];

    for (let i = 0; i < count; i++) {
      const session: Session = {
        id: `test_session_${this.generateId()}`,
        name: `Test Session ${i + 1}`,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
        messageCount: Math.floor(Math.random() * 100) + 5,
        model: this.randomChoice(models),
      };
      sessions.push(session);
    }

    fs.writeFileSync(
      path.join(this.dataDir, 'sessions', 'sessions.json'),
      JSON.stringify(sessions, null, 2)
    );

    return sessions;
  }

  async generateConversations(count: number): Promise<Conversation[]> {
    const conversations: Conversation[] = [];
    const samplePrompts = [
      'Explain quantum computing in simple terms',
      'Write a Python function to sort a list',
      'What are the best practices for React hooks?',
      'Help me debug this code',
      'Create a REST API design for an e-commerce platform',
      'What is the difference between TCP and UDP?',
      'Explain machine learning algorithms',
      'Write unit tests for this function',
      'How does garbage collection work in JavaScript?',
      'Design a database schema for a social media app',
    ];

    const sampleResponses = [
      'Let me explain this concept step by step...',
      'Here is the implementation you requested...',
      'Based on best practices, I recommend...',
      'I found the issue in your code...',
      'Here is a comprehensive design...',
    ];

    for (let i = 0; i < count; i++) {
      const sessionId = `test_session_${this.generateId()}`;
      const timestamp = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString();

      conversations.push({
        id: `test_conv_${this.generateId()}`,
        sessionId,
        role: 'user',
        content: this.randomChoice(samplePrompts),
        timestamp,
        tokens: Math.floor(Math.random() * 500) + 50,
      });

      conversations.push({
        id: `test_conv_${this.generateId()}`,
        sessionId,
        role: 'assistant',
        content: this.randomChoice(sampleResponses) + ' '.repeat(Math.floor(Math.random() * 500)),
        timestamp: new Date(new Date(timestamp).getTime() + 2000).toISOString(),
        model: 'claude-3-sonnet',
        tokens: Math.floor(Math.random() * 2000) + 200,
      });
    }

    fs.writeFileSync(
      path.join(this.dataDir, 'conversations', 'conversations.json'),
      JSON.stringify(conversations, null, 2)
    );

    return conversations;
  }

  async generateFiles(count: number): Promise<TestFile[]> {
    const files: TestFile[] = [];
    const fileTypes = [
      { ext: '.ts', type: 'typescript', content: 'export const test = "hello";\n' },
      { ext: '.py', type: 'python', content: 'def hello():\n    return "world"\n' },
      { ext: '.js', type: 'javascript', content: 'const x = 42;\nmodule.exports = x;\n' },
      { ext: '.json', type: 'json', content: '{"key": "value"}\n' },
      { ext: '.md', type: 'markdown', content: '# Test Document\n\nContent here.\n' },
      { ext: '.css', type: 'css', content: '.class { color: red; }\n' },
      { ext: '.html', type: 'html', content: '<div>Test</div>\n' },
    ];

    for (let i = 0; i < count; i++) {
      const fileType = this.randomChoice(fileTypes);
      const fileName = `test_file_${i}${fileType.ext}`;
      const content = fileType.content.repeat(Math.floor(Math.random() * 10) + 1);

      const file: TestFile = {
        path: `test_workspace/${fileName}`,
        content,
        type: fileType.type,
        size: content.length,
      };
      files.push(file);
    }

    fs.writeFileSync(
      path.join(this.dataDir, 'files', 'files.json'),
      JSON.stringify(files, null, 2)
    );

    return files;
  }

  async generateMemories(count: number): Promise<Memory[]> {
    const memories: Memory[] = [];
    const categories = ['conversation', 'code', 'document', 'research', 'personal'];
    const sources = ['telegram', 'discord', 'email', 'notes', 'browser', 'terminal'];

    const sampleContent = [
      'Discussed project architecture with the team',
      'Implemented new feature for user authentication',
      'Research notes on quantum computing applications',
      'Meeting summary: Q4 planning session',
      'Code review feedback for PR #423',
      'Debugging session notes for memory leak issue',
      'Learning resources for Rust programming',
      'Ideas for improving CI/CD pipeline',
      'Customer feedback analysis report',
      'Performance optimization strategies',
    ];

    for (let i = 0; i < count; i++) {
      const memory: Memory = {
        id: `test_memory_${this.generateId()}`,
        content: this.randomChoice(sampleContent) + ` - Entry ${i}`,
        embedding: Array.from({ length: 1536 }, () => Math.random() * 2 - 1),
        metadata: {
          source: this.randomChoice(sources),
          timestamp: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
          category: this.randomChoice(categories),
        },
      };
      memories.push(memory);
    }

    fs.writeFileSync(
      path.join(this.dataDir, 'memories', 'memories.json'),
      JSON.stringify(memories, null, 2)
    );

    return memories;
  }

  getSessions(): Session[] {
    const filePath = path.join(this.dataDir, 'sessions', 'sessions.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return [];
  }

  getConversations(): Conversation[] {
    const filePath = path.join(this.dataDir, 'conversations', 'conversations.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return [];
  }

  getFiles(): TestFile[] {
    const filePath = path.join(this.dataDir, 'files', 'files.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return [];
  }

  getMemories(): Memory[] {
    const filePath = path.join(this.dataDir, 'memories', 'memories.json');
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }
    return [];
  }
}
