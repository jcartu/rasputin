# JARVIS MANUS Comprehensive Test Scenarios

## Test Execution Strategy

**Method**: Execute tests via the JARVIS Agent web interface at `https://rasputin.studio/agent`
**Verification**: Visual verification using JARVIS's vision system + Playwright screenshots
**Goal**: Exercise every feature, populate Qdrant memory, trigger self-improvement

---

## Tests 1-25: Core JARVIS Agent Capabilities

### Web Search & Research

1. **Basic Web Search**: "Search for the latest news about AI regulations in 2025"
2. **SearXNG Fallback**: "Search for 'quantum computing breakthroughs' using multiple search engines"
3. **Deep Research**: "Conduct deep research on the Belt and Road Initiative's impact on Central Asia, depth 3"
4. **Browse URL**: "Browse and summarize the content at https://news.ycombinator.com"
5. **Source Credibility**: "Research climate change solutions and rate source credibility"

### Code Execution

6. **Python Execution**: "Execute Python code to calculate the first 20 Fibonacci numbers"
7. **JavaScript Execution**: "Execute JavaScript to generate a random UUID and format current date"
8. **Shell Command**: "Run 'ls -la /tmp/jarvis-workspace' and show the output"
9. **Sandboxed Python**: "Execute a Python web scraper to fetch weather data (enable network)"
10. **Code with Error Handling**: "Execute Python code that intentionally raises an exception, verify error handling"

### File Operations

11. **Create File**: "Create a file at /workspace/test-report.md with a summary of your capabilities"
12. **Read File**: "Read the contents of /home/josh/rasputin/package.json and summarize it"
13. **List Directory**: "List all files in /home/josh/rasputin/server/services/"
14. **File Backup & Rollback**: "Create a file, modify it, then rollback to original"
15. **Verify File Creation**: "Create /workspace/verification-test.txt and verify it exists"

### Document Generation

16. **Create Word Document**: "Generate a DOCX report about JARVIS capabilities with headings and bullet points"
17. **Create PowerPoint**: "Create a 5-slide PPTX presentation about AI agent architecture"
18. **Create Excel**: "Generate an XLSX spreadsheet with sample sales data and formulas"
19. **Use Document Template**: "List available document templates and render a 'project_proposal' template"
20. **Generate Schema**: "Generate a database schema from: 'A blog system with users, posts, and comments'"

### AI Consensus & Synthesis

21. **Multi-Model Consensus**: "Query consensus: What are the most promising renewable energy technologies?"
22. **Synthesis Pipeline**: "Run synthesis on: 'The future of work in the age of AI'"
23. **Speed Tier Test**: "Query consensus with speed tier 'fast' on: 'Best practices for microservices'"
24. **Agreement Analysis**: "Run consensus query and analyze agreement percentage across models"
25. **Conflict Detection**: "Research a controversial topic and identify conflicting claims between sources"

---

## Tests 26-50: Memory, Self-Evolution & Introspection

### Memory Operations

26. **Store Memory**: "Store this interaction as an episodic memory with importance 0.8"
27. **Search Memory**: "Search your memory for anything related to 'web development'"
28. **Create Semantic Memory**: "Store a semantic fact: 'JARVIS was created by the Rasputin project'"
29. **Create Procedural Memory**: "Store a procedural memory for how to deploy a Next.js application"
30. **Memory Context Retrieval**: "Retrieve relevant context for the query: 'How do I use the portal scaffolder?'"
31. **Memory Stats**: "Show your memory statistics across all memory types"
32. **Learning Event**: "Create a learning event from our conversation about your capabilities"
33. **Memory Consolidation**: "Trigger warm memory consolidation"

### Self-Evolution - Code Introspection

34. **Initialize Self-Evolution**: "Initialize the self-evolution system"
35. **Index Codebase**: "Index your own codebase and report statistics"
36. **Search Own Code**: "Search your code for 'orchestrator'"
37. **Get Symbol Details**: "Get detailed information about the 'executeTool' function"
38. **Comprehensive Introspection**: "Run a comprehensive self-assessment"

### Self-Evolution - Capabilities & Skills

39. **What Can I Do**: "List all your capabilities organized by category"
40. **What Do I Know**: "Search your knowledge about 'portal scaffolding'"
41. **How Am I Doing**: "Generate a self-reflection report"
42. **Suggest Improvement**: "Suggest an improvement based on your current state"
43. **Detect Capability Gap**: "Analyze why you might fail at 'real-time video processing'"
44. **Propose New Skill**: "Propose a new skill for handling cryptocurrency data"
45. **Learn Skill**: "Learn a skill called 'data_visualization' for creating charts"
46. **List My Skills**: "List all your active learned skills"

### Self-Evolution - Code Modification

47. **Propose Code Change**: "Propose a code change to add logging to the orchestrator"
48. **View Modification History**: "Show your self-modification history"

### Self-Evolution - Dynamic Tool Generation

49. **Generate Tool**: "Generate a new tool that checks website SSL certificate expiration"
50. **List Dynamic Tools**: "List all dynamically generated tools"

---

## Tests 51-75: Infrastructure, SSH, Multi-Agent & Swarm

### SSH & Infrastructure

51. **List SSH Hosts**: "List all configured SSH hosts"
52. **SSH Execute Command**: "Execute 'uptime' on available SSH hosts"
53. **Infrastructure Status**: "Get infrastructure monitoring status"
54. **System Health Check**: "Run a system health check on connected infrastructure"

### Multi-Agent Operations

55. **Spawn Agent**: "Spawn a research agent to investigate 'GraphQL vs REST'"
56. **Agent Team**: "Form a team of agents: researcher, coder, reviewer for a task"
57. **List Active Agents**: "List all currently active agents"
58. **Agent Communication**: "Have two agents collaborate on writing a technical spec"

### Swarm Intelligence

59. **Initiate Negotiation**: "Initiate a swarm negotiation for task allocation"
60. **Form Agent Team**: "Form a specialized team using swarm intelligence for data analysis"
61. **Run Consensus**: "Run swarm consensus on the best approach for building a REST API"
62. **Stigmergy Markers**: "Create stigmergy markers for collaborative knowledge building"

### Predictive & Proactive

63. **Get Suggested Tasks**: "Get suggested tasks based on my usage patterns"
64. **Analyze Task Patterns**: "Analyze my task patterns from the last 7 days"
65. **Predict Next Tasks**: "Predict what tasks I might need next"
66. **Start Proactive Monitor**: "Start proactive monitoring with 5-minute intervals"
67. **Stop Proactive Monitor**: "Stop proactive monitoring"

### Event Handling

68. **Register Webhook**: "Register a webhook for task completion events"
69. **List Webhooks**: "List all registered webhooks"
70. **Schedule Cron Task**: "Schedule a daily cron task for system health checks"

### Desktop & Vision

71. **Desktop Daemon Status**: "Check desktop daemon connection status"
72. **List Desktop Tools**: "List available desktop automation tools"
73. **Vision Loop Config**: "Configure vision loop for screenshot analysis"

### MCP Integration

74. **List MCP Servers**: "List available MCP servers"
75. **List MCP Tools**: "List tools available from connected MCP servers"

---

## Tests 76-100: Full Silk Road Portal Build (16 Languages)

### Portal Configuration

76. **List Country Pairs**: "List available country pair configurations for portal scaffolding"
77. **Get Portal Config**: "Get the China-Russia portal configuration details"
78. **List Supported Locales**: "List all 16 supported locales for portal generation"
79. **View RSS Sources**: "Show available RSS sources by country"
80. **View GeoJSON Sources**: "Show available GeoJSON data sources"

### Silk Road Portal - Phase 1: Scaffolding

81. **Create Portal Project**: "Create a new bilateral business portal project for China-Russia at /workspace/silk-road-portal"
82. **Generate Base Config**: "Generate the complete portal scaffold configuration with all 16 locales"
83. **Verify Project Structure**: "Verify the generated project structure has all required directories"
84. **Check Package.json**: "Verify package.json has correct Next.js 14 dependencies"
85. **Check Tailwind Config**: "Verify Tailwind CSS configuration is properly set up"

### Silk Road Portal - Phase 2: Core Features

86. **Generate 3D Globe Component**: "Generate the 3D globe visualization component for the portal"
87. **Generate Investment Map**: "Generate the regional investment map component"
88. **Generate Laws Page**: "Generate the bilateral laws and regulations page"
89. **Generate Events Calendar**: "Generate the events and exhibitions calendar"
90. **Generate RSS Aggregator**: "Generate the RSS news aggregator component"

### Silk Road Portal - Phase 3: Localization

91. **Generate Chinese Locale**: "Generate full Chinese (zh) localization for the portal"
92. **Generate Russian Locale**: "Generate full Russian (ru) localization"
93. **Generate All Asian Locales**: "Generate Japanese, Korean, Vietnamese, Thai, Indonesian, Malay locales"
94. **Generate Middle Eastern Locales**: "Generate Arabic, Hindi, Turkish locales"
95. **Generate European Locales**: "Generate English, French, German, Spanish, Portuguese locales"

### Silk Road Portal - Phase 4: Integration & Testing

96. **Build Portal**: "Run build command for the Silk Road portal"
97. **Verify All Routes**: "Verify all locale routes are correctly generated"
98. **Check i18n Setup**: "Verify internationalization is properly configured for all 16 locales"
99. **Generate Deployment Config**: "Generate deployment configuration for the portal"

### Final Validation

100. **Full System Test**: "Run comprehensive self-introspection and report on:


    - Total memory entries created during tests
    - Skills learned
    - Tools generated
    - Capabilities discovered
    - Self-improvements made
    - Portal files generated
    - Overall system health"

---

## Execution Notes

### Prerequisites

- Login to https://rasputin.studio with josh / Thermite1950!$
- Ensure Redis is running for event bus
- Ensure Qdrant is accessible for vector storage
- Docker should be available for sandbox execution

### Test Execution Order

1. Execute tests 1-25 first to establish baseline capabilities
2. Tests 26-50 will build memory and self-knowledge
3. Tests 51-75 exercise distributed and infrastructure features
4. Tests 76-100 represent the ultimate integration test

### Success Criteria

- Each test should complete without errors
- Memory should be populated with learnings
- Self-evolution should track capability usage
- Portal should be fully scaffolded with 16 locales
- Final introspection should show comprehensive system state

### Vision Verification Points

After each test category, take screenshots to verify:

- UI responsiveness
- Task completion indicators
- Error states (if any)
- Memory growth
- Tool execution logs
