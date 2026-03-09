# FullStack-Agent: Stolen Ideas & Implementation Guide

**Source:** https://github.com/mnluzimu/FullStack-Agent  
**Paper:** https://arxiv.org/abs/2602.03798  
**Date Analyzed:** 2026-02-11

## Executive Summary

FullStack-Agent is a sophisticated multi-agent system for generating complete full-stack web applications from natural language descriptions. The system combines three key innovations we can directly steal for ALFIE:

1. **Multi-Agent Pipeline Architecture** — Planning → Backend → Frontend with specialized debugging tools
2. **Development-Oriented Testing** — Backend API testing (Postman-like) + Frontend GUI testing (visual agent)
3. **Repository Back-Translation** — Converting existing codebases into agent training trajectories

**Key Metrics:**
- Achieves state-of-the-art on their FullStack-Bench benchmark
- Uses 2-round self-improvement SFT training on Qwen3-Coder-30B
- Debugging tools enable accurate error localization and fixing

---

## 1. Multi-Agent Architecture

### 1.1 Planning Agent

**What It Does:**
- Receives user instruction: "Build a stock trading dashboard"
- Generates a structured JSON plan containing:
  - Backend: entities, API endpoints (path, method, request/response schemas), business rules
  - Frontend: pages, routes, layouts, components, data flows, navigation links

**Prompt Pattern (Reusable):**

```python
def get_planning_prompt(instruction: str, is_pure_frontend: bool) -> str:
    return f"""You are a senior full-stack software architect.

GOAL  
Create a **Website Application Development Plan** for: "{instruction}"

HARD RULES  
1. Return exactly one JSON object with keys: "backendPlan", "frontendPlan"
2. Do NOT introduce features not mentioned in the concept
3. Every requestSchema/responseSchema must have "name" and "type" (string, number, boolean, object, array, enum, date, file)
   - Arrays: use form `array<type>` (e.g., `array<string>`)
   - Objects: describe structure as `object<{{fieldName:type,...}}>`
4. Use camelCase for all keys

STRUCTURE DETAILS  

backendPlan:
  - entities: array<{{name, briefDescription, mainFields:array<{{name,type}}> }}>
  - apiEndpoints: array<{{
        name, method, path, description,
        requestSchema: array<{{name,type}}>,
        responseSchema: array<{{name,type}}>,
        statusCodes: array<number>
    }}>
  - businessRules: array<string>
  - nonFunctional: array<string>

frontendPlan:
  - pages: array<{{
        name, route, description,
        layout: {{
            header: boolean,
            footer: boolean,
            sections: array<{{name, components:array<string>}}>
        }},
        dataFlows: array<{{
            endpointPath, action, optimisticUI:boolean, loadingStates, errorHandling
        }}>,
        navigationLinks: array<{{label, targetRoute, when}}>
    }}>
  - sharedComponents: array<{{name, purpose}}>
  - stateManagement: string
  - accessibilityAndUX: array<string>
"""
```

**Implementation for ALFIE:**
- Add a planning phase before code generation for complex features
- Generate structured specs that guide the implementation
- Use the JSON output to create issue templates or task breakdowns

### 1.2 Backend Agent

**What It Does:**
1. Implements all API endpoints from the plan
2. Sets up database schema with demo data
3. Uses `BackendTestTool` to validate each endpoint

**BackendTestTool Architecture:**

```python
class BackendTestTool:
    """
    Launches backend server in tmux, sends HTTP requests, 
    captures console output, returns compressed results
    """
    
    def execute(self, params: Dict) -> Dict:
        # 1. Kill anything on required ports
        for port in params['required_ports']:
            kill_service_on_port(port)
        
        # 2. Launch server in tmux session
        session = tmux_server.new_session(
            session_name=f"backend_test_{uuid.uuid4()}"
        )
        session.send_keys(f"cd {params['directory_path']}")
        session.send_keys(params['start_command'])
        
        # 3. Wait for server startup (poll ports)
        wait_for_port_open(params['required_ports'], timeout=180)
        
        # 4. Send HTTP request
        response = requests.request(
            method=params['method'],
            url=params['url'],
            json=params.get('data'),
            headers=params.get('headers')
        )
        
        # 5. Capture console output from tmux
        console_output = session.capture_pane()
        
        # 6. Compress output with LLM if too long
        if len(console_output) > 10000:
            console_output = llm_compress(console_output)
        
        # 7. Return structured result
        return {
            "status_code": response.status_code,
            "response_body": response.text,
            "console_output": console_output,
            "success": 200 <= response.status_code < 300
        }
```

**ALFIE Integration:**
- Build similar testing tools for backend endpoints
- Use tmux sessions to manage long-running services
- Capture and analyze console output for debugging
- Implement LLM-based log compression for huge outputs

### 1.3 Frontend Agent

**What It Does:**
1. Implements all pages and components from the plan
2. Uses `FrontendTestTool` to validate the UI via a GUI agent

**FrontendTestTool Architecture:**

```python
class FrontendTestTool:
    """
    Launches frontend dev server, drives it with a multimodal GUI agent
    to perform realistic browser-level tasks
    """
    
    def execute(self, params: Dict) -> Dict:
        # 1. Kill anything on required ports
        kill_service_on_port(params['required_ports'])
        
        # 2. Launch frontend dev server in tmux
        session = tmux_server.new_session(...)
        session.send_keys(f"npm run dev")
        
        # 3. Wait for server to be ready
        wait_for_port_open(params['required_ports'])
        
        # 4. Initialize WebAgent (Chromium + Vision Model)
        agent = WebAgentTester(
            base_url=f"http://localhost:{params['required_ports'][0]}",
            instruction=params['instruction'],  # e.g., "Click the login button, fill in credentials, verify dashboard loads"
            model=params.get('model', 'gpt-4-vision-preview')
        )
        
        # 5. Agent performs the task step-by-step
        result = agent.run_test()
        
        # 6. Return conversation + verdict + screenshots + errors
        return {
            "success": result['success'],
            "conversation": result['messages'],
            "console_errors": result['errorMessages'],
            "final_verdict": result['verdict']
        }
```

**ALFIE Integration:**
- Use multimodal LLMs (GPT-4V, Claude 3.5 Sonnet, Gemini) to visually test UIs
- Automate E2E testing by describing expected behavior
- Capture console errors and page states
- Integrate with Playwright or Puppeteer for browser automation

---

## 2. Debugging Tools (The Secret Sauce)

### 2.1 Backend Debugging Pattern

**Problem:** Backend errors are often hidden in logs or manifest as cryptic HTTP error codes

**Solution:** Specialized backend testing tool that:
1. Starts the server in a sandboxed tmux session
2. Sends carefully crafted requests
3. Captures **both** HTTP response **and** server console output
4. Compresses output using LLM to highlight errors

**Example Interaction:**

```
Agent: I need to test the POST /api/stocks endpoint

Tool: BackendTest
  directory_path: /workspace/project
  start_command: npm run dev
  required_ports: [3001]
  url: http://localhost:3001/api/stocks
  method: POST
  data: {"symbol": "AAPL", "quantity": 10}
  
Result:
  status_code: 500
  response_body: {"error": "Database connection failed"}
  console_output: """
    ERROR: relation "stocks" does not exist
    at Database.query (/project/db.js:42)
  """

Agent: *reads console output, identifies missing table*
Agent: Let me create the stocks table migration...
```

**Why This Is Genius:**
- Most agents only see HTTP status codes (opaque)
- Console logs reveal the **actual** error
- LLM compression keeps context window manageable

### 2.2 Frontend Debugging Pattern

**Problem:** Frontend bugs are visual — wrong layout, missing data, broken interactions

**Solution:** GUI agent that interacts with the site like a human tester:

```
Instruction: "Verify the stock dashboard displays a table with columns: Symbol, Price, Change"

Agent Steps:
1. Navigate to http://localhost:3000
2. [Screenshot] — sees a blank page
3. Check console: "Error: Failed to fetch /api/stocks"
4. Report: "Page loads but shows no data due to API fetch failure"

Human Agent Receives:
- Screenshot of blank page
- Console error pinpointing API issue
- Verdict: "FAILED - API not reachable"
```

**ALFIE Integration:**
- Use Claude 3.5 Sonnet (strong vision capabilities) as the GUI agent
- Take screenshots before/after each action
- Monitor browser console for errors
- Compare expected vs actual UI state

---

## 3. Repository Back-Translation (Training Data Pipeline)

### 3.1 The Concept

**Goal:** Convert existing high-quality GitHub repos into **agent trajectories** for SFT training

**Pipeline:**

```
GitHub Repo → Info Extraction → Trajectory Back-Translation → Augmentation → Training Data
```

### 3.2 Step-by-Step Process

#### Step 1: Repository Crawling

```python
def download_repos(framework: str, quality_threshold: int):
    """
    Crawl GitHub for high-quality repos
    - Filter by stars, issues, commit frequency
    - Download codebase
    """
    repos = github_search(
        query=f"language:typescript {framework}",
        stars=f">={quality_threshold}",
        sort="stars"
    )
    
    for repo in repos:
        git.clone(repo.url, local_path)
```

#### Step 2: Information Gathering Agent

**Prompt:**

```
Analyze this codebase and extract:
1. Project summary (title, description, tech stack)
2. Quality score (1-10) based on code organization, tests, documentation
3. Backend plan: entities, API endpoints
4. Frontend plan: pages, components, data flows
5. User instruction that would generate this codebase

Output JSON matching our planning schema.
```

#### Step 3: Trajectory Back-Translation

**The Magic:** Given the codebase, simulate what an agent would have done to build it

```python
def backtranslate_trajectory(repo_path: str, plan: dict):
    """
    Simulate agent building the repo step-by-step
    """
    trajectory_agent = TrajectoryAgent(
        summary=plan,
        template=choose_matching_template(repo_path),
        working_dir=empty_dir,
        log_dir=f"trajectories/{repo_name}"
    )
    
    # Iteratively implement features, matching the original repo
    while not matches_original(working_dir, repo_path):
        # Agent plans next step
        action = trajectory_agent.think()
        
        # Execute tool (write_file, edit_file, run_shell)
        result = trajectory_agent.execute(action)
        
        # Log (instruction, action, tool call, result)
        trajectory.append({
            "instruction": current_feature,
            "action": action,
            "tool_call": tool_call,
            "result": result
        })
```

**Output:** A sequence of (context, action, result) tuples that show **how** to build this type of application

#### Step 4: Repository Augmentation

**Expand diversity by modifying existing repos:**

```python
def augment_repo(original_repo: dict):
    """
    Generate variations of the same application
    """
    augmentation_ideas = llm_generate_augmentations(
        instruction=original_repo['userInstruction'],
        plan=original_repo['backendPlan'],
        examples=["Add user authentication", "Add search functionality", "Add real-time updates"]
    )
    
    for idea in augmentation_ideas:
        # Create new trajectory by modifying the original
        augmented_trajectory = apply_augmentation(
            base_trajectory=original_repo['trajectory'],
            augmentation=idea
        )
```

### 3.3 Training Data Format

**Final Output:**

```json
[
  {
    "instruction": "Build a stock trading dashboard with real-time updates",
    "plan": {...},
    "trajectory": [
      {"turn": 1, "action": "import_template", "result": "..."},
      {"turn": 2, "action": "write_file", "path": "src/api/stocks.ts", "content": "..."},
      {"turn": 3, "action": "backend_test", "url": "/api/stocks", "result": "..."},
      ...
    ],
    "final_summary": "All features implemented and tested successfully"
  }
]
```

### 3.4 Training Recipe

**2-Round SFT:**

1. **Round 1:** Train on back-translated trajectories from real repos (2K examples)
2. **Round 2:** Train on augmented trajectories + new synthetic data (10K examples)

**Key Insight:** Back-translation produces **realistic** trajectories that follow actual software patterns, not just synthetic "perfect" solutions

---

## 4. Practical Code Patterns to Steal

### 4.1 Template System

```python
TEMPLATES = {
    "templates": [
        {
            "name": "nextjs-nestjs-postgresql",
            "description": "Full-stack app with Next.js frontend, NestJS backend, PostgreSQL database",
            "path": "templates/nextjs-nestjs-postgresql",
            "backend_framework": "nestjs",
            "frontend_framework": "nextjs",
            "database": "postgresql"
        }
    ]
}

def choose_template(instruction: str) -> str:
    """Let LLM choose the best template"""
    prompt = f"""Choose the best template for: "{instruction}"
    
    Options:
    {format_templates(TEMPLATES)}
    
    Respond with JSON: {{"template_name": "...", "is_pure_frontend": true/false}}
    """
    response = llm(prompt)
    return parse_json(response)
```

### 4.2 Iterative Validation Loop

```python
def run_agent_with_validation(instruction: str, max_iterations: int = 50):
    """Main development loop"""
    
    # Phase 1: Planning
    plan = planning_agent.generate_plan(instruction)
    
    # Phase 2: Backend Implementation
    if not is_pure_frontend:
        for iteration in range(max_backend_iterations):
            action = backend_agent.think(plan, history)
            result = execute_action(action)
            history.append((action, result))
            
            if backend_is_complete(plan, history):
                break
    
    # Phase 3: Frontend Implementation
    for iteration in range(max_iterations):
        action = frontend_agent.think(plan, history)
        result = execute_action(action)
        history.append((action, result))
        
        if frontend_is_complete(plan, history):
            break
    
    # Phase 4: Comprehensive Validation
    validation_results = []
    
    # Validate backend
    if not is_pure_frontend:
        for endpoint in plan['backendPlan']['apiEndpoints']:
            result = backend_test(endpoint)
            validation_results.append(result)
    
    # Validate frontend
    for page in plan['frontendPlan']['pages']:
        result = frontend_test(page)
        validation_results.append(result)
    
    # Phase 5: Fix Issues
    for result in validation_results:
        if not result['success']:
            fix_action = agent.think_fix(result['error'])
            execute_action(fix_action)
```

### 4.3 Tool Registry Pattern

```python
class ToolRegistry:
    """Centralized tool management"""
    
    def __init__(self):
        self.tools = {}
    
    def register_tool(self, tool):
        self.tools[tool.name] = tool
    
    def execute_tool(self, tool_name: str, params: dict):
        tool = self.tools.get(tool_name)
        if not tool:
            return {"error": f"Unknown tool: {tool_name}"}
        
        # Validate parameters
        if hasattr(tool, 'validate_params'):
            error = tool.validate_params(params)
            if error:
                return {"error": error}
        
        # Execute
        try:
            return tool.execute(params)
        except Exception as e:
            return {"error": str(e)}
```

---

## 5. Implementation Roadmap for ALFIE

### Phase 1: Core Testing Tools (Week 1)
- [ ] Build BackendTestTool (tmux + HTTP + log capture)
- [ ] Build FrontendTestTool (Playwright + GPT-4V)
- [ ] Test on simple examples (REST API, React app)

### Phase 2: Planning System (Week 2)
- [ ] Implement structured planning prompt
- [ ] Generate backend/frontend specs
- [ ] Validate spec completeness

### Phase 3: Multi-Agent Pipeline (Week 2-3)
- [ ] Backend agent with tool use
- [ ] Frontend agent with tool use
- [ ] Iterative validation loop

### Phase 4: Back-Translation Pipeline (Week 4+)
- [ ] Crawl high-quality repos
- [ ] Extract repo metadata
- [ ] Generate synthetic trajectories
- [ ] Create training dataset

### Phase 5: Training (Ongoing)
- [ ] Round 1 SFT on back-translated data
- [ ] Round 2 SFT on augmented data
- [ ] Benchmark on internal tasks

---

## 6. Key Takeaways

### What Makes This Work:

1. **Specialized Debugging Tools** — Not just "run the code," but "run + capture + analyze"
2. **Structured Planning** — JSON specs guide implementation
3. **Realistic Training Data** — Back-translation from real repos beats synthetic data
4. **Multi-Phase Validation** — Backend first, then frontend, then comprehensive testing

### What to Avoid:

1. **Don't cram everything in context** — Use dynamic file navigation
2. **Don't skip testing** — Every feature must be validated
3. **Don't use generic templates** — Match template to project type
4. **Don't ignore console logs** — They're the best debugging signal

### Immediate Wins for ALFIE:

1. **Add tmux-based tool testing** — Capture real execution output
2. **Add GUI testing via multimodal LLM** — Validate visual behavior
3. **Structure task specs as JSON** — Clear, parseable plans
4. **Log compression** — LLM summarizes huge logs to stay within context

---

## 7. References

- **Paper:** https://arxiv.org/abs/2602.03798
- **Code:** https://github.com/mnluzimu/FullStack-Agent
- **Model:** https://huggingface.co/luzimu/FullStack-Learn-LM-30B-A3B

---

*Analysis completed: 2026-02-11*
