-- 100 Capability Test Tasks for JARVIS
-- User: josh@shuhari.tools (id = 1)
-- All tasks start in 'idle' status

-- ============================================================================
-- WEB SEARCH TASKS (1-10)
-- ============================================================================
INSERT INTO agentTasks (userId, title, query, status) VALUES
(225, 'Current Bitcoin Price', 'What is the current price of Bitcoin?', 'idle'),
(225, 'Latest Tech News', 'Search for the latest technology news from today', 'idle'),
(225, 'Weather in Tokyo', 'What is the current weather in Tokyo, Japan?', 'idle'),
(225, 'Python 3.13 Features', 'What are the new features in Python 3.13?', 'idle'),
(225, 'SpaceX Latest Launch', 'When was the last SpaceX rocket launch and what was the mission?', 'idle'),
(225, 'Compare React vs Vue', 'Search and compare React vs Vue.js frameworks in 2024', 'idle'),
(225, 'AI Research Papers', 'Find recent AI research papers about large language models', 'idle'),
(225, 'Stock Market Summary', 'Give me a summary of today stock market performance', 'idle'),
(225, 'Rust Programming Benefits', 'Search for why Rust is considered memory safe', 'idle'),
(225, 'Claude AI Capabilities', 'What are the latest capabilities of Claude AI by Anthropic?', 'idle');

-- ============================================================================
-- FILE OPERATIONS TASKS (11-20)
-- ============================================================================
INSERT INTO agentTasks (userId, title, query, status) VALUES
(225, 'List Workspace Files', 'List all files in /tmp/jarvis-workspace/', 'idle'),
(225, 'Create Test File', 'Create a file called test.txt in the workspace with the content "Hello JARVIS"', 'idle'),
(225, 'Read Package JSON', 'Read the package.json file from this project and summarize its dependencies', 'idle'),
(225, 'Write Python Script', 'Write a Python script that calculates fibonacci numbers and save it to the workspace', 'idle'),
(225, 'Create JSON Config', 'Create a JSON configuration file with database settings in the workspace', 'idle'),
(225, 'Analyze File Structure', 'Analyze the file structure of the server directory and describe it', 'idle'),
(225, 'Create Markdown Doc', 'Create a markdown documentation file explaining how to use JARVIS', 'idle'),
(225, 'Count Lines of Code', 'Count the total lines of TypeScript code in the server directory', 'idle'),
(225, 'Find Large Files', 'Find the 5 largest files in this project', 'idle'),
(225, 'Create Directory Tree', 'Create a text file showing the directory tree of client/src', 'idle');

-- ============================================================================
-- CODE EXECUTION TASKS (21-30)
-- ============================================================================
INSERT INTO agentTasks (userId, title, query, status) VALUES
(225, 'Run Simple Python', 'Execute Python code to print the first 10 prime numbers', 'idle'),
(225, 'Calculate Factorials', 'Write and run code to calculate factorials of 1 through 10', 'idle'),
(225, 'Generate UUID', 'Generate 5 random UUIDs using code', 'idle'),
(225, 'Parse JSON Data', 'Write code to parse and pretty-print a sample JSON object', 'idle'),
(225, 'Sort Algorithm', 'Implement and test a quicksort algorithm in Python', 'idle'),
(225, 'HTTP Request Test', 'Make an HTTP GET request to httpbin.org/get and show the response', 'idle'),
(225, 'Date Calculations', 'Calculate how many days until Christmas 2025', 'idle'),
(225, 'String Manipulation', 'Write code to reverse a string and check if its a palindrome', 'idle'),
(225, 'Math Operations', 'Calculate the square root of 144, cube of 7, and 2^10', 'idle'),
(225, 'Data Processing', 'Generate a list of 100 random numbers and find min, max, average', 'idle');

-- ============================================================================
-- DOCUMENT GENERATION TASKS (31-40)
-- ============================================================================
INSERT INTO agentTasks (userId, title, query, status) VALUES
(225, 'Create Word Doc', 'Create a Word document with a project proposal for a mobile app', 'idle'),
(225, 'Generate Excel Report', 'Create an Excel spreadsheet with sample sales data for Q1 2025', 'idle'),
(225, 'Make PowerPoint', 'Create a PowerPoint presentation about AI trends in 2025', 'idle'),
(225, 'Technical Spec Doc', 'Create a Word document with technical specifications for a REST API', 'idle'),
(225, 'Financial Report', 'Generate an Excel report with a simple budget breakdown', 'idle'),
(225, 'Training Slides', 'Create a PowerPoint with 5 slides about Python best practices', 'idle'),
(225, 'Meeting Notes Doc', 'Create a Word document template for meeting notes', 'idle'),
(225, 'Data Analysis Excel', 'Create an Excel file with sample data and basic formulas', 'idle'),
(225, 'Company Overview PPT', 'Create a short presentation about a fictional tech startup', 'idle'),
(225, 'Process Documentation', 'Create a Word document outlining a CI/CD deployment process', 'idle');

-- ============================================================================
-- RESEARCH & ANALYSIS TASKS (41-50)
-- ============================================================================
INSERT INTO agentTasks (userId, title, query, status) VALUES
(225, 'Analyze AGENTS.md', 'Analyze this projects AGENTS.md file and summarize its guidelines', 'idle'),
(225, 'Compare Databases', 'Research and compare PostgreSQL vs MySQL for a web application', 'idle'),
(225, 'Security Best Practices', 'Research current web application security best practices', 'idle'),
(225, 'Microservices Analysis', 'Analyze the pros and cons of microservices architecture', 'idle'),
(225, 'Performance Optimization', 'Research React performance optimization techniques', 'idle'),
(225, 'API Design Patterns', 'Research REST API design patterns and best practices', 'idle'),
(225, 'Container Orchestration', 'Compare Docker Swarm vs Kubernetes for container orchestration', 'idle'),
(225, 'Testing Strategies', 'Research modern testing strategies for web applications', 'idle'),
(225, 'State Management', 'Analyze different state management solutions for React', 'idle'),
(225, 'TypeScript Benefits', 'Research and summarize the benefits of using TypeScript', 'idle');

-- ============================================================================
-- MEMORY OPERATIONS TASKS (51-60)
-- ============================================================================
INSERT INTO agentTasks (userId, title, query, status) VALUES
(225, 'Store Learning', 'Remember that Josh prefers dark mode in all applications', 'idle'),
(225, 'Recall Preferences', 'What preferences have you learned about me?', 'idle'),
(225, 'Store Project Info', 'Remember that RASPUTIN is a multi-model AI consensus engine', 'idle'),
(225, 'Store Procedure', 'Remember this procedure: When deploying, always run tests first then build', 'idle'),
(225, 'Recall Previous Work', 'What tasks have you completed for me recently?', 'idle'),
(225, 'Store API Endpoint', 'Remember that the production API is at api.rasputin.studio', 'idle'),
(225, 'Store Error Fix', 'Remember that TRPCClientError can be fixed by checking auth tokens', 'idle'),
(225, 'Recall Learnings', 'What have you learned about this codebase?', 'idle'),
(225, 'Store Best Practice', 'Remember: Always use Zod for input validation in tRPC', 'idle'),
(225, 'Context Retrieval', 'Based on your memory, what do you know about this project?', 'idle');

-- ============================================================================
-- SSH/INFRASTRUCTURE TASKS (61-70)
-- ============================================================================
INSERT INTO agentTasks (userId, title, query, status) VALUES
(225, 'Check Disk Space', 'Check the disk space usage on the local system', 'idle'),
(225, 'List Processes', 'List the top 10 processes by memory usage', 'idle'),
(225, 'System Uptime', 'What is the system uptime?', 'idle'),
(225, 'Check Docker Status', 'List all running Docker containers', 'idle'),
(225, 'Network Connections', 'Show active network connections on port 3000', 'idle'),
(225, 'Check Node Version', 'What version of Node.js is installed?', 'idle'),
(225, 'Git Status', 'Show the git status of this repository', 'idle'),
(225, 'Environment Variables', 'List the current PATH environment variable', 'idle'),
(225, 'Check pnpm Version', 'What version of pnpm is installed?', 'idle'),
(225, 'CPU Information', 'Show information about the CPU on this system', 'idle');

-- ============================================================================
-- MULTI-STEP COMPLEX TASKS (71-80)
-- ============================================================================
INSERT INTO agentTasks (userId, title, query, status) VALUES
(225, 'Full Code Review', 'Review the orchestrator.ts file, identify issues, and suggest improvements', 'idle'),
(225, 'Research and Summarize', 'Research GraphQL, write a summary, and create a comparison document with REST', 'idle'),
(225, 'Build and Test', 'Check if the project builds successfully and report any errors', 'idle'),
(225, 'Analyze and Document', 'Analyze the tRPC router structure and create documentation for it', 'idle'),
(225, 'Search and Compile', 'Find all TODO comments in the codebase and compile them into a list', 'idle'),
(225, 'Create Complete Report', 'Create a complete project status report including git history and file counts', 'idle'),
(225, 'Multi-Source Research', 'Research Node.js 22 features from multiple sources and summarize', 'idle'),
(225, 'Code Analysis Pipeline', 'Analyze the db.ts file, find inefficiencies, and propose optimizations', 'idle'),
(225, 'Documentation Generation', 'Generate API documentation for the jarvis router endpoints', 'idle'),
(225, 'Security Audit', 'Perform a basic security audit of the authentication code', 'idle');

-- ============================================================================
-- DEEP RESEARCH TASKS (81-90)
-- ============================================================================
INSERT INTO agentTasks (userId, title, query, status) VALUES
(225, 'Deep Dive: WebSockets', 'Conduct deep research on WebSocket implementations in Node.js', 'idle'),
(225, 'Deep Dive: LLM Optimization', 'Research techniques for optimizing LLM inference speed', 'idle'),
(225, 'Deep Dive: Vector DBs', 'Deep research on vector databases comparing Qdrant, Pinecone, and Weaviate', 'idle'),
(225, 'Deep Dive: Edge Computing', 'Research edge computing patterns for AI inference', 'idle'),
(225, 'Deep Dive: RAG Patterns', 'Research Retrieval Augmented Generation implementation patterns', 'idle'),
(225, 'Deep Dive: Agent Patterns', 'Research autonomous AI agent design patterns', 'idle'),
(225, 'Deep Dive: Streaming', 'Research server-sent events vs WebSockets for AI streaming', 'idle'),
(225, 'Deep Dive: Caching', 'Research caching strategies for LLM responses', 'idle'),
(225, 'Deep Dive: Rate Limiting', 'Research rate limiting patterns for AI API services', 'idle'),
(225, 'Deep Dive: Observability', 'Research observability patterns for AI applications', 'idle');

-- ============================================================================
-- EDGE CASES & MISC TASKS (91-100)
-- ============================================================================
INSERT INTO agentTasks (userId, title, query, status) VALUES
(225, 'Simple Math', '2 + 2 = ?', 'idle'),
(225, 'Echo Test', 'Just say hello back to me', 'idle'),
(225, 'Time Query', 'What time is it?', 'idle'),
(225, 'Empty Workspace Check', 'Is the workspace empty? If so, what can you create there?', 'idle'),
(225, 'Self Description', 'Describe your capabilities in one paragraph', 'idle'),
(225, 'Error Handling Test', 'Try to read a file that does not exist: /nonexistent/file.txt', 'idle'),
(225, 'Unicode Test', 'Create a file with emoji content: Hello 🤖 JARVIS 🚀', 'idle'),
(225, 'Long Output Test', 'Generate a long response with 500 words about artificial intelligence', 'idle'),
(225, 'Multi-Language Code', 'Show hello world in Python, JavaScript, Rust, and Go', 'idle'),
(225, 'Final Integration Test', 'Search the web for JARVIS AI, summarize findings, and save to a file', 'idle');
