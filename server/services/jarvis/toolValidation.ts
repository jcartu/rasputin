/**
 * JARVIS Tool Output Validation System
 *
 * Validates tool outputs to ensure they actually succeeded (not just returned without error).
 * Provides user-friendly error interpretation and recovery suggestions.
 */

/**
 * Validation result from a tool output check
 */
export interface ToolValidationResult {
  valid: boolean;
  confidence: number; // 0-100, how confident we are the output is valid
  issues: string[];
  warnings: string[];
  suggestedRecovery?: RecoverySuggestion;
}

/**
 * User-friendly error interpretation
 */
export interface UserFriendlyError {
  technicalError: string;
  explanation: string;
  likelyCause: string;
  suggestions: string[];
  canAutoRecover: boolean;
  recoveryTool?: string;
  recoveryInput?: Record<string, unknown>;
}

/**
 * Recovery suggestion for failed tools
 */
export interface RecoverySuggestion {
  action: string;
  tool: string;
  input: Record<string, unknown>;
  explanation: string;
}

// ============================================================================
// ERROR PATTERNS - Maps technical errors to user-friendly explanations
// ============================================================================

interface ErrorPattern {
  pattern: RegExp;
  interpret: (match: RegExpMatchArray) => UserFriendlyError;
}

const ERROR_PATTERNS: ErrorPattern[] = [
  // File system errors
  {
    pattern: /ENOENT[:\s]+.*['"](.+)['"]/i,
    interpret: match => ({
      technicalError: match[0],
      explanation: `The file or directory "${match[1]}" doesn't exist`,
      likelyCause: "The path may be wrong, or the file hasn't been created yet",
      suggestions: [
        "Check if the path is correct",
        "Create the file first with write_file",
        "List files in the parent directory to see what exists",
      ],
      canAutoRecover: true,
      recoveryTool: "list_files",
      recoveryInput: {
        path: match[1].split("/").slice(0, -1).join("/") || ".",
      },
    }),
  },
  {
    pattern: /EACCES[:\s]+permission denied.*['"](.+)['"]/i,
    interpret: match => ({
      technicalError: match[0],
      explanation: `Permission denied when accessing "${match[1]}"`,
      likelyCause:
        "The file or directory requires elevated permissions, or is owned by another user",
      suggestions: [
        "Check file permissions with list_files",
        "Try using a different path in the sandbox",
        "For SSH operations, ensure the user has proper permissions",
      ],
      canAutoRecover: false,
    }),
  },
  {
    pattern: /EEXIST[:\s]+.*['"](.+)['"]/i,
    interpret: match => ({
      technicalError: match[0],
      explanation: `The file or directory "${match[1]}" already exists`,
      likelyCause: "Tried to create something that already exists",
      suggestions: [
        "Read the existing file first to check its contents",
        "Delete the existing file if you want to replace it",
        "Use a different filename",
      ],
      canAutoRecover: true,
      recoveryTool: "read_file",
      recoveryInput: { path: match[1] },
    }),
  },

  // Network errors
  {
    pattern: /ECONNREFUSED.*?(\d+\.\d+\.\d+\.\d+|\w+):?(\d+)?/i,
    interpret: match => ({
      technicalError: match[0],
      explanation: `Connection refused to ${match[1]}${match[2] ? `:${match[2]}` : ""}`,
      likelyCause:
        "The server is not running, or firewall is blocking the connection",
      suggestions: [
        "Check if the server is running",
        "Verify the host and port are correct",
        "Check if a firewall is blocking the connection",
        "Try using check_dev_server or http_request to verify server status",
      ],
      canAutoRecover: false,
    }),
  },
  {
    pattern: /ETIMEDOUT|timeout|timed out/i,
    interpret: match => ({
      technicalError: match[0],
      explanation: "The operation timed out",
      likelyCause: "Network issue, server too slow, or process took too long",
      suggestions: [
        "Try the operation again - it might work on retry",
        "Check network connectivity",
        "For long operations, consider breaking into smaller steps",
        "Increase timeout if possible",
      ],
      canAutoRecover: true,
    }),
  },
  {
    // Must match ENOTFOUND as standalone error code (not part of ModuleNotFoundError)
    pattern: /\bENOTFOUND\b.*?['"]?([^'":\s]+)['"]?/,
    interpret: match => ({
      technicalError: match[0],
      explanation: `Could not resolve hostname "${match[1] || "unknown"}"`,
      likelyCause: "DNS resolution failed, or hostname is misspelled",
      suggestions: [
        "Check if the hostname is spelled correctly",
        "Verify network connectivity",
        "Try using an IP address instead of hostname",
      ],
      canAutoRecover: false,
    }),
  },
  {
    pattern: /getaddrinfo.*failed/i,
    interpret: match => ({
      technicalError: match[0],
      explanation: "Could not resolve hostname - DNS lookup failed",
      likelyCause: "DNS resolution failed, or hostname is misspelled",
      suggestions: [
        "Check if the hostname is spelled correctly",
        "Verify network connectivity",
        "Try using an IP address instead of hostname",
      ],
      canAutoRecover: false,
    }),
  },

  // Python execution errors (MUST come before generic patterns)
  {
    pattern: /Traceback \(most recent call last\)[\s\S]*?(\w+Error): (.+)/m,
    interpret: match => ({
      technicalError: `Python ${match[1]}: ${match[2]}`,
      explanation: `Python raised a ${match[1]}: ${match[2]}`,
      likelyCause: "Bug in the Python code",
      suggestions: [
        "Review the Python code for syntax or logic errors",
        "Check if all required modules are imported",
        "Verify variable names and types are correct",
      ],
      canAutoRecover: false,
    }),
  },
  {
    pattern: /SyntaxError: (.+)/,
    interpret: match => ({
      technicalError: match[0],
      explanation: `Python syntax error: ${match[1]}`,
      likelyCause: "The Python code has invalid syntax",
      suggestions: [
        "Check for missing colons, parentheses, or quotes",
        "Verify proper indentation",
        "Look for typos in keywords",
      ],
      canAutoRecover: false,
    }),
  },
  {
    pattern: /ModuleNotFoundError: No module named ['"](.+)['"]/,
    interpret: match => ({
      technicalError: match[0],
      explanation: `Python module "${match[1]}" is not installed`,
      likelyCause: "The required package is not available in the sandbox",
      suggestions: [
        `Try installing with: run_shell("pip install ${match[1]}")`,
        "Use an alternative approach that doesn't require this module",
        "Check if the module name is spelled correctly",
      ],
      canAutoRecover: true,
      recoveryTool: "run_shell",
      recoveryInput: { command: `pip install ${match[1]}` },
    }),
  },

  // JavaScript/Node errors
  {
    pattern: /ReferenceError: (\w+) is not defined/,
    interpret: match => ({
      technicalError: match[0],
      explanation: `JavaScript variable "${match[1]}" is not defined`,
      likelyCause: "Using a variable before declaring it, or typo in name",
      suggestions: [
        "Check if the variable is declared with let, const, or var",
        "Verify the variable name is spelled correctly",
        "Ensure the variable is in scope",
      ],
      canAutoRecover: false,
    }),
  },
  {
    pattern: /TypeError: (.+)/,
    interpret: match => ({
      technicalError: match[0],
      explanation: `JavaScript type error: ${match[1]}`,
      likelyCause:
        "Trying to use a value in a way that's not allowed for its type",
      suggestions: [
        "Check if the value is null or undefined",
        "Verify you're calling methods on the correct type",
        "Add type checks before operations",
      ],
      canAutoRecover: false,
    }),
  },

  // HTTP errors
  {
    pattern: /HTTP (?:error|status)[:\s]*(\d{3})/i,
    interpret: match => {
      const status = parseInt(match[1]);
      let cause = "Unknown HTTP error";
      let suggestions: string[] = [];

      if (status === 401) {
        cause = "Authentication required or invalid credentials";
        suggestions = [
          "Check if API key is set correctly",
          "Verify authentication headers",
        ];
      } else if (status === 403) {
        cause = "Access forbidden - you don't have permission";
        suggestions = [
          "Check API permissions",
          "Verify you're authorized for this resource",
        ];
      } else if (status === 404) {
        cause = "Resource not found";
        suggestions = [
          "Check if the URL is correct",
          "Verify the resource exists",
        ];
      } else if (status === 429) {
        cause = "Rate limited - too many requests";
        suggestions = [
          "Wait a moment and try again",
          "Reduce request frequency",
        ];
      } else if (status >= 500) {
        cause = "Server error - the remote server had a problem";
        suggestions = [
          "Try again in a few moments",
          "Check if the service is experiencing issues",
        ];
      }

      return {
        technicalError: match[0],
        explanation: `HTTP ${status} error`,
        likelyCause: cause,
        suggestions,
        canAutoRecover: status === 429 || status >= 500,
      };
    },
  },

  // Git errors
  {
    pattern: /fatal: not a git repository/i,
    interpret: () => ({
      technicalError: "Not a git repository",
      explanation: "The directory is not a git repository",
      likelyCause: "Git hasn't been initialized in this directory",
      suggestions: [
        "Use git_init to initialize a new repository",
        "Navigate to the correct project directory",
        "Clone an existing repository with git_clone",
      ],
      canAutoRecover: true,
      recoveryTool: "git_init",
      recoveryInput: {},
    }),
  },
  {
    pattern: /fatal: (.*already exists|destination path .* already exists)/i,
    interpret: match => ({
      technicalError: match[0],
      explanation: "The destination directory already exists",
      likelyCause: "Trying to clone or create in a directory that exists",
      suggestions: [
        "Choose a different directory name",
        "Delete the existing directory first",
        "Pull updates instead of cloning",
      ],
      canAutoRecover: false,
    }),
  },

  // SSH errors
  {
    pattern: /SSH host ['"](.+)['"] not found/i,
    interpret: match => ({
      technicalError: match[0],
      explanation: `SSH host "${match[1]}" is not registered`,
      likelyCause: "The host needs to be added in Agent > Hosts first",
      suggestions: [
        "Register the host in the Hosts management tab",
        "Check if the host name is spelled correctly",
        "Verify you have SSH hosts configured",
      ],
      canAutoRecover: false,
    }),
  },
  {
    pattern: /APPROVAL_REQUIRED:/,
    interpret: () => ({
      technicalError: "Command requires approval",
      explanation: "This SSH command requires human approval before execution",
      likelyCause:
        "The command is flagged as potentially dangerous or sensitive",
      suggestions: [
        "Check the pending approvals in the Hosts tab",
        "Approve or modify the command before it can execute",
      ],
      canAutoRecover: false,
    }),
  },

  // Generic fallback errors
  {
    pattern: /^Error:\s*(.+)/i,
    interpret: match => ({
      technicalError: match[0],
      explanation: match[1],
      likelyCause: "An error occurred during tool execution",
      suggestions: [
        "Review the error message for details",
        "Try an alternative approach",
        "Check tool inputs are correct",
      ],
      canAutoRecover: false,
    }),
  },
];

// ============================================================================
// TOOL VALIDATORS - Specific validation logic for each tool type
// ============================================================================

type ToolValidator = (
  input: Record<string, unknown>,
  output: string
) => ToolValidationResult;

const TOOL_VALIDATORS: Record<string, ToolValidator> = {
  execute_python: (_input, output) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    let confidence = 90;

    // Check for Python errors
    if (output.includes("Traceback")) {
      issues.push("Python traceback detected - code threw an exception");
      confidence = 10;
    }
    if (output.includes("SyntaxError")) {
      issues.push("Python syntax error - invalid code");
      confidence = 0;
    }
    if (output.includes("NameError")) {
      issues.push("Undefined variable in Python code");
      confidence = 10;
    }
    if (output.includes("ModuleNotFoundError")) {
      issues.push("Missing Python module");
      confidence = 10;
    }
    if (output.includes("TypeError:")) {
      issues.push("Python type error - wrong argument type");
      confidence = 15;
    }
    if (output.includes("ValueError:")) {
      issues.push("Python value error - invalid value");
      confidence = 15;
    }
    if (output.includes("ImportError")) {
      issues.push("Python import failed");
      confidence = 15;
    }

    // Warnings
    if (output.includes("DeprecationWarning")) {
      warnings.push("Code uses deprecated features");
    }
    if (output.includes("FutureWarning")) {
      warnings.push("Code may break in future Python versions");
    }

    // Success indicators
    if (output.includes("successfully") || output.includes("completed")) {
      confidence = Math.max(confidence, 80);
    }

    return {
      valid: issues.length === 0,
      confidence,
      issues,
      warnings,
    };
  },

  execute_javascript: (_input, output) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    let confidence = 90;

    // Check for JavaScript errors
    if (output.includes("ReferenceError")) {
      issues.push("Undefined variable in JavaScript");
      confidence = 10;
    }
    if (output.includes("TypeError")) {
      issues.push("JavaScript type error");
      confidence = 15;
    }
    if (output.includes("SyntaxError")) {
      issues.push("JavaScript syntax error");
      confidence = 0;
    }
    if (output.includes("RangeError")) {
      issues.push("Value out of range");
      confidence = 15;
    }
    if (
      output.includes("Cannot find module") ||
      output.includes("MODULE_NOT_FOUND")
    ) {
      issues.push("Missing npm module");
      confidence = 10;
    }
    if (output.includes("UnhandledPromiseRejection")) {
      issues.push("Unhandled promise rejection");
      confidence = 20;
    }

    return {
      valid: issues.length === 0,
      confidence,
      issues,
      warnings,
    };
  },

  http_request: (_input, output) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    let confidence = 85;

    // Parse status code from output
    const statusMatch = output.match(/Status:\s*(\d{3})/);
    if (statusMatch) {
      const status = parseInt(statusMatch[1]);
      if (status >= 400 && status < 500) {
        issues.push(`Client error: HTTP ${status}`);
        confidence = 20;
      } else if (status >= 500) {
        issues.push(`Server error: HTTP ${status}`);
        confidence = 15;
      } else if (status >= 200 && status < 300) {
        confidence = 95;
      } else if (status >= 300 && status < 400) {
        warnings.push(`Redirect: HTTP ${status}`);
        confidence = 75;
      }
    }

    // Check for common HTTP errors
    if (output.includes("ECONNREFUSED")) {
      issues.push("Connection refused - server not available");
      confidence = 0;
    }
    if (output.includes("ETIMEDOUT") || output.includes("timeout")) {
      issues.push("Request timed out");
      confidence = 10;
    }
    if (output.includes("ENOTFOUND")) {
      issues.push("Host not found - DNS resolution failed");
      confidence = 0;
    }

    // Check for valid JSON response if expected
    if (output.includes("Response:") && output.includes("{")) {
      try {
        const responseStart = output.indexOf("{");
        const jsonStr = output.substring(responseStart);
        JSON.parse(jsonStr.split("\n")[0]); // Try to parse first JSON object
        confidence = Math.max(confidence, 80);
      } catch {
        // Not valid JSON - might be expected
      }
    }

    return {
      valid: issues.length === 0,
      confidence,
      issues,
      warnings,
    };
  },

  web_search: (_input, output) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    let confidence = 80;

    // Check for search failures
    if (output.includes("No results found") || output.includes("0 results")) {
      issues.push("Search returned no results");
      confidence = 30;
    }
    if (output.includes("API error") || output.includes("error:")) {
      issues.push("Search API error");
      confidence = 10;
    }
    if (output.includes("All search methods failed")) {
      issues.push("All search fallbacks failed");
      confidence = 0;
    }

    // Check for successful search
    if (
      output.includes("Sources:") ||
      output.includes("Found") ||
      output.includes("[CACHED]")
    ) {
      confidence = 90;
    }
    if (output.includes("[FALLBACK:")) {
      warnings.push("Primary search failed, used fallback");
      confidence = Math.max(confidence - 10, 50);
    }

    return {
      valid: issues.length === 0,
      confidence,
      issues,
      warnings,
    };
  },

  write_file: (input, output) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    let confidence = 85;

    // Check for verification
    if (output.includes("verified")) {
      confidence = 95;
    }
    if (
      output.includes(
        "Warning: File write reported success but verification failed"
      )
    ) {
      issues.push("File write verification failed");
      confidence = 20;
    }
    if (output.includes("Error writing file")) {
      issues.push("File write failed");
      confidence = 0;
    }

    // Check file size
    const sizeMatch = output.match(/\((\d+) bytes\)/);
    if (sizeMatch) {
      const size = parseInt(sizeMatch[1]);
      const expectedContent = input.content as string;
      if (expectedContent && Math.abs(size - expectedContent.length) > 10) {
        warnings.push(
          `Written size (${size}) differs from expected (${expectedContent.length})`
        );
      }
    }

    return {
      valid: issues.length === 0,
      confidence,
      issues,
      warnings,
      suggestedRecovery:
        issues.length > 0
          ? {
              action: "Verify file was created",
              tool: "read_file",
              input: { path: input.path },
              explanation: "Read the file to verify its contents",
            }
          : undefined,
    };
  },

  run_shell: (_input, output) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    let confidence = 85;

    // Check for common shell errors
    if (output.includes("command not found")) {
      issues.push("Command not found");
      confidence = 0;
    }
    if (output.includes("Permission denied")) {
      issues.push("Permission denied");
      confidence = 0;
    }
    if (output.includes("No such file or directory")) {
      issues.push("File or directory not found");
      confidence = 10;
    }
    if (
      output.includes("Operation not permitted") ||
      output.includes("blocked for security")
    ) {
      issues.push("Operation not permitted");
      confidence = 0;
    }

    // Check exit code if present
    const exitMatch = output.match(/exit (?:code|status)[:\s]*(\d+)/i);
    if (exitMatch) {
      const exitCode = parseInt(exitMatch[1]);
      if (exitCode !== 0) {
        issues.push(`Command exited with code ${exitCode}`);
        confidence = Math.min(confidence, 30);
      }
    }

    // Success indicators
    if (
      output.includes("successfully") ||
      output.includes("completed") ||
      output.includes("done")
    ) {
      confidence = Math.max(confidence, 80);
    }

    return {
      valid: issues.length === 0,
      confidence,
      issues,
      warnings,
    };
  },

  git_commit: (_input, output) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    let confidence = 80;

    if (output.includes("nothing to commit")) {
      warnings.push("Nothing to commit - working tree clean");
      confidence = 60;
    }
    if (output.includes("Commit created")) {
      confidence = 95;
    }
    if (output.includes("error:") || output.includes("fatal:")) {
      issues.push("Git commit failed");
      confidence = 10;
    }

    return {
      valid: issues.length === 0,
      confidence,
      issues,
      warnings,
    };
  },

  ssh_execute: (_input, output) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    let confidence = 80;

    if (output.includes("APPROVAL_REQUIRED")) {
      warnings.push("Command requires approval");
      confidence = 50;
    }
    if (output.includes("SSH Error") || output.includes("SSH host")) {
      issues.push("SSH connection or host error");
      confidence = 10;
    }
    if (output.includes("Exit code: 0")) {
      confidence = 95;
    }
    const exitMatch = output.match(/Exit code: (\d+)/);
    if (exitMatch && parseInt(exitMatch[1]) !== 0) {
      issues.push(`SSH command failed with exit code ${exitMatch[1]}`);
      confidence = 20;
    }

    return {
      valid: issues.length === 0,
      confidence,
      issues,
      warnings,
    };
  },

  generate_image: (_input, output) => {
    const issues: string[] = [];
    const warnings: string[] = [];
    let confidence = 75;

    if (output.includes("URL:") && output.includes("http")) {
      confidence = 95;
    }
    if (output.includes("generation failed") || output.includes("error")) {
      issues.push("Image generation failed");
      confidence = 0;
    }
    if (output.includes("no URL returned")) {
      issues.push("No image URL returned");
      confidence = 10;
    }

    return {
      valid: issues.length === 0,
      confidence,
      issues,
      warnings,
    };
  },
};

// ============================================================================
// MAIN VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate tool output and determine if it actually succeeded
 */
export function validateToolOutput(
  toolName: string,
  input: Record<string, unknown>,
  output: string
): ToolValidationResult {
  // Check for specific validator
  const validator = TOOL_VALIDATORS[toolName];
  if (validator) {
    return validator(input, output);
  }

  // Generic validation for unknown tools
  return genericValidation(output);
}

/**
 * Generic validation for tools without specific validators
 */
function genericValidation(output: string): ToolValidationResult {
  const issues: string[] = [];
  const warnings: string[] = [];
  let confidence = 75;

  // Check for generic error patterns
  if (output.toLowerCase().startsWith("error:")) {
    issues.push("Output starts with error");
    confidence = 20;
  }
  if (output.includes("failed") && !output.includes("0 failed")) {
    warnings.push("Output contains 'failed'");
    confidence = Math.min(confidence, 50);
  }
  if (output.includes("exception") || output.includes("Exception")) {
    issues.push("Exception occurred");
    confidence = 15;
  }

  // Success indicators
  if (
    output.includes("successfully") ||
    output.includes("completed") ||
    output.includes("created")
  ) {
    confidence = Math.max(confidence, 80);
  }

  // Very short output might indicate failure
  if (output.trim().length < 10 && !output.includes("success")) {
    warnings.push("Very short output - may indicate incomplete execution");
  }

  return {
    valid: issues.length === 0,
    confidence,
    issues,
    warnings,
  };
}

/**
 * Interpret a technical error into a user-friendly explanation
 */
export function interpretError(errorOutput: string): UserFriendlyError | null {
  for (const { pattern, interpret } of ERROR_PATTERNS) {
    const match = errorOutput.match(pattern);
    if (match) {
      return interpret(match);
    }
  }
  return null;
}

/**
 * Get recovery suggestions for a failed tool
 */
export function getRecoverySuggestions(
  toolName: string,
  input: Record<string, unknown>,
  errorOutput: string
): RecoverySuggestion[] {
  const suggestions: RecoverySuggestion[] = [];

  // Get error interpretation if available
  const interpretation = interpretError(errorOutput);
  if (interpretation?.canAutoRecover && interpretation.recoveryTool) {
    suggestions.push({
      action: interpretation.explanation,
      tool: interpretation.recoveryTool,
      input: interpretation.recoveryInput || {},
      explanation: interpretation.suggestions[0] || "Try auto-recovery",
    });
  }

  // Tool-specific recovery suggestions
  switch (toolName) {
    case "write_file":
      if (errorOutput.includes("ENOENT")) {
        suggestions.push({
          action: "Create parent directory",
          tool: "run_shell",
          input: {
            command: `mkdir -p "${(input.path as string).split("/").slice(0, -1).join("/")}"`,
          },
          explanation: "The parent directory may not exist",
        });
      }
      break;

    case "http_request":
      if (
        errorOutput.includes("timeout") ||
        errorOutput.includes("ETIMEDOUT") ||
        errorOutput.includes("timed out")
      ) {
        suggestions.push({
          action: "Retry with different approach",
          tool: "browse_url",
          input: { url: input.url },
          explanation: "Try using browser-based fetch as fallback",
        });
      }
      break;

    case "web_search":
      suggestions.push({
        action: "Try alternative search",
        tool: "searxng_search",
        input: { query: input.query },
        explanation: "SearXNG provides alternative search results",
      });
      break;

    case "execute_python":
      if (errorOutput.includes("ModuleNotFoundError")) {
        const moduleMatch = errorOutput.match(/No module named ['"](.+)['"]/);
        if (moduleMatch) {
          suggestions.push({
            action: "Install missing module",
            tool: "run_shell",
            input: { command: `pip install ${moduleMatch[1]}` },
            explanation: `Install the missing ${moduleMatch[1]} package`,
          });
        }
      }
      break;

    case "git_commit":
      if (errorOutput.includes("nothing to commit")) {
        suggestions.push({
          action: "Check git status",
          tool: "git_status",
          input: { projectPath: input.projectPath },
          explanation: "See what files are available to commit",
        });
      }
      break;
  }

  return suggestions;
}

/**
 * Format validation result for display in orchestrator
 */
export function formatValidationMessage(
  toolName: string,
  result: ToolValidationResult
): string {
  if (result.valid && result.confidence >= 80) {
    return ""; // No message needed for confident success
  }

  const parts: string[] = [];

  if (!result.valid) {
    parts.push(`[VALIDATION] Tool "${toolName}" output has issues:`);
    result.issues.forEach(issue => parts.push(`  - ${issue}`));
  } else if (result.confidence < 80) {
    parts.push(
      `[VALIDATION] Tool "${toolName}" completed but with ${result.confidence}% confidence`
    );
  }

  if (result.warnings.length > 0) {
    parts.push("Warnings:");
    result.warnings.forEach(warn => parts.push(`  - ${warn}`));
  }

  if (result.suggestedRecovery) {
    parts.push(
      `Suggested: ${result.suggestedRecovery.action} using ${result.suggestedRecovery.tool}`
    );
  }

  return parts.join("\n");
}

/**
 * Check if output indicates a clear error (for orchestrator decision-making)
 */
export function isDefiniteError(output: string): boolean {
  const definiteErrorPatterns = [
    /^Error:/i,
    /Traceback \(most recent call last\)/,
    /ENOENT/,
    /ECONNREFUSED/,
    /Permission denied/i,
    /command not found/i,
    /SyntaxError/,
    /fatal:/i,
  ];

  return definiteErrorPatterns.some(p => p.test(output));
}

/**
 * Enhance error output with user-friendly interpretation
 */
export function enhanceErrorOutput(
  toolName: string,
  input: Record<string, unknown>,
  output: string
): string {
  const interpretation = interpretError(output);
  if (!interpretation) {
    return output;
  }

  const enhanced = `${output}

--- ERROR INTERPRETATION ---
What happened: ${interpretation.explanation}
Likely cause: ${interpretation.likelyCause}

Suggestions:
${interpretation.suggestions.map(s => `  - ${s}`).join("\n")}`;

  const recovery = getRecoverySuggestions(toolName, input, output);
  if (recovery.length > 0) {
    return (
      enhanced +
      `\n\nRecovery options:\n${recovery.map(r => `  - ${r.action}: ${r.tool}(${JSON.stringify(r.input)})`).join("\n")}`
    );
  }

  return enhanced;
}
