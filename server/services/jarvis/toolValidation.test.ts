import { describe, it, expect } from "vitest";
import {
  validateToolOutput,
  interpretError,
  getRecoverySuggestions,
  isDefiniteError,
  enhanceErrorOutput,
} from "./toolValidation";

describe("Tool Output Validation", () => {
  describe("validateToolOutput", () => {
    it("should detect Python traceback as invalid", () => {
      const output = `Traceback (most recent call last):
  File "script.py", line 5, in <module>
    result = foo()
NameError: name 'foo' is not defined`;

      const result = validateToolOutput(
        "execute_python",
        { code: "..." },
        output
      );
      expect(result.valid).toBe(false);
      expect(result.confidence).toBeLessThan(50);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    it("should detect Python syntax error as invalid", () => {
      const output = `  File "script.py", line 1
    print("hello"
                 ^
SyntaxError: unexpected EOF while parsing`;

      const result = validateToolOutput(
        "execute_python",
        { code: "..." },
        output
      );
      expect(result.valid).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it("should accept valid Python output", () => {
      const output = "Hello, World!\n42\nProgram completed successfully";

      const result = validateToolOutput(
        "execute_python",
        { code: "..." },
        output
      );
      expect(result.valid).toBe(true);
      expect(result.confidence).toBeGreaterThan(70);
    });

    it("should detect HTTP 404 error", () => {
      const output = `Status: 404 Not Found\n\nResponse:\n{"error": "Resource not found"}`;

      const result = validateToolOutput("http_request", { url: "..." }, output);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain("Client error: HTTP 404");
    });

    it("should accept HTTP 200 response", () => {
      const output = `Status: 200 OK\n\nResponse:\n{"data": "success"}`;

      const result = validateToolOutput("http_request", { url: "..." }, output);
      expect(result.valid).toBe(true);
      expect(result.confidence).toBeGreaterThan(90);
    });

    it("should detect search failures", () => {
      const output =
        "All search methods failed after 4 attempts. Last error: timeout";

      const result = validateToolOutput(
        "web_search",
        { query: "test" },
        output
      );
      expect(result.valid).toBe(false);
      expect(result.confidence).toBe(0);
    });

    it("should validate file write with verification", () => {
      const output = "File written and verified: /tmp/test.txt (42 bytes)";

      const result = validateToolOutput(
        "write_file",
        { path: "/tmp/test.txt", content: "x".repeat(42) },
        output
      );
      expect(result.valid).toBe(true);
      expect(result.confidence).toBe(95);
    });

    it("should detect shell command not found", () => {
      const output = "bash: nonexistent: command not found";

      const result = validateToolOutput(
        "run_shell",
        { command: "nonexistent" },
        output
      );
      expect(result.valid).toBe(false);
      expect(result.issues).toContain("Command not found");
    });
  });

  describe("interpretError", () => {
    it("should interpret ENOENT error", () => {
      const error =
        "Error: ENOENT: no such file or directory, open '/path/to/file.txt'";

      const interpretation = interpretError(error);
      expect(interpretation).not.toBeNull();
      expect(interpretation!.explanation).toContain("doesn't exist");
      expect(interpretation!.canAutoRecover).toBe(true);
    });

    it("should interpret connection refused", () => {
      const error = "Error: connect ECONNREFUSED 127.0.0.1:3000";

      const interpretation = interpretError(error);
      expect(interpretation).not.toBeNull();
      expect(interpretation!.explanation).toContain("Connection refused");
    });

    it("should interpret Python ModuleNotFoundError", () => {
      const error = `ModuleNotFoundError: No module named 'pandas'`;

      const interpretation = interpretError(error);
      expect(interpretation).not.toBeNull();
      expect(interpretation!.explanation).toContain("pandas");
      expect(interpretation!.canAutoRecover).toBe(true);
      expect(interpretation!.recoveryTool).toBe("run_shell");
    });

    it("should interpret HTTP 429 rate limit", () => {
      const error = "HTTP error: 429";

      const interpretation = interpretError(error);
      expect(interpretation).not.toBeNull();
      expect(interpretation!.likelyCause).toContain("Rate limited");
      expect(interpretation!.canAutoRecover).toBe(true);
    });
  });

  describe("getRecoverySuggestions", () => {
    it("should suggest mkdir for ENOENT on write_file", () => {
      const suggestions = getRecoverySuggestions(
        "write_file",
        { path: "/tmp/foo/bar/file.txt" },
        "ENOENT: no such file or directory"
      );

      expect(suggestions.length).toBeGreaterThan(0);
      const mkdirSuggestion = suggestions.find(s =>
        s.action.includes("directory")
      );
      expect(mkdirSuggestion).toBeDefined();
      expect(mkdirSuggestion!.tool).toBe("run_shell");
    });

    it("should suggest browse_url for http_request timeout", () => {
      const suggestions = getRecoverySuggestions(
        "http_request",
        { url: "https://example.com" },
        "Request timed out"
      );

      expect(suggestions.length).toBeGreaterThan(0);
      const browseSuggestion = suggestions.find(s => s.tool === "browse_url");
      expect(browseSuggestion).toBeDefined();
    });

    it("should suggest pip install for missing module", () => {
      const suggestions = getRecoverySuggestions(
        "execute_python",
        { code: "import numpy" },
        "ModuleNotFoundError: No module named 'numpy'"
      );

      const pipSuggestion = suggestions.find(s =>
        s.input.command?.toString().includes("pip install numpy")
      );
      expect(pipSuggestion).toBeDefined();
    });
  });

  describe("isDefiniteError", () => {
    it("should detect Error: prefix", () => {
      expect(isDefiniteError("Error: something went wrong")).toBe(true);
    });

    it("should detect Python traceback", () => {
      expect(isDefiniteError("Traceback (most recent call last):")).toBe(true);
    });

    it("should detect ENOENT", () => {
      expect(isDefiniteError("ENOENT: no such file")).toBe(true);
    });

    it("should detect git fatal", () => {
      expect(isDefiniteError("fatal: not a git repository")).toBe(true);
    });

    it("should not flag normal output", () => {
      expect(isDefiniteError("Operation completed successfully")).toBe(false);
    });
  });

  describe("enhanceErrorOutput", () => {
    it("should add error interpretation to output", () => {
      const error =
        "Error: ENOENT: no such file or directory, open '/tmp/missing.txt'";

      const enhanced = enhanceErrorOutput(
        "read_file",
        { path: "/tmp/missing.txt" },
        error
      );
      expect(enhanced).toContain("ERROR INTERPRETATION");
      expect(enhanced).toContain("doesn't exist");
      expect(enhanced).toContain("Suggestions");
    });

    it("should return original output if no interpretation available", () => {
      const output = "Some random output that is not an error";

      const enhanced = enhanceErrorOutput(
        "web_search",
        { query: "test" },
        output
      );
      expect(enhanced).toBe(output);
    });
  });
});
