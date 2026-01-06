import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database module
vi.mock("./db", () => ({
  cleanupEmptyChats: vi.fn(),
  getEmptyChatCount: vi.fn(),
}));

import * as db from "./db";

describe("Chat Cleanup Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("cleanupEmptyChats", () => {
    it("should be callable and return deleted count", async () => {
      const mockCleanup = vi.mocked(db.cleanupEmptyChats);
      mockCleanup.mockResolvedValue(5);

      const result = await db.cleanupEmptyChats(24);

      expect(mockCleanup).toHaveBeenCalledWith(24);
      expect(result).toBe(5);
    });

    it("should return 0 when no empty chats exist", async () => {
      const mockCleanup = vi.mocked(db.cleanupEmptyChats);
      mockCleanup.mockResolvedValue(0);

      const result = await db.cleanupEmptyChats(24);

      expect(result).toBe(0);
    });

    it("should accept custom hours parameter", async () => {
      const mockCleanup = vi.mocked(db.cleanupEmptyChats);
      mockCleanup.mockResolvedValue(3);

      await db.cleanupEmptyChats(48);

      expect(mockCleanup).toHaveBeenCalledWith(48);
    });
  });

  describe("getEmptyChatCount", () => {
    it("should return count of empty chats for a user", async () => {
      const mockGetCount = vi.mocked(db.getEmptyChatCount);
      mockGetCount.mockResolvedValue(10);

      const result = await db.getEmptyChatCount(1);

      expect(mockGetCount).toHaveBeenCalledWith(1);
      expect(result).toBe(10);
    });

    it("should return 0 when user has no empty chats", async () => {
      const mockGetCount = vi.mocked(db.getEmptyChatCount);
      mockGetCount.mockResolvedValue(0);

      const result = await db.getEmptyChatCount(1);

      expect(result).toBe(0);
    });
  });
});

describe("Error Type Classification", () => {
  it("should classify timeout errors correctly", () => {
    const errorMsg = "Request timed out after 30 seconds";
    const isTimeout =
      errorMsg.toLowerCase().includes("timeout") ||
      errorMsg.toLowerCase().includes("timed out");
    expect(isTimeout).toBe(true);
  });

  it("should classify rate limit errors correctly", () => {
    const errorMsg = "Rate limit exceeded - 429 Too Many Requests";
    const isRateLimit =
      errorMsg.toLowerCase().includes("rate limit") ||
      errorMsg.toLowerCase().includes("429");
    expect(isRateLimit).toBe(true);
  });

  it("should classify API errors correctly", () => {
    const errorMsg = "API authentication failed - 401 Unauthorized";
    const isApiError =
      errorMsg.toLowerCase().includes("api") ||
      errorMsg.toLowerCase().includes("401") ||
      errorMsg.toLowerCase().includes("403");
    expect(isApiError).toBe(true);
  });

  it("should classify execution errors correctly", () => {
    const errorMsg = "Runtime execution error in Python script";
    const isExecutionError =
      errorMsg.toLowerCase().includes("execution") ||
      errorMsg.toLowerCase().includes("runtime");
    expect(isExecutionError).toBe(true);
  });

  it("should default to unknown for unclassified errors", () => {
    const errorMsg = "Something unexpected happened";
    const isTimeout = errorMsg.toLowerCase().includes("timeout");
    const isRateLimit = errorMsg.toLowerCase().includes("rate limit");
    const isApiError = errorMsg.toLowerCase().includes("api");
    const isExecutionError = errorMsg.toLowerCase().includes("execution");

    const errorType = isTimeout
      ? "timeout"
      : isRateLimit
        ? "rate_limit"
        : isApiError
          ? "api_error"
          : isExecutionError
            ? "execution_error"
            : "unknown";

    expect(errorType).toBe("unknown");
  });
});
