import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEMPLATES_FILE = path.join(__dirname, '../../data/templates.json');

let templates = new Map();
let customTemplates = new Map();

const BUILT_IN_TEMPLATES = [
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Thorough code review with best practices analysis',
    category: 'development',
    icon: 'code',
    isBuiltIn: true,
    variables: [
      { name: 'FILE_PATH', description: 'Path to file(s) to review', required: true, default: '' },
      { name: 'FOCUS_AREAS', description: 'Specific areas to focus on', required: false, default: 'security, performance, readability' },
      { name: 'LANGUAGE', description: 'Programming language', required: false, default: 'auto-detect' }
    ],
    systemPrompt: `You are conducting a thorough code review. Focus on:
- Code quality and readability
- Potential bugs and edge cases
- Security vulnerabilities
- Performance optimizations
- Best practices for {{LANGUAGE}}

Review focus areas: {{FOCUS_AREAS}}`,
    initialMessage: 'Please review the code at {{FILE_PATH}}. Provide specific, actionable feedback with line references where applicable.',
    tags: ['code', 'review', 'quality'],
    usageCount: 0,
    rating: 4.8,
    createdAt: '2026-01-01T00:00:00.000Z',
    author: 'ALFIE Team'
  },
  {
    id: 'research',
    name: 'Research Assistant',
    description: 'Deep research on any topic with structured analysis',
    category: 'research',
    icon: 'search',
    isBuiltIn: true,
    variables: [
      { name: 'TOPIC', description: 'Research topic', required: true, default: '' },
      { name: 'DEPTH', description: 'Research depth (overview, detailed, exhaustive)', required: false, default: 'detailed' },
      { name: 'FORMAT', description: 'Output format preference', required: false, default: 'structured report' }
    ],
    systemPrompt: `You are a research assistant conducting {{DEPTH}} research. 
Provide well-sourced, accurate information with:
- Clear structure and organization
- Multiple perspectives when relevant
- Citations and references where possible
- Practical applications and insights

Output format: {{FORMAT}}`,
    initialMessage: 'Research the following topic: {{TOPIC}}',
    tags: ['research', 'analysis', 'learning'],
    usageCount: 0,
    rating: 4.7,
    createdAt: '2026-01-01T00:00:00.000Z',
    author: 'ALFIE Team'
  },
  {
    id: 'writing',
    name: 'Writing Assistant',
    description: 'Creative and professional writing help',
    category: 'writing',
    icon: 'pen-tool',
    isBuiltIn: true,
    variables: [
      { name: 'CONTENT_TYPE', description: 'Type of content (blog, email, documentation, story)', required: true, default: 'blog post' },
      { name: 'TONE', description: 'Writing tone', required: false, default: 'professional' },
      { name: 'AUDIENCE', description: 'Target audience', required: false, default: 'general' },
      { name: 'LENGTH', description: 'Approximate length', required: false, default: 'medium' }
    ],
    systemPrompt: `You are a skilled writing assistant. Create {{CONTENT_TYPE}} content with:
- {{TONE}} tone appropriate for {{AUDIENCE}}
- Clear, engaging prose
- Proper structure and flow
- Length: {{LENGTH}}

Focus on clarity, impact, and reader engagement.`,
    initialMessage: 'Help me write a {{CONTENT_TYPE}} about the following topic:',
    tags: ['writing', 'content', 'creative'],
    usageCount: 0,
    rating: 4.6,
    createdAt: '2026-01-01T00:00:00.000Z',
    author: 'ALFIE Team'
  },
  {
    id: 'brainstorming',
    name: 'Brainstorming Session',
    description: 'Creative ideation and problem-solving',
    category: 'creativity',
    icon: 'lightbulb',
    isBuiltIn: true,
    variables: [
      { name: 'CHALLENGE', description: 'Problem or challenge to brainstorm', required: true, default: '' },
      { name: 'CONSTRAINTS', description: 'Any constraints or limitations', required: false, default: 'none' },
      { name: 'IDEA_COUNT', description: 'Number of ideas to generate', required: false, default: '10' },
      { name: 'STYLE', description: 'Brainstorming style (wild, practical, mixed)', required: false, default: 'mixed' }
    ],
    systemPrompt: `You are facilitating a {{STYLE}} brainstorming session. 
Generate creative solutions considering:
- Constraints: {{CONSTRAINTS}}
- Target: {{IDEA_COUNT}} ideas
- Mix of conventional and unconventional approaches
- Build on and combine ideas
- No idea is too wild in the initial phase`,
    initialMessage: 'Let\'s brainstorm solutions for: {{CHALLENGE}}',
    tags: ['brainstorming', 'ideas', 'creativity', 'problem-solving'],
    usageCount: 0,
    rating: 4.5,
    createdAt: '2026-01-01T00:00:00.000Z',
    author: 'ALFIE Team'
  },
  {
    id: 'debug-session',
    name: 'Debug Session',
    description: 'Systematic debugging and troubleshooting',
    category: 'development',
    icon: 'bug',
    isBuiltIn: true,
    variables: [
      { name: 'ERROR_MESSAGE', description: 'Error message or symptom', required: true, default: '' },
      { name: 'CONTEXT', description: 'Code context or environment', required: false, default: '' },
      { name: 'ALREADY_TRIED', description: 'Solutions already attempted', required: false, default: 'none' },
      { name: 'STACK', description: 'Technology stack', required: false, default: 'auto-detect' }
    ],
    systemPrompt: `You are an expert debugger. Approach this systematically:
1. Understand the error and its context
2. Form hypotheses about root causes
3. Suggest diagnostic steps
4. Propose solutions from most to least likely
5. Consider edge cases and related issues

Stack: {{STACK}}
Already tried: {{ALREADY_TRIED}}`,
    initialMessage: 'Help me debug this issue: {{ERROR_MESSAGE}}\n\nContext: {{CONTEXT}}',
    tags: ['debug', 'troubleshoot', 'fix', 'error'],
    usageCount: 0,
    rating: 4.9,
    createdAt: '2026-01-01T00:00:00.000Z',
    author: 'ALFIE Team'
  },
  {
    id: 'architecture-review',
    name: 'Architecture Review',
    description: 'System architecture analysis and recommendations',
    category: 'development',
    icon: 'layout',
    isBuiltIn: true,
    variables: [
      { name: 'SYSTEM_DESC', description: 'System description or diagram', required: true, default: '' },
      { name: 'SCALE', description: 'Expected scale/load', required: false, default: 'medium' },
      { name: 'PRIORITIES', description: 'Key priorities (cost, performance, reliability)', required: false, default: 'balanced' }
    ],
    systemPrompt: `You are a senior architect reviewing system design. Analyze:
- Scalability for {{SCALE}} workloads
- Reliability and fault tolerance
- Security considerations
- Cost optimization
- Technical debt and maintainability

Priorities: {{PRIORITIES}}`,
    initialMessage: 'Review this architecture: {{SYSTEM_DESC}}',
    tags: ['architecture', 'design', 'system', 'scalability'],
    usageCount: 0,
    rating: 4.7,
    createdAt: '2026-01-01T00:00:00.000Z',
    author: 'ALFIE Team'
  },
  {
    id: 'learning-tutor',
    name: 'Learning Tutor',
    description: 'Personalized learning with adaptive explanations',
    category: 'learning',
    icon: 'graduation-cap',
    isBuiltIn: true,
    variables: [
      { name: 'TOPIC', description: 'Topic to learn', required: true, default: '' },
      { name: 'LEVEL', description: 'Current knowledge level (beginner, intermediate, advanced)', required: false, default: 'beginner' },
      { name: 'LEARNING_STYLE', description: 'Preferred learning style (visual, examples, theory)', required: false, default: 'examples' },
      { name: 'GOAL', description: 'Learning goal', required: false, default: 'understand fundamentals' }
    ],
    systemPrompt: `You are a patient, adaptive tutor. Teach {{TOPIC}} to a {{LEVEL}} learner.
- Use {{LEARNING_STYLE}} approach
- Build concepts progressively
- Check understanding frequently
- Provide practice exercises
- Celebrate progress

Goal: {{GOAL}}`,
    initialMessage: 'Teach me about {{TOPIC}}. Start with the fundamentals and progress based on my understanding.',
    tags: ['learning', 'education', 'tutor', 'teaching'],
    usageCount: 0,
    rating: 4.8,
    createdAt: '2026-01-01T00:00:00.000Z',
    author: 'ALFIE Team'
  },
  {
    id: 'api-design',
    name: 'API Design',
    description: 'RESTful and GraphQL API design assistance',
    category: 'development',
    icon: 'server',
    isBuiltIn: true,
    variables: [
      { name: 'RESOURCE', description: 'Resource or domain to design API for', required: true, default: '' },
      { name: 'STYLE', description: 'API style (REST, GraphQL, gRPC)', required: false, default: 'REST' },
      { name: 'AUTH', description: 'Authentication method', required: false, default: 'JWT' },
      { name: 'VERSIONING', description: 'Versioning strategy', required: false, default: 'URL path' }
    ],
    systemPrompt: `You are an API design expert. Design a {{STYLE}} API with:
- Clean, intuitive endpoints
- Proper HTTP methods and status codes
- Authentication: {{AUTH}}
- Versioning: {{VERSIONING}}
- Comprehensive error handling
- OpenAPI/Swagger documentation`,
    initialMessage: 'Design an API for: {{RESOURCE}}',
    tags: ['api', 'design', 'rest', 'graphql'],
    usageCount: 0,
    rating: 4.6,
    createdAt: '2026-01-01T00:00:00.000Z',
    author: 'ALFIE Team'
  }
];

async function initializeTemplates() {
  BUILT_IN_TEMPLATES.forEach(template => {
    templates.set(template.id, { ...template });
  });

  try {
    await fs.mkdir(path.dirname(TEMPLATES_FILE), { recursive: true });
    const data = await fs.readFile(TEMPLATES_FILE, 'utf-8');
    const saved = JSON.parse(data);
    saved.forEach(template => {
      customTemplates.set(template.id, template);
    });
    console.log(`Loaded ${customTemplates.size} custom templates`);
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('Error loading templates:', err.message);
    }
  }
}

async function saveCustomTemplates() {
  try {
    await fs.mkdir(path.dirname(TEMPLATES_FILE), { recursive: true });
    const data = JSON.stringify(Array.from(customTemplates.values()), null, 2);
    await fs.writeFile(TEMPLATES_FILE, data);
  } catch (err) {
    console.error('Error saving templates:', err.message);
    throw err;
  }
}

export function getAllTemplates() {
  const all = [...templates.values(), ...customTemplates.values()];
  return all.sort((a, b) => b.rating - a.rating);
}

export function getTemplatesByCategory(category) {
  return getAllTemplates().filter(t => t.category === category);
}

export function getTemplate(id) {
  return templates.get(id) || customTemplates.get(id) || null;
}

export function searchTemplates(query) {
  const q = query.toLowerCase();
  return getAllTemplates().filter(t =>
    t.name.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.tags.some(tag => tag.toLowerCase().includes(q))
  );
}

export async function createTemplate(templateData) {
  const id = uuidv4();
  const template = {
    id,
    ...templateData,
    isBuiltIn: false,
    usageCount: 0,
    rating: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  customTemplates.set(id, template);
  await saveCustomTemplates();
  return template;
}

export async function updateTemplate(id, updates) {
  const template = customTemplates.get(id);
  if (!template) {
    throw new Error('Template not found or is built-in');
  }
  
  const updated = {
    ...template,
    ...updates,
    id,
    isBuiltIn: false,
    updatedAt: new Date().toISOString()
  };
  
  customTemplates.set(id, updated);
  await saveCustomTemplates();
  return updated;
}

export async function deleteTemplate(id) {
  const template = customTemplates.get(id);
  if (!template) {
    throw new Error('Template not found or is built-in');
  }
  
  customTemplates.delete(id);
  await saveCustomTemplates();
  return { success: true };
}

export async function incrementUsage(id) {
  const template = templates.get(id) || customTemplates.get(id);
  if (template) {
    template.usageCount = (template.usageCount || 0) + 1;
    if (customTemplates.has(id)) {
      await saveCustomTemplates();
    }
  }
  return template;
}

export function applyVariables(template, variables) {
  let systemPrompt = template.systemPrompt;
  let initialMessage = template.initialMessage;
  
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    systemPrompt = systemPrompt.replace(regex, value || '');
    initialMessage = initialMessage.replace(regex, value || '');
  });
  
  if (template.variables) {
    for (const v of template.variables) {
      const regex = new RegExp(`\\{\\{${v.name}\\}\\}`, 'g');
      systemPrompt = systemPrompt.replace(regex, v.default || '');
      initialMessage = initialMessage.replace(regex, v.default || '');
    }
  }
  
  return {
    ...template,
    systemPrompt,
    initialMessage
  };
}

export function getCategories() {
  const categories = new Set();
  for (const t of getAllTemplates()) {
    categories.add(t.category);
  }
  return Array.from(categories).map(cat => ({
    id: cat,
    name: cat.charAt(0).toUpperCase() + cat.slice(1),
    count: getTemplatesByCategory(cat).length
  }));
}

export function getFeaturedTemplates(limit = 6) {
  return getAllTemplates()
    .sort((a, b) => (b.usageCount + b.rating * 10) - (a.usageCount + a.rating * 10))
    .slice(0, limit);
}

initializeTemplates().catch(console.error);

export default {
  getAllTemplates,
  getTemplatesByCategory,
  getTemplate,
  searchTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  incrementUsage,
  applyVariables,
  getCategories,
  getFeaturedTemplates
};
