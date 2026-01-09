/**
 * JARVIS Orchestrator - The Brain
 * Uses direct API connections (Anthropic, Cerebras, Gemini, Grok) for autonomous task execution
 */

// Get API keys from environment - Direct connections, no OpenRouter middleman
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const XAI_API_KEY = process.env.XAI_API_KEY || "";

// Inference provider type
type InferenceProvider = "anthropic" | "cerebras" | "gemini" | "grok";

// Current provider (can be changed at runtime)
let currentProvider: InferenceProvider = "anthropic";

// OpenRouter API types
interface OpenRouterMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string | OpenRouterContentBlock[];
  tool_calls?: OpenRouterToolCall[];
  tool_call_id?: string;
}

interface OpenRouterContentBlock {
  type: "text" | "tool_use";
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
}

interface OpenRouterToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

interface OpenRouterTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: {
      type: "object";
      properties: Record<string, unknown>;
      required?: string[];
    };
  };
}

interface OpenRouterResponse {
  id: string;
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: OpenRouterToolCall[];
    };
    finish_reason: string;
  }>;
}

// Tool definitions for OpenRouter (OpenAI-compatible format)
const JARVIS_TOOLS: OpenRouterTool[] = [
  {
    type: "function",
    function: {
      name: "web_search",
      description:
        "Search the web for current information using Perplexity. Use this to find up-to-date information, news, facts, or research topics.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find information about",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "searxng_search",
      description:
        "Search the web using SearXNG - a free, unlimited, privacy-focused meta-search engine that aggregates results from Google, Bing, DuckDuckGo, Wikipedia, GitHub, StackOverflow, and more. Use this for bulk searches or when you need diverse results from multiple sources. No API limits.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to find information about",
          },
          engines: {
            type: "string",
            description:
              "Optional: Comma-separated list of engines to use (e.g., 'google,bing,duckduckgo'). Leave empty for all engines.",
          },
          categories: {
            type: "string",
            description:
              "Optional: Search category (general, images, news, science, files, it, social media)",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browse_url",
      description:
        "Visit a specific URL and extract its content. Use this to read articles, documentation, or any web page.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to visit and extract content from",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_python",
      description:
        "Execute Python code in a sandboxed environment. Use for calculations, data processing, file operations, or any Python task.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "The Python code to execute",
          },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_javascript",
      description:
        "Execute JavaScript/Node.js code in a sandboxed environment. Use for JS-specific tasks or npm package usage.",
      parameters: {
        type: "object",
        properties: {
          code: {
            type: "string",
            description: "The JavaScript code to execute",
          },
        },
        required: ["code"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "execute_shell",
      description:
        "Execute shell commands in a sandboxed Linux environment. Use for system operations, file management, or running CLI tools.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The shell command to execute",
          },
        },
        required: ["command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read the contents of a file from the sandboxed filesystem.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path to the file to read",
          },
        },
        required: ["path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "write_file",
      description:
        "Write content to a file in the sandboxed filesystem. Creates the file if it doesn't exist.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path where to write the file",
          },
          content: {
            type: "string",
            description: "The content to write to the file",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_files",
      description: "List files and directories in a given path.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description:
              "The directory path to list (default: current directory)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "calculate",
      description:
        "Perform mathematical calculations. Use for precise arithmetic, scientific calculations, or complex math.",
      parameters: {
        type: "object",
        properties: {
          expression: {
            type: "string",
            description:
              "The mathematical expression to evaluate (e.g., '2 + 2 * 3', 'sqrt(16)', 'sin(pi/2)')",
          },
        },
        required: ["expression"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "http_request",
      description:
        "Make HTTP requests to APIs or web services. Use for API calls, data fetching, or web interactions.",
      parameters: {
        type: "object",
        properties: {
          method: {
            type: "string",
            enum: ["GET", "POST", "PUT", "DELETE", "PATCH"],
            description: "The HTTP method to use",
          },
          url: {
            type: "string",
            description: "The URL to send the request to",
          },
          headers: {
            type: "object",
            description: "Optional headers to include in the request",
          },
          body: {
            type: "string",
            description: "Optional request body (for POST, PUT, PATCH)",
          },
        },
        required: ["method", "url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_image",
      description:
        "Generate an image using AI based on a text description. Use for creating illustrations, diagrams, or any visual content.",
      parameters: {
        type: "object",
        properties: {
          prompt: {
            type: "string",
            description:
              "A detailed description of the image to generate. Be specific about style, composition, colors, and details.",
          },
        },
        required: ["prompt"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ssh_execute",
      description:
        "Execute a command on a remote server via SSH. Use this to run commands on registered SSH hosts.",
      parameters: {
        type: "object",
        properties: {
          hostName: {
            type: "string",
            description:
              "The name of the registered SSH host to connect to (e.g., 'rasputin', 'production-server')",
          },
          command: {
            type: "string",
            description: "The shell command to execute on the remote server",
          },
        },
        required: ["hostName", "command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ssh_read_file",
      description:
        "Read a file from a remote server via SSH. Use this to view file contents on registered SSH hosts.",
      parameters: {
        type: "object",
        properties: {
          hostName: {
            type: "string",
            description: "The name of the registered SSH host",
          },
          path: {
            type: "string",
            description: "The absolute path to the file on the remote server",
          },
        },
        required: ["hostName", "path"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ssh_write_file",
      description:
        "Write content to a file on a remote server via SSH. Use this to create or update files on registered SSH hosts.",
      parameters: {
        type: "object",
        properties: {
          hostName: {
            type: "string",
            description: "The name of the registered SSH host",
          },
          path: {
            type: "string",
            description:
              "The absolute path where to write the file on the remote server",
          },
          content: {
            type: "string",
            description: "The content to write to the file",
          },
        },
        required: ["hostName", "path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "ssh_list_files",
      description:
        "List files in a directory on a remote server via SSH. Use this to explore file systems on registered SSH hosts.",
      parameters: {
        type: "object",
        properties: {
          hostName: {
            type: "string",
            description: "The name of the registered SSH host",
          },
          path: {
            type: "string",
            description:
              "The directory path to list on the remote server (default: home directory)",
          },
        },
        required: ["hostName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tmux_start",
      description:
        "Start a long-running process in a background tmux session. Use for dev servers, build watchers, or any process that needs to keep running.",
      parameters: {
        type: "object",
        properties: {
          sessionName: {
            type: "string",
            description:
              "Name for the tmux session (e.g., 'devserver', 'build')",
          },
          command: {
            type: "string",
            description:
              "The command to run (e.g., 'npm run dev', 'pnpm build --watch')",
          },
        },
        required: ["sessionName", "command"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tmux_output",
      description:
        "Get the recent output from a running tmux session. Use to check status of background processes.",
      parameters: {
        type: "object",
        properties: {
          sessionName: {
            type: "string",
            description: "Name of the tmux session to check",
          },
          lines: {
            type: "number",
            description: "Number of lines to retrieve (default: 100)",
          },
        },
        required: ["sessionName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tmux_stop",
      description: "Stop a running tmux session.",
      parameters: {
        type: "object",
        properties: {
          sessionName: {
            type: "string",
            description: "Name of the tmux session to stop",
          },
        },
        required: ["sessionName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tmux_list",
      description: "List all running JARVIS tmux sessions.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tmux_send",
      description:
        "Send input/commands to a running tmux session. Use for interactive processes.",
      parameters: {
        type: "object",
        properties: {
          sessionName: {
            type: "string",
            description: "Name of the tmux session",
          },
          input: {
            type: "string",
            description: "Input to send to the session",
          },
        },
        required: ["sessionName", "input"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "screenshot",
      description:
        "Take a screenshot of a web page. Useful for verifying frontend changes, capturing visual state, or debugging UI issues.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description:
              "The URL to screenshot (e.g., 'http://localhost:5173' for dev server)",
          },
          fullPage: {
            type: "boolean",
            description:
              "Whether to capture the full scrollable page (default: false)",
          },
          waitFor: {
            type: "number",
            description:
              "Milliseconds to wait after page load before taking screenshot",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "playwright_browse",
      description:
        "Browse a web page using a real browser (Playwright). Better than simple fetch for JavaScript-rendered content.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL to browse",
          },
          waitFor: {
            type: "string",
            description: "CSS selector to wait for before extracting content",
          },
          timeout: {
            type: "number",
            description: "Timeout in milliseconds (default: 30000)",
          },
        },
        required: ["url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_session_start",
      description:
        "Start a persistent browser session for interactive testing. Enables clicking, typing, navigating, and captures console/network errors. Use for end-to-end UI testing.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "Unique identifier for this browser session",
          },
          url: {
            type: "string",
            description: "The initial URL to navigate to",
          },
        },
        required: ["sessionId", "url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_click",
      description: "Click an element in the browser session.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "The browser session ID",
          },
          selector: {
            type: "string",
            description: "CSS selector of element to click",
          },
        },
        required: ["sessionId", "selector"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_fill",
      description: "Fill a text input in the browser session.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "The browser session ID",
          },
          selector: {
            type: "string",
            description: "CSS selector of input element",
          },
          value: {
            type: "string",
            description: "Text to fill in the input",
          },
        },
        required: ["sessionId", "selector", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_select",
      description: "Select an option from a dropdown in the browser session.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "The browser session ID",
          },
          selector: {
            type: "string",
            description: "CSS selector of select element",
          },
          value: {
            type: "string",
            description: "Value to select",
          },
        },
        required: ["sessionId", "selector", "value"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_navigate",
      description: "Navigate to a different URL in the browser session.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "The browser session ID",
          },
          url: {
            type: "string",
            description: "URL to navigate to",
          },
        },
        required: ["sessionId", "url"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_screenshot",
      description: "Take a screenshot in the browser session.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "The browser session ID",
          },
          fullPage: {
            type: "boolean",
            description: "Capture full scrollable page (default: false)",
          },
          name: {
            type: "string",
            description: "Custom filename for the screenshot",
          },
        },
        required: ["sessionId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_get_content",
      description:
        "Get the text content of the current page in the browser session.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "The browser session ID",
          },
        },
        required: ["sessionId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_get_logs",
      description:
        "Get console messages and network errors captured during the browser session. Essential for debugging runtime issues.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "The browser session ID",
          },
        },
        required: ["sessionId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_wait_for",
      description:
        "Wait for an element to appear/disappear in the browser session.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "The browser session ID",
          },
          selector: {
            type: "string",
            description: "CSS selector to wait for",
          },
          timeout: {
            type: "number",
            description: "Timeout in milliseconds (default: 10000)",
          },
          state: {
            type: "string",
            enum: ["visible", "hidden", "attached"],
            description: "State to wait for (default: visible)",
          },
        },
        required: ["sessionId", "selector"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_get_elements",
      description:
        "Query elements matching a selector and get their attributes. Useful for finding buttons, links, inputs.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "The browser session ID",
          },
          selector: {
            type: "string",
            description: "CSS selector to query",
          },
        },
        required: ["sessionId", "selector"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "browser_session_end",
      description: "End a browser session and get a summary of captured logs.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "The browser session ID to end",
          },
        },
        required: ["sessionId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_build",
      description:
        "Run the build command for a project and get structured results. Parses TypeScript and ESLint errors automatically.",
      parameters: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description: "Path to the project directory",
          },
          command: {
            type: "string",
            description: "Custom build command (default: pnpm build)",
          },
        },
        required: ["projectPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_tests",
      description:
        "Run tests for a project and get structured results. Parses test results automatically.",
      parameters: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description: "Path to the project directory",
          },
          pattern: {
            type: "string",
            description: "Test file pattern to run (e.g., '*.test.ts')",
          },
          command: {
            type: "string",
            description: "Custom test command (default: pnpm test)",
          },
        },
        required: ["projectPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_type_check",
      description:
        "Run TypeScript type checking and get structured error list.",
      parameters: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description: "Path to the project directory",
          },
        },
        required: ["projectPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "run_lint",
      description: "Run ESLint and get structured error list.",
      parameters: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description: "Path to the project directory",
          },
        },
        required: ["projectPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_dev_server",
      description:
        "Start the development server in a background tmux session. Automatically checks if server is ready.",
      parameters: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description: "Path to the project directory",
          },
          port: {
            type: "number",
            description: "Port to run on (default: 5173)",
          },
          command: {
            type: "string",
            description: "Custom dev command (default: pnpm dev)",
          },
        },
        required: ["projectPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "check_dev_server",
      description: "Check if the dev server is running and responding.",
      parameters: {
        type: "object",
        properties: {
          port: {
            type: "number",
            description: "Port to check (default: 5173)",
          },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "save_baseline_screenshot",
      description:
        "Save the current browser view as a baseline screenshot for regression testing.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "The browser session ID",
          },
          name: {
            type: "string",
            description:
              "Name for the baseline (e.g., 'homepage', 'login-form')",
          },
        },
        required: ["sessionId", "name"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "compare_screenshot",
      description:
        "Compare the current browser view against a saved baseline screenshot.",
      parameters: {
        type: "object",
        properties: {
          sessionId: {
            type: "string",
            description: "The browser session ID",
          },
          baselineName: {
            type: "string",
            description: "Name of the baseline to compare against",
          },
        },
        required: ["sessionId", "baselineName"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_baselines",
      description: "List all saved baseline screenshots.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_status",
      description:
        "Get git status showing staged, unstaged, and untracked files.",
      parameters: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description: "Path to the git repository",
          },
        },
        required: ["projectPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_diff",
      description: "Show git diff of changes.",
      parameters: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description: "Path to the git repository",
          },
          staged: {
            type: "boolean",
            description: "Show staged changes only",
          },
          file: {
            type: "string",
            description: "Show diff for specific file only",
          },
        },
        required: ["projectPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_branch",
      description: "List, create, checkout, or delete git branches.",
      parameters: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description: "Path to the git repository",
          },
          create: {
            type: "string",
            description: "Create and checkout new branch with this name",
          },
          checkout: {
            type: "string",
            description: "Checkout existing branch",
          },
          delete: {
            type: "string",
            description: "Delete branch with this name",
          },
        },
        required: ["projectPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_commit",
      description: "Create a git commit.",
      parameters: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description: "Path to the git repository",
          },
          message: {
            type: "string",
            description: "Commit message",
          },
          addAll: {
            type: "boolean",
            description: "Stage all changes before committing",
          },
          files: {
            type: "array",
            items: { type: "string" },
            description: "Specific files to stage before committing",
          },
        },
        required: ["projectPath", "message"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_log",
      description: "Show recent git commits.",
      parameters: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description: "Path to the git repository",
          },
          count: {
            type: "number",
            description: "Number of commits to show (default: 10)",
          },
          oneline: {
            type: "boolean",
            description: "Show compact one-line format",
          },
        },
        required: ["projectPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_push",
      description: "Push commits to remote repository.",
      parameters: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description: "Path to the git repository",
          },
          setUpstream: {
            type: "string",
            description: "Set upstream branch (for new branches)",
          },
          force: {
            type: "boolean",
            description: "Force push with lease (safe force push)",
          },
        },
        required: ["projectPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_pull",
      description: "Pull latest changes from remote.",
      parameters: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description: "Path to the git repository",
          },
        },
        required: ["projectPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "git_stash",
      description: "Stash or restore uncommitted changes.",
      parameters: {
        type: "object",
        properties: {
          projectPath: {
            type: "string",
            description: "Path to the git repository",
          },
          pop: {
            type: "boolean",
            description: "Pop most recent stash",
          },
          list: {
            type: "boolean",
            description: "List all stashes",
          },
          message: {
            type: "string",
            description: "Message for new stash",
          },
        },
        required: ["projectPath"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "preview_file_edit",
      description:
        "Preview changes to a file before applying them. Shows a diff and creates a backup. Use this for large or complex file edits to verify changes first.",
      parameters: {
        type: "object",
        properties: {
          path: {
            type: "string",
            description: "The path to the file to edit",
          },
          content: {
            type: "string",
            description: "The new content for the file",
          },
        },
        required: ["path", "content"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "apply_file_edit",
      description:
        "Apply a previously previewed file edit. Use the backup_id from preview_file_edit.",
      parameters: {
        type: "object",
        properties: {
          backupId: {
            type: "string",
            description: "The backup ID from the preview",
          },
        },
        required: ["backupId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "rollback_file_edit",
      description:
        "Rollback a file to its state before an edit was applied. Use if changes caused problems.",
      parameters: {
        type: "object",
        properties: {
          backupId: {
            type: "string",
            description: "The backup ID of the edit to rollback",
          },
        },
        required: ["backupId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "discard_file_edit",
      description: "Discard a previewed file edit without applying it.",
      parameters: {
        type: "object",
        properties: {
          backupId: {
            type: "string",
            description: "The backup ID of the edit to discard",
          },
        },
        required: ["backupId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_pending_edits",
      description:
        "List all pending file edits that have been previewed but not yet applied or discarded.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "start_debug_session",
      description:
        "Start a structured debugging session with a hypothesis about the bug. Use this when debugging complex issues to track attempts and state.",
      parameters: {
        type: "object",
        properties: {
          hypothesis: {
            type: "string",
            description:
              "Your initial hypothesis about what might be causing the bug",
          },
        },
        required: ["hypothesis"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "debug_snapshot",
      description:
        "Capture the current state during debugging. Use at key points to track progress.",
      parameters: {
        type: "object",
        properties: {
          label: {
            type: "string",
            description: "A descriptive label for this snapshot",
          },
          state: {
            type: "object",
            description:
              "Key-value pairs of relevant state (variables, config values, etc.)",
          },
        },
        required: ["label", "state"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "debug_log_output",
      description:
        "Log command/execution output to the current debug snapshot.",
      parameters: {
        type: "object",
        properties: {
          output: {
            type: "string",
            description: "The output to log",
          },
        },
        required: ["output"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "debug_log_error",
      description: "Log an error to the current debug snapshot.",
      parameters: {
        type: "object",
        properties: {
          error: {
            type: "string",
            description: "The error message to log",
          },
        },
        required: ["error"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "debug_attempt",
      description:
        "Log a fix attempt and its result. After 3 failures, you'll be prompted to reconsider the approach.",
      parameters: {
        type: "object",
        properties: {
          description: {
            type: "string",
            description: "What you tried to do",
          },
          result: {
            type: "string",
            enum: ["success", "failure"],
            description: "Whether the attempt succeeded or failed",
          },
          error: {
            type: "string",
            description: "Error message if the attempt failed",
          },
        },
        required: ["description", "result"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "debug_summary",
      description:
        "Get a summary of the current debug session including all attempts and snapshots.",
      parameters: {
        type: "object",
        properties: {},
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "end_debug_session",
      description:
        "End the current debug session with a conclusion about what was found/fixed.",
      parameters: {
        type: "object",
        properties: {
          conclusion: {
            type: "string",
            description:
              "Summary of what was discovered and whether the issue was resolved",
          },
        },
        required: ["conclusion"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_debug_snapshot",
      description: "Retrieve details of a specific debug snapshot by ID.",
      parameters: {
        type: "object",
        properties: {
          snapshotId: {
            type: "string",
            description: "The snapshot ID (e.g., 'snap_1')",
          },
        },
        required: ["snapshotId"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "task_complete",
      description:
        "Mark the task as complete and provide a final summary. Use this when you have finished all required work.",
      parameters: {
        type: "object",
        properties: {
          summary: {
            type: "string",
            description:
              "A comprehensive summary of what was accomplished, including any important results or outputs",
          },
          artifacts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                type: {
                  type: "string",
                  enum: ["file", "image", "code", "data"],
                },
                path: { type: "string" },
                description: { type: "string" },
              },
            },
            description: "List of artifacts created during the task",
          },
        },
        required: ["summary"],
      },
    },
  },
];

// Get current date string
function getCurrentDateString(): string {
  const now = new Date();
  return now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

const TOOL_SELECTION_GUIDE = `
TOOL SELECTION GUIDE (use the RIGHT tool for each task):

For CREATING NEW PROJECTS:
  1. scaffold_project - Creates complete project structure with config files
     - Supports: react, nextjs, vue, svelte, express, fastapi, rails
     - Example: scaffold_project("my-app", "react", "/tmp/projects")
  2. Then: install_dependencies to install packages
  3. Then: start_dev_server to run it

For CURRENT DATA (prices, weather, news):
  1. http_request to a known API (preferred - more reliable)
     - Crypto: https://api.coinbase.com/v2/prices/BTC-USD/spot
     - Weather: https://wttr.in/CityName?format=j1
  2. web_search (fallback if no direct API)
  3. browse_url to a specific data page (last resort)

For SECURITY ANALYSIS (ALWAYS use specialized tools first!):
  1. npm_audit tool - REQUIRED for vulnerability scanning
  2. security_analysis tool - for comprehensive security report
  3. read_file package.json for manual review

For FILE CREATION:
  1. write_file to create the file
  2. read_file to VERIFY it was created correctly
  3. For code: execute the file to test it works

For RUNNING SHELL COMMANDS:
  1. run_shell - Execute any shell command
  2. For background processes: use tmux_start instead

For DEV SERVER MANAGEMENT:
  1. start_dev_server - Start server in background
  2. get_dev_server_output - Check server logs
  3. stop_dev_server - Stop when done

For GIT OPERATIONS:
  1. git_init - Initialize new repo
  2. git_clone - Clone existing repo
  3. git_status - See current state
  4. git_diff - Review changes
  5. git_commit - Commit changes
  6. git_push/git_pull - Sync with remote
  7. git_create_pr - Create GitHub pull request
`;

const FAILURE_RECOVERY_PROTOCOL = `
FAILURE RECOVERY (when a tool fails):

Step 1: Identify WHY it failed
  - API error? Try alternative API or tool
  - File not found? Check path, create directory
  - Permission denied? Try different approach
  - Timeout? Retry with longer timeout or smaller task

Step 2: Try ALTERNATIVE tools (max 2 fallbacks)
  Tool Failed          | Try Instead
  ---------------------|---------------------------
  web_search           | http_request to API, browse_url
  http_request         | browse_url, playwright_browse
  execute_python       | execute_javascript, execute_shell
  write_file           | execute_shell with echo/cat
  npm_audit            | execute_shell 'pnpm audit'

Step 3: If all alternatives fail
  - Explain what you tried
  - Suggest what the user could do manually
  - NEVER just say "I couldn't do it" without details
`;

const VERIFICATION_PROTOCOL = `
VERIFICATION (before marking task complete):

For FILE tasks:
  - read_file to confirm content is correct
  - list_files to confirm file exists

For CODE tasks:
  - Execute the code to verify it runs
  - Check output matches expectations
  - Run tests if available

For SERVER tasks:
  - check_dev_server or http_request to verify response
  - Check for errors in tmux_output

For SEARCH tasks:
  - Verify the information answers the question
  - Cross-reference if critical

NEVER mark complete without verification!
`;

function getJarvisSystemPrompt(): string {
  return `You are JARVIS, an autonomous AI agent assistant with advanced capabilities. Today's date is ${getCurrentDateString()}.

CORE CAPABILITIES:
- Web search and browsing (with automatic fallbacks)
- Code execution (Python, JavaScript, shell commands)
- File management (read, write, list files)
- HTTP API requests (for current data like prices)
- Image generation and analysis (vision, screenshots)
- Security analysis (npm_audit, security_analysis)
- SSH access to remote servers
- Git operations (status, diff, commit, push, pull)
- PDF reading and document analysis
- Audio transcription and text-to-speech

ADVANCED CAPABILITIES:
- Persistent Memory: search_memory, store_memory to recall and learn from past experiences
- Multi-Agent Teams: spawn_agent_team for complex tasks, delegate_to_agent for specialized work
- Agent Types: code, research, sysadmin, data, worker - each with domain expertise
- MCP Integration: connect_mcp_server for external tools (Slack, Jira, databases)
- Self-Review: Use self_review for important tasks before delivering final response

${TOOL_SELECTION_GUIDE}

${FAILURE_RECOVERY_PROTOCOL}

${VERIFICATION_PROTOCOL}

EXECUTION PATTERN:
1. Plan: Break complex tasks into steps
2. Recall: Check memory for relevant past experiences (search_memory)
3. Execute: Use the RIGHT tool for each step
4. Delegate: For complex subtasks, use spawn_agent or delegate_to_agent
5. Verify: Confirm each step succeeded
6. Learn: Store important learnings (store_memory)
7. Review: For critical tasks, use self_review before completing
8. Complete: Only when verified, use task_complete

You have access to a sandboxed environment for code execution.
Work autonomously until verified complete, then use task_complete.
Always provide a comprehensive summary of what you accomplished AND verified.`;
}

// Types
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResult {
  toolCallId: string;
  output: string;
  isError: boolean;
}

export interface OrchestratorMessage {
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

export interface OrchestratorStep {
  type: "thinking" | "tool_use" | "response";
  content: string;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
}

export interface OrchestratorCallbacks {
  onThinking: (thought: string) => void;
  onThinkingChunk?: (chunk: string) => void;
  onToolCall: (toolCall: ToolCall) => void;
  onToolResult: (result: ToolResult) => void;
  onComplete: (summary: string, artifacts?: unknown[]) => void;
  onError: (error: string) => void;
  onIteration?: (iteration: number, maxIterations: number) => void;
}

const TOOL_ALTERNATIVES: Record<string, string[]> = {
  web_search: ["searxng_search", "http_request", "browse_url"],
  http_request: ["browse_url", "playwright_browse"],
  execute_python: ["execute_javascript", "execute_shell"],
  execute_javascript: ["execute_python", "execute_shell"],
  browse_url: ["playwright_browse", "http_request"],
  npm_audit: ["security_analysis", "execute_shell"],
};

interface ToolExecutionContext {
  failedTools: Map<string, number>;
  lastToolOutputs: Map<string, string>;
}

function getAlternativeTool(
  failedTool: string,
  context: ToolExecutionContext
): string | null {
  const alternatives = TOOL_ALTERNATIVES[failedTool] || [];
  for (const alt of alternatives) {
    const failCount = context.failedTools.get(alt) || 0;
    if (failCount < 2) {
      return alt;
    }
  }
  return null;
}

function isToolResultError(output: string): boolean {
  const errorPatterns = [
    /^Error:/i,
    /error:/i,
    /failed/i,
    /exception/i,
    /ENOENT/,
    /ECONNREFUSED/,
    /timeout/i,
    /not found/i,
    /permission denied/i,
  ];
  return errorPatterns.some(p => p.test(output));
}

function suggestVerificationTool(
  toolName: string,
  input: Record<string, unknown>
): { tool: string; input: Record<string, unknown> } | null {
  switch (toolName) {
    case "write_file":
      return {
        tool: "read_file",
        input: { path: input.path },
      };
    case "tmux_start":
      return {
        tool: "tmux_output",
        input: { sessionName: input.sessionName, lines: 20 },
      };
    case "start_dev_server":
      return {
        tool: "check_dev_server",
        input: { port: input.port || 5173 },
      };
    case "git_commit":
      return {
        tool: "git_status",
        input: { projectPath: input.projectPath },
      };
    case "execute_shell":
    case "execute_python":
    case "execute_javascript":
      return null;
    default:
      return null;
  }
}

const PARALLELIZABLE_TOOLS = new Set([
  "web_search",
  "searxng_search",
  "browse_url",
  "read_file",
  "list_files",
  "calculate",
  "http_request",
  "get_datetime",
  "json_tool",
  "text_process",
  "ssh_read_file",
  "ssh_list_files",
  "screenshot",
  "playwright_browse",
  "git_status",
  "git_diff",
  "git_log",
  "database_query",
  "analyze_screenshot",
]);

function canRunInParallel(toolName: string): boolean {
  return PARALLELIZABLE_TOOLS.has(toolName);
}

async function executeToolsInParallel(
  toolCalls: ToolCall[],
  executeToolFn: (
    name: string,
    input: Record<string, unknown>
  ) => Promise<string>,
  executionContext: ToolExecutionContext,
  callbacks: OrchestratorCallbacks
): Promise<Array<{ tc: ToolCall; output: string; isError: boolean }>> {
  const parallelizable = toolCalls.filter(tc => canRunInParallel(tc.name));
  const sequential = toolCalls.filter(tc => !canRunInParallel(tc.name));

  const results: Array<{ tc: ToolCall; output: string; isError: boolean }> = [];

  if (parallelizable.length > 1) {
    const parallelResults = await Promise.all(
      parallelizable.map(async tc => {
        try {
          const output = await executeToolFn(tc.name, tc.input);
          const isError = isToolResultError(output);
          if (isError) {
            const failCount =
              (executionContext.failedTools.get(tc.name) || 0) + 1;
            executionContext.failedTools.set(tc.name, failCount);
          } else {
            executionContext.lastToolOutputs.set(tc.name, output);
          }
          return { tc, output, isError };
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : String(error);
          const failCount =
            (executionContext.failedTools.get(tc.name) || 0) + 1;
          executionContext.failedTools.set(tc.name, failCount);
          return { tc, output: `Error: ${errorMsg}`, isError: true };
        }
      })
    );
    results.push(...parallelResults);
  } else {
    for (const tc of parallelizable) {
      const result = await executeSingleTool(
        tc,
        executeToolFn,
        executionContext
      );
      results.push(result);
    }
  }

  for (const tc of sequential) {
    const result = await executeSingleTool(tc, executeToolFn, executionContext);
    results.push(result);
  }

  return results;
}

async function executeSingleTool(
  tc: ToolCall,
  executeToolFn: (
    name: string,
    input: Record<string, unknown>
  ) => Promise<string>,
  executionContext: ToolExecutionContext
): Promise<{ tc: ToolCall; output: string; isError: boolean }> {
  let output: string;
  let isError = false;

  try {
    output = await executeToolFn(tc.name, tc.input);

    if (isToolResultError(output)) {
      isError = true;
      const failCount = (executionContext.failedTools.get(tc.name) || 0) + 1;
      executionContext.failedTools.set(tc.name, failCount);

      const altTool = getAlternativeTool(tc.name, executionContext);
      if (altTool && failCount <= 2) {
        output += `\n\n[JARVIS] Tool "${tc.name}" failed. Suggesting alternative: "${altTool}"`;
      }
    } else {
      executionContext.lastToolOutputs.set(tc.name, output);
    }
  } catch (error) {
    if (error instanceof Error && error.name === "ApprovalRequiredError") {
      throw error;
    }
    const errorMsg = error instanceof Error ? error.message : String(error);
    output = `Error: ${errorMsg}`;
    isError = true;

    const failCount = (executionContext.failedTools.get(tc.name) || 0) + 1;
    executionContext.failedTools.set(tc.name, failCount);

    const altTool = getAlternativeTool(tc.name, executionContext);
    if (altTool) {
      output += `\n\n[JARVIS] Consider using "${altTool}" as an alternative.`;
    }
  }

  return { tc, output, isError };
}

// Export provider control functions
export function setInferenceProvider(provider: InferenceProvider): void {
  currentProvider = provider;
  console.log(`[JARVIS] Switched to ${provider} provider`);
}

export function getInferenceProvider(): InferenceProvider {
  return currentProvider;
}

// For backwards compatibility with existing UI
export function setInferenceTier(tier: string): void {
  if (tier === "cerebras") setInferenceProvider("cerebras");
  else if (tier === "local")
    setInferenceProvider("anthropic"); // fallback to anthropic
  else if (tier === "cloud") setInferenceProvider("anthropic");
  else setInferenceProvider("anthropic");
}

export function getInferenceTier(): string {
  return currentProvider;
}

// Convert messages to Anthropic format
function toAnthropicMessages(messages: OpenRouterMessage[]): Array<{
  role: string;
  content:
    | string
    | Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
        tool_use_id?: string;
        content?: string;
      }>;
}> {
  return messages.map(msg => {
    if (msg.role === "tool") {
      return {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id || "",
            content:
              typeof msg.content === "string"
                ? msg.content
                : JSON.stringify(msg.content),
          },
        ],
      };
    }

    if (
      msg.role === "assistant" &&
      msg.tool_calls &&
      msg.tool_calls.length > 0
    ) {
      const contentBlocks: Array<{
        type: string;
        text?: string;
        id?: string;
        name?: string;
        input?: Record<string, unknown>;
      }> = [];

      if (
        msg.content &&
        typeof msg.content === "string" &&
        msg.content.trim()
      ) {
        contentBlocks.push({ type: "text", text: msg.content });
      }

      for (const tc of msg.tool_calls) {
        contentBlocks.push({
          type: "tool_use",
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments || "{}"),
        });
      }

      return {
        role: "assistant",
        content: contentBlocks,
      };
    }

    return {
      role: msg.role === "assistant" ? "assistant" : "user",
      content:
        typeof msg.content === "string"
          ? msg.content
          : JSON.stringify(msg.content),
    };
  });
}

// Convert tools to Anthropic format
function toAnthropicTools(
  tools: OpenRouterTool[]
): Array<{ name: string; description: string; input_schema: object }> {
  return tools.map(t => ({
    name: t.function.name,
    description: t.function.description,
    input_schema: t.function.parameters,
  }));
}

// Call Anthropic Claude API directly with streaming support
async function callAnthropic(
  messages: OpenRouterMessage[],
  systemPrompt: string,
  onChunk?: (chunk: string) => void
): Promise<OpenRouterResponse> {
  const anthropicMessages = toAnthropicMessages(messages);
  const anthropicTools = toAnthropicTools(JARVIS_TOOLS);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-opus-4-5-20251101",
      max_tokens: 8192,
      system: systemPrompt,
      messages: anthropicMessages,
      tools: anthropicTools,
      stream: !!onChunk,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  if (onChunk && response.body) {
    const toolCalls: OpenRouterToolCall[] = [];
    let textContent = "";
    let responseId = "";
    let stopReason = "stop";
    const toolInputBuffers: Map<number, string> = new Map();
    const toolBlocks: Map<number, { id: string; name: string; input: string }> =
      new Map();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6);
        if (data === "[DONE]") continue;

        try {
          const event = JSON.parse(data);

          switch (event.type) {
            case "message_start":
              responseId = event.message?.id || "";
              break;
            case "content_block_start":
              if (event.content_block?.type === "tool_use") {
                toolBlocks.set(event.index, {
                  id: event.content_block.id,
                  name: event.content_block.name,
                  input: "",
                });
                toolInputBuffers.set(event.index, "");
              }
              break;
            case "content_block_delta":
              if (event.delta?.type === "text_delta" && event.delta.text) {
                textContent += event.delta.text;
                onChunk(event.delta.text);
              } else if (
                event.delta?.type === "input_json_delta" &&
                event.delta.partial_json
              ) {
                const existing = toolInputBuffers.get(event.index) || "";
                toolInputBuffers.set(
                  event.index,
                  existing + event.delta.partial_json
                );
              }
              break;
            case "content_block_stop":
              const toolBlock = toolBlocks.get(event.index);
              if (toolBlock) {
                const inputJson = toolInputBuffers.get(event.index) || "{}";
                toolCalls.push({
                  id: toolBlock.id,
                  type: "function",
                  function: {
                    name: toolBlock.name,
                    arguments: inputJson,
                  },
                });
              }
              break;
            case "message_delta":
              if (event.delta?.stop_reason) {
                stopReason =
                  event.delta.stop_reason === "end_turn"
                    ? "stop"
                    : event.delta.stop_reason;
              }
              break;
          }
        } catch {
          // Ignore parse errors for malformed chunks
        }
      }
    }

    return {
      id: responseId,
      choices: [
        {
          message: {
            role: "assistant",
            content: textContent || null,
            tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
          },
          finish_reason: stopReason,
        },
      ],
    };
  }

  const data = await response.json();

  const toolCalls: OpenRouterToolCall[] = [];
  let textContent = "";

  for (const block of data.content || []) {
    if (block.type === "text") {
      textContent += block.text;
    } else if (block.type === "tool_use") {
      toolCalls.push({
        id: block.id,
        type: "function",
        function: {
          name: block.name,
          arguments: JSON.stringify(block.input),
        },
      });
    }
  }

  return {
    id: data.id,
    choices: [
      {
        message: {
          role: "assistant",
          content: textContent || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        finish_reason:
          data.stop_reason === "end_turn" ? "stop" : data.stop_reason || "stop",
      },
    ],
  };
}

// Call Cerebras API (OpenAI-compatible)
async function callCerebras(
  messages: OpenRouterMessage[],
  systemPrompt: string,
  _onChunk?: (chunk: string) => void
): Promise<OpenRouterResponse> {
  const response = await fetch("https://api.cerebras.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CEREBRAS_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b",
      max_tokens: 8192,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      tools: JARVIS_TOOLS,
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Cerebras API error: ${response.status} ${error}`);
  }

  return response.json();
}

// Call Gemini API
async function callGemini(
  messages: OpenRouterMessage[],
  systemPrompt: string,
  _onChunk?: (chunk: string) => void
): Promise<OpenRouterResponse> {
  // Convert to Gemini format
  const geminiContents = messages.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [
      {
        text:
          typeof msg.content === "string"
            ? msg.content
            : JSON.stringify(msg.content),
      },
    ],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: geminiContents,
        tools: [
          {
            functionDeclarations: JARVIS_TOOLS.map(t => ({
              name: t.function.name,
              description: t.function.description,
              parameters: t.function.parameters,
            })),
          },
        ],
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Gemini API error: ${response.status} ${error}`);
  }

  const data = await response.json();
  const candidate = data.candidates?.[0];
  const parts = candidate?.content?.parts || [];

  let textContent = "";
  const toolCalls: OpenRouterToolCall[] = [];

  for (const part of parts) {
    if (part.text) textContent += part.text;
    if (part.functionCall) {
      toolCalls.push({
        id: `gemini_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type: "function",
        function: {
          name: part.functionCall.name,
          arguments: JSON.stringify(part.functionCall.args),
        },
      });
    }
  }

  return {
    id: `gemini_${Date.now()}`,
    choices: [
      {
        message: {
          role: "assistant",
          content: textContent || null,
          tool_calls: toolCalls.length > 0 ? toolCalls : undefined,
        },
        finish_reason: candidate?.finishReason || "stop",
      },
    ],
  };
}

// Call Grok (xAI) API - OpenAI-compatible
async function callGrok(
  messages: OpenRouterMessage[],
  systemPrompt: string,
  _onChunk?: (chunk: string) => void
): Promise<OpenRouterResponse> {
  const response = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${XAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "grok-4.1",
      max_tokens: 8192,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      tools: JARVIS_TOOLS,
      tool_choice: "auto",
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok API error: ${response.status} ${error}`);
  }

  return response.json();
}

// Main LLM call function with provider selection and fallback
async function callLLM(
  messages: OpenRouterMessage[],
  systemPrompt: string,
  onChunk?: (chunk: string) => void
): Promise<OpenRouterResponse> {
  const providers: Array<{
    name: InferenceProvider;
    fn: (
      m: OpenRouterMessage[],
      s: string,
      c?: (chunk: string) => void
    ) => Promise<OpenRouterResponse>;
    hasKey: boolean;
    supportsStreaming: boolean;
  }> = [
    {
      name: "anthropic",
      fn: callAnthropic,
      hasKey: !!ANTHROPIC_API_KEY,
      supportsStreaming: true,
    },
    {
      name: "cerebras",
      fn: callCerebras,
      hasKey: !!CEREBRAS_API_KEY,
      supportsStreaming: false,
    },
    {
      name: "gemini",
      fn: callGemini,
      hasKey: !!GEMINI_API_KEY,
      supportsStreaming: false,
    },
    {
      name: "grok",
      fn: callGrok,
      hasKey: !!XAI_API_KEY,
      supportsStreaming: false,
    },
  ];

  const currentIdx = providers.findIndex(p => p.name === currentProvider);
  if (currentIdx > 0) {
    const [current] = providers.splice(currentIdx, 1);
    providers.unshift(current);
  }

  for (const provider of providers) {
    if (!provider.hasKey) continue;

    try {
      console.info(`[JARVIS] Calling ${provider.name} API...`);
      const streamCallback =
        onChunk && provider.supportsStreaming ? onChunk : undefined;
      console.info(
        `[JARVIS] Streaming enabled: ${!!streamCallback}, provider supports: ${provider.supportsStreaming}`
      );
      const result = await provider.fn(messages, systemPrompt, streamCallback);
      console.info(`[JARVIS] ${provider.name} call successful`);
      return result;
    } catch (error) {
      console.error(`[JARVIS] ${provider.name} failed:`, error);
    }
  }

  throw new Error("All LLM providers failed");
}

export interface OrchestratorOptions {
  maxIterations?: number;
  memoryContext?: string;
  conversationHistory?: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function runOrchestrator(
  task: string,
  callbacks: OrchestratorCallbacks,
  executeToolFn: (
    name: string,
    input: Record<string, unknown>
  ) => Promise<string>,
  options: OrchestratorOptions = {}
): Promise<void> {
  const {
    maxIterations = 15,
    memoryContext = "",
    conversationHistory = [],
  } = options;
  const messages: OpenRouterMessage[] = [];

  for (const msg of conversationHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  messages.push({ role: "user", content: task });

  let iterations = 0;
  let isComplete = false;

  const systemPrompt = getJarvisSystemPrompt() + memoryContext;

  const executionContext: ToolExecutionContext = {
    failedTools: new Map(),
    lastToolOutputs: new Map(),
  };

  while (!isComplete && iterations < maxIterations) {
    iterations++;

    if (callbacks.onIteration) {
      callbacks.onIteration(iterations, maxIterations);
    }

    try {
      const response = await callLLM(
        messages,
        systemPrompt,
        callbacks.onThinkingChunk
      );

      const choice = response.choices[0];
      if (!choice) {
        throw new Error("No response from model");
      }

      const assistantMessage = choice.message;
      const toolCalls: ToolCall[] = [];

      if (assistantMessage.content && !callbacks.onThinkingChunk) {
        callbacks.onThinking(assistantMessage.content);
      }

      if (
        assistantMessage.tool_calls &&
        assistantMessage.tool_calls.length > 0
      ) {
        for (const tc of assistantMessage.tool_calls) {
          const toolCall: ToolCall = {
            id: tc.id,
            name: tc.function.name,
            input: JSON.parse(tc.function.arguments || "{}"),
          };
          toolCalls.push(toolCall);
          callbacks.onToolCall(toolCall);
        }
      }

      messages.push({
        role: "assistant",
        content: assistantMessage.content || "",
        tool_calls: assistantMessage.tool_calls,
      });

      if (toolCalls.length > 0) {
        const taskCompleteCall = toolCalls.find(
          tc => tc.name === "task_complete"
        );
        if (taskCompleteCall) {
          const input = taskCompleteCall.input as {
            summary: string;
            artifacts?: unknown[];
          };
          const result: ToolResult = {
            toolCallId: taskCompleteCall.id,
            output: input.summary,
            isError: false,
          };
          callbacks.onToolResult(result);
          callbacks.onComplete(input.summary, input.artifacts);
          isComplete = true;
        } else {
          const toolResults = await executeToolsInParallel(
            toolCalls,
            executeToolFn,
            executionContext,
            callbacks
          );

          for (const { tc, output, isError } of toolResults) {
            const result: ToolResult = {
              toolCallId: tc.id,
              output,
              isError,
            };
            callbacks.onToolResult(result);

            messages.push({
              role: "tool",
              content: output,
              tool_call_id: tc.id,
            });
          }
        }
      } else if (choice.finish_reason === "stop") {
        callbacks.onComplete(assistantMessage.content || "Task completed.", []);
        isComplete = true;
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      callbacks.onError(`Orchestrator error: ${errorMsg}`);
      throw error;
    }
  }

  if (!isComplete) {
    callbacks.onError(
      "Task exceeded maximum iterations. Please try breaking it into smaller steps."
    );
  }
}
