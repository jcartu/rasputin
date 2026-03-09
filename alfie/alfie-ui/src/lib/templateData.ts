import type { SessionTemplate, TemplateCategory } from "@/lib/store";

const NOW = new Date().toISOString();

const CATEGORY_DEFINITIONS = [
  { id: "code", name: "Code" },
  { id: "writing", name: "Writing" },
  { id: "analysis", name: "Analysis" },
  { id: "creative", name: "Creative" },
  { id: "research", name: "Research" },
  { id: "productivity", name: "Productivity" },
];

const buildTemplate = (template: Omit<SessionTemplate, "isBuiltIn" | "usageCount" | "rating" | "createdAt" | "author" | "systemPrompt">): SessionTemplate => ({
  ...template,
  isBuiltIn: true,
  systemPrompt: "",
  usageCount: 0,
  rating: 5,
  createdAt: NOW,
  author: "ALFIE",
});

export const TEMPLATE_TEMPLATES: SessionTemplate[] = [
  buildTemplate({
    id: "code-python-script-generator",
    name: "Python Script Generator",
    description: "Generate a robust Python script with best practices.",
    category: "code",
    icon: "code-2",
    initialMessage:
      "Write a Python script that {describe task}. Include error handling, type hints, and docstrings.",
    tags: ["python", "automation", "scripting"],
    variables: [
      {
        name: "describe task",
        description: "What should the script do?",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "code-react-component",
    name: "React Component",
    description: "Create a typed React component with hooks and Tailwind.",
    category: "code",
    icon: "code-2",
    initialMessage:
      "Create a React component for {describe component}. Use TypeScript, hooks, and Tailwind CSS.",
    tags: ["react", "typescript", "tailwind"],
    variables: [
      {
        name: "describe component",
        description: "Describe the component's purpose and UI.",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "code-sql-query-builder",
    name: "SQL Query Builder",
    description: "Craft optimized SQL with index guidance and plan notes.",
    category: "code",
    icon: "code-2",
    initialMessage:
      "Write an optimized SQL query to {describe query}. Include indexes suggestions and explain the query plan.",
    tags: ["sql", "optimization", "database"],
    variables: [
      {
        name: "describe query",
        description: "What should the query achieve?",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "code-api-design",
    name: "API Design",
    description: "Design a REST API with schemas and auth guidance.",
    category: "code",
    icon: "code-2",
    initialMessage:
      "Design a REST API for {describe service}. Include endpoints, request/response schemas, and authentication.",
    tags: ["api", "rest", "backend"],
    variables: [
      {
        name: "describe service",
        description: "What service is this API for?",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "writing-technical-blog",
    name: "Technical Blog Post",
    description: "Write a structured technical post with examples.",
    category: "writing",
    icon: "pen-tool",
    initialMessage:
      "Write a technical blog post about {topic}. Include code examples, best practices, and common pitfalls.",
    tags: ["writing", "blog", "technical"],
    variables: [
      {
        name: "topic",
        description: "What topic should the post cover?",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "writing-documentation",
    name: "Documentation",
    description: "Produce clear documentation with usage details.",
    category: "writing",
    icon: "pen-tool",
    initialMessage:
      "Write comprehensive documentation for {describe code/API}. Include usage examples and edge cases.",
    tags: ["docs", "writing", "guides"],
    variables: [
      {
        name: "describe code/API",
        description: "What needs to be documented?",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "writing-email-draft",
    name: "Email Draft",
    description: "Draft a concise, professional email.",
    category: "writing",
    icon: "pen-tool",
    initialMessage:
      "Draft a professional email to {recipient} about {topic}. Keep it concise and actionable.",
    tags: ["email", "communication", "business"],
    variables: [
      {
        name: "recipient",
        description: "Who is the email to?",
        required: true,
        default: "",
      },
      {
        name: "topic",
        description: "What is the email about?",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "analysis-code-review",
    name: "Code Review",
    description: "Analyze code for bugs, performance, and best practices.",
    category: "analysis",
    icon: "bar-chart-3",
    initialMessage:
      "Review this code for bugs, performance issues, and best practices:\n\n{paste code}",
    tags: ["review", "analysis", "quality"],
    variables: [
      {
        name: "paste code",
        description: "Paste the code to review.",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "analysis-data-analysis",
    name: "Data Analysis",
    description: "Extract insights from data with clear summaries.",
    category: "analysis",
    icon: "bar-chart-3",
    initialMessage:
      "Analyze this dataset and provide insights:\n\n{paste data or describe data}",
    tags: ["data", "analysis", "insights"],
    variables: [
      {
        name: "paste data or describe data",
        description: "Provide the dataset or a summary of it.",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "analysis-architecture-review",
    name: "Architecture Review",
    description: "Assess architecture and suggest improvements.",
    category: "analysis",
    icon: "bar-chart-3",
    initialMessage:
      "Review this system architecture and suggest improvements:\n\n{describe architecture}",
    tags: ["architecture", "systems", "review"],
    variables: [
      {
        name: "describe architecture",
        description: "Describe the system architecture.",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "creative-landing-page",
    name: "Landing Page",
    description: "Design a landing page outline with key sections.",
    category: "creative",
    icon: "palette",
    initialMessage:
      "Design a landing page for {product/service}. Include hero section, features, testimonials, and CTA.",
    tags: ["design", "landing page", "marketing"],
    variables: [
      {
        name: "product/service",
        description: "What product or service is this for?",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "creative-brand-name-generator",
    name: "Brand Name Generator",
    description: "Generate creative brand names with domain ideas.",
    category: "creative",
    icon: "palette",
    initialMessage:
      "Generate 10 creative brand names for {describe business}. Include domain availability suggestions.",
    tags: ["branding", "naming", "creative"],
    variables: [
      {
        name: "describe business",
        description: "Describe the business or product.",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "creative-ui-ux-critique",
    name: "UI/UX Critique",
    description: "Critique a UI/UX and suggest improvements.",
    category: "creative",
    icon: "palette",
    initialMessage:
      "Critique the UI/UX of {describe app/website} and suggest 5 specific improvements.",
    tags: ["ux", "ui", "critique"],
    variables: [
      {
        name: "describe app/website",
        description: "What app or site should be reviewed?",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "research-technology-comparison",
    name: "Technology Comparison",
    description: "Compare two technologies for a specific use case.",
    category: "research",
    icon: "search",
    initialMessage:
      "Compare {tech A} vs {tech B} for {use case}. Include pros/cons, performance, ecosystem, and recommendations.",
    tags: ["research", "comparison", "technology"],
    variables: [
      {
        name: "tech A",
        description: "First technology to compare.",
        required: true,
        default: "",
      },
      {
        name: "tech B",
        description: "Second technology to compare.",
        required: true,
        default: "",
      },
      {
        name: "use case",
        description: "Describe the use case.",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "research-market-research",
    name: "Market Research",
    description: "Research a market with competitors and trends.",
    category: "research",
    icon: "search",
    initialMessage:
      "Research the market for {product/industry}. Include market size, competitors, trends, and opportunities.",
    tags: ["market", "research", "strategy"],
    variables: [
      {
        name: "product/industry",
        description: "What market or industry should be researched?",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "productivity-meeting-notes",
    name: "Meeting Notes",
    description: "Summarize notes and extract action items.",
    category: "productivity",
    icon: "zap",
    initialMessage:
      "Summarize these meeting notes and extract action items:\n\n{paste notes}",
    tags: ["meetings", "summary", "action items"],
    variables: [
      {
        name: "paste notes",
        description: "Paste the meeting notes.",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "productivity-project-plan",
    name: "Project Plan",
    description: "Create a structured project plan with risks.",
    category: "productivity",
    icon: "zap",
    initialMessage:
      "Create a project plan for {describe project}. Include milestones, timeline, risks, and resource allocation.",
    tags: ["planning", "project", "management"],
    variables: [
      {
        name: "describe project",
        description: "Describe the project scope.",
        required: true,
        default: "",
      },
    ],
  }),
  buildTemplate({
    id: "productivity-changelog",
    name: "Changelog",
    description: "Turn changes into a readable release note.",
    category: "productivity",
    icon: "zap",
    initialMessage:
      "Write a user-friendly changelog for these code changes:\n\n{paste diff or describe changes}",
    tags: ["release", "changelog", "documentation"],
    variables: [
      {
        name: "paste diff or describe changes",
        description: "Provide the diff or summarize the changes.",
        required: true,
        default: "",
      },
    ],
  }),
];

export const TEMPLATE_CATEGORIES: TemplateCategory[] = CATEGORY_DEFINITIONS.map(
  (category) => ({
    ...category,
    count: TEMPLATE_TEMPLATES.filter(
      (template) => template.category === category.id
    ).length,
  })
);
