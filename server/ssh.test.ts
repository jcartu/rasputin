import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the database
vi.mock("./db", () => ({
  getDb: vi.fn(() =>
    Promise.resolve({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
    })
  ),
}));

describe("SSH Service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Credential Encryption", () => {
    it("should encrypt credentials and return iv and encrypted data", async () => {
      const { encryptCredential } = await import("./ssh");

      const result = encryptCredential("my-secret-key");

      expect(result).toBeDefined();
      expect(result.encrypted).toBeDefined();
      expect(result.iv).toBeDefined();
      expect(typeof result.encrypted).toBe("string");
      expect(typeof result.iv).toBe("string");
    });

    it("should decrypt credentials correctly", async () => {
      const { encryptCredential, decryptCredential } = await import("./ssh");

      const original = "my-secret-ssh-key-12345";

      const { encrypted, iv } = encryptCredential(original);
      const decrypted = decryptCredential(encrypted, iv);

      expect(decrypted).toBe(original);
    });

    it("should produce different ciphertext for same plaintext (due to random IV)", async () => {
      const { encryptCredential } = await import("./ssh");

      const plaintext = "same-secret";
      const result1 = encryptCredential(plaintext);
      const result2 = encryptCredential(plaintext);

      // IVs should be different
      expect(result1.iv).not.toBe(result2.iv);
      // Encrypted data should be different due to different IVs
      expect(result1.encrypted).not.toBe(result2.encrypted);
    });
  });

  describe("SSHConnectionManager", () => {
    it("should be a singleton", async () => {
      const { SSHConnectionManager } = await import("./ssh");

      const instance1 = SSHConnectionManager.getInstance();
      const instance2 = SSHConnectionManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should export sshManager instance", async () => {
      const { sshManager } = await import("./ssh");

      expect(sshManager).toBeDefined();
    });

    it("should have executeCommand method", async () => {
      const { sshManager } = await import("./ssh");

      expect(typeof sshManager.executeCommand).toBe("function");
    });

    it("should have testConnection method", async () => {
      const { sshManager } = await import("./ssh");

      expect(typeof sshManager.testConnection).toBe("function");
    });

    it("should have file operation methods", async () => {
      const { sshManager } = await import("./ssh");

      expect(typeof sshManager.readFile).toBe("function");
      expect(typeof sshManager.writeFile).toBe("function");
      expect(typeof sshManager.listDirectory).toBe("function");
    });
  });
});
