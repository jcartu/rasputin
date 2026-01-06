/**
 * SSH Service - Secure remote command execution for JARVIS Agent
 *
 * Features:
 * - Ephemeral connections (create/destroy per command)
 * - Host key verification and pinning
 * - Credential encryption at rest
 * - Comprehensive audit logging
 * - Permission checking before execution
 */

import { Client, ConnectConfig } from "ssh2";
import * as crypto from "crypto";
import { getDb } from "./db";
import {
  sshHosts,
  sshCredentials,
  sshPermissions,
  sshAuditLog,
  pendingApprovals,
} from "../drizzle/schema";

// Type aliases derived from schema
type SshHost = typeof sshHosts.$inferSelect;
type InsertSshHost = typeof sshHosts.$inferInsert;
type SshPermission = typeof sshPermissions.$inferSelect;
type InsertSshPermission = typeof sshPermissions.$inferInsert;
import { eq, and, desc } from "drizzle-orm";

// Encryption key derived from JWT_SECRET
const ENCRYPTION_KEY = crypto
  .createHash("sha256")
  .update(process.env.JWT_SECRET || "default-key-change-me")
  .digest();

/**
 * Encrypt sensitive data (passwords, private keys)
 */
export function encryptCredential(plaintext: string): {
  encrypted: string;
  iv: string;
} {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  return { encrypted, iv: iv.toString("hex") };
}

/**
 * Decrypt sensitive data
 */
export function decryptCredential(encrypted: string, iv: string): string {
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    ENCRYPTION_KEY,
    Buffer.from(iv, "hex")
  );
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

/**
 * SSH Connection Manager - handles ephemeral connections
 */
export class SSHConnectionManager {
  private static instance: SSHConnectionManager;

  private constructor() {}

  static getInstance(): SSHConnectionManager {
    if (!SSHConnectionManager.instance) {
      SSHConnectionManager.instance = new SSHConnectionManager();
    }
    return SSHConnectionManager.instance;
  }

  /**
   * Create an ephemeral SSH connection, execute command, and close
   */
  async executeCommand(
    hostId: number,
    userId: number,
    command: string,
    options: {
      workingDirectory?: string;
      timeout?: number;
      taskId?: number;
      clientIp?: string;
    } = {}
  ): Promise<{
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    durationMs: number;
    error?: string;
  }> {
    const startTime = Date.now();
    const { workingDirectory, timeout = 300000, taskId, clientIp } = options;

    const db = await getDb();
    if (!db) {
      throw new Error("Database not available");
    }

    // Get host details
    const [host] = await db
      .select()
      .from(sshHosts)
      .where(eq(sshHosts.id, hostId));
    if (!host) {
      throw new Error(`SSH host not found: ${hostId}`);
    }

    // Verify user owns this host
    if (host.userId !== userId) {
      throw new Error("Unauthorized: You don't own this host");
    }

    // Get credentials
    const [credential] = await db
      .select()
      .from(sshCredentials)
      .where(eq(sshCredentials.hostId, hostId));
    if (!credential) {
      throw new Error(`No credentials found for host: ${host.name}`);
    }

    // Get permissions
    const [permissions] = await db
      .select()
      .from(sshPermissions)
      .where(eq(sshPermissions.hostId, hostId));

    // Check if command is allowed
    const permissionCheck = this.checkPermissions(command, permissions);
    if (!permissionCheck.allowed) {
      // Log the blocked attempt
      await this.logAudit(db, {
        hostId,
        userId,
        taskId,
        command,
        workingDirectory,
        status: "rejected",
        clientIp,
      });
      throw new Error(`Command blocked: ${permissionCheck.reason}`);
    }

    // Check if approval is required
    if (permissionCheck.requiresApproval) {
      // Create pending approval
      const [approval] = await db
        .insert(pendingApprovals)
        .values({
          userId,
          hostId,
          taskId,
          command,
          workingDirectory,
          reason: permissionCheck.approvalReason,
          riskLevel: permissionCheck.riskLevel || "medium",
          status: "pending",
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minute expiry
        })
        .$returningId();

      // Log the pending approval
      await this.logAudit(db, {
        hostId,
        userId,
        taskId,
        command,
        workingDirectory,
        status: "pending",
        approvalRequired: true,
        clientIp,
      });

      return {
        success: false,
        stdout: "",
        stderr: "",
        exitCode: -1,
        durationMs: Date.now() - startTime,
        error: `APPROVAL_REQUIRED:${approval.id}:${permissionCheck.approvalReason}`,
      };
    }

    // Build connection config
    const connectConfig: ConnectConfig = {
      host: host.hostname,
      port: host.port,
      username: host.username,
      readyTimeout: 30000,
    };

    // Add authentication
    if (
      host.authType === "key" &&
      credential.encryptedPrivateKey &&
      credential.encryptionIv
    ) {
      const privateKey = decryptCredential(
        credential.encryptedPrivateKey,
        credential.encryptionIv
      );
      connectConfig.privateKey = privateKey;

      // Add passphrase if present
      if (credential.encryptedPassword) {
        connectConfig.passphrase = decryptCredential(
          credential.encryptedPassword,
          credential.encryptionIv
        );
      }
    } else if (
      host.authType === "password" &&
      credential.encryptedPassword &&
      credential.encryptionIv
    ) {
      connectConfig.password = decryptCredential(
        credential.encryptedPassword,
        credential.encryptionIv
      );
    }

    // Host key verification
    if (host.hostKeyVerified && host.hostFingerprint) {
      connectConfig.hostVerifier = (key: Buffer) => {
        const fingerprint = crypto
          .createHash("sha256")
          .update(key)
          .digest("hex");
        return fingerprint === host.hostFingerprint;
      };
    }

    // Execute command
    return new Promise(resolve => {
      const client = new Client();
      let stdout = "";
      let stderr = "";
      let exitCode = -1;
      let timedOut = false;

      const timeoutHandle = setTimeout(() => {
        timedOut = true;
        client.end();
      }, timeout);

      client.on("ready", () => {
        // Build full command with working directory
        const fullCommand = workingDirectory
          ? `cd ${workingDirectory} && ${command}`
          : command;

        client.exec(fullCommand, (err, stream) => {
          if (err) {
            clearTimeout(timeoutHandle);
            client.end();

            this.logAudit(db, {
              hostId,
              userId,
              taskId,
              command,
              workingDirectory,
              status: "failed",
              clientIp,
            });

            resolve({
              success: false,
              stdout: "",
              stderr: err.message,
              exitCode: -1,
              durationMs: Date.now() - startTime,
              error: err.message,
            });
            return;
          }

          stream.on("close", (code: number) => {
            clearTimeout(timeoutHandle);
            exitCode = code;
            client.end();
          });

          stream.on("data", (data: Buffer) => {
            stdout += data.toString();
          });

          stream.stderr.on("data", (data: Buffer) => {
            stderr += data.toString();
          });
        });
      });

      client.on("close", async () => {
        const durationMs = Date.now() - startTime;
        const success = !timedOut && exitCode === 0;

        // Log the execution
        await this.logAudit(db, {
          hostId,
          userId,
          taskId,
          command,
          workingDirectory,
          stdout: stdout.substring(0, 65000), // Truncate for DB
          stderr: stderr.substring(0, 65000),
          exitCode,
          status: timedOut ? "timeout" : success ? "completed" : "failed",
          durationMs,
          clientIp,
        });

        // Update host last connected
        await db
          .update(sshHosts)
          .set({
            status: "online",
            lastConnectedAt: new Date(),
            lastTestResult: success ? "Success" : stderr || "Command failed",
          })
          .where(eq(sshHosts.id, hostId));

        resolve({
          success,
          stdout,
          stderr,
          exitCode,
          durationMs,
          error: timedOut ? "Command timed out" : undefined,
        });
      });

      client.on("error", async err => {
        clearTimeout(timeoutHandle);
        const durationMs = Date.now() - startTime;

        // Update host status
        await db
          .update(sshHosts)
          .set({
            status: "error",
            lastTestResult: err.message,
          })
          .where(eq(sshHosts.id, hostId));

        // Log the error
        await this.logAudit(db, {
          hostId,
          userId,
          taskId,
          command,
          workingDirectory,
          stderr: err.message,
          status: "failed",
          durationMs,
          clientIp,
        });

        resolve({
          success: false,
          stdout: "",
          stderr: err.message,
          exitCode: -1,
          durationMs,
          error: err.message,
        });
      });

      client.connect(connectConfig);
    });
  }

  /**
   * Test SSH connection to a host
   */
  async testConnection(
    hostId: number,
    userId: number
  ): Promise<{
    success: boolean;
    message: string;
    fingerprint?: string;
  }> {
    const db = await getDb();
    if (!db) {
      return { success: false, message: "Database not available" };
    }

    const [host] = await db
      .select()
      .from(sshHosts)
      .where(eq(sshHosts.id, hostId));
    if (!host || host.userId !== userId) {
      return { success: false, message: "Host not found or unauthorized" };
    }

    const [credential] = await db
      .select()
      .from(sshCredentials)
      .where(eq(sshCredentials.hostId, hostId));
    if (!credential) {
      return { success: false, message: "No credentials configured" };
    }

    const connectConfig: ConnectConfig = {
      host: host.hostname,
      port: host.port,
      username: host.username,
      readyTimeout: 15000,
    };

    if (
      host.authType === "key" &&
      credential.encryptedPrivateKey &&
      credential.encryptionIv
    ) {
      connectConfig.privateKey = decryptCredential(
        credential.encryptedPrivateKey,
        credential.encryptionIv
      );
      if (credential.encryptedPassword) {
        connectConfig.passphrase = decryptCredential(
          credential.encryptedPassword,
          credential.encryptionIv
        );
      }
    } else if (
      host.authType === "password" &&
      credential.encryptedPassword &&
      credential.encryptionIv
    ) {
      connectConfig.password = decryptCredential(
        credential.encryptedPassword,
        credential.encryptionIv
      );
    }

    return new Promise(resolve => {
      const client = new Client();
      let fingerprint: string | undefined;

      // Capture host key fingerprint
      connectConfig.hostVerifier = (key: Buffer) => {
        fingerprint = crypto.createHash("sha256").update(key).digest("hex");
        return true; // Accept for testing
      };

      client.on("ready", async () => {
        client.end();

        // Update host status
        await db
          .update(sshHosts)
          .set({
            status: "online",
            lastConnectedAt: new Date(),
            lastTestResult: "Connection successful",
            hostFingerprint: fingerprint,
          })
          .where(eq(sshHosts.id, hostId));

        resolve({
          success: true,
          message: "Connection successful",
          fingerprint,
        });
      });

      client.on("error", async err => {
        await db
          .update(sshHosts)
          .set({
            status: "error",
            lastTestResult: err.message,
          })
          .where(eq(sshHosts.id, hostId));

        resolve({
          success: false,
          message: err.message,
        });
      });

      client.connect(connectConfig);
    });
  }

  /**
   * Read a file from remote host
   */
  async readFile(
    hostId: number,
    userId: number,
    filePath: string,
    taskId?: number
  ): Promise<{ success: boolean; content?: string; error?: string }> {
    const result = await this.executeCommand(
      hostId,
      userId,
      `cat "${filePath}"`,
      { taskId }
    );

    if (result.success) {
      return { success: true, content: result.stdout };
    }
    return { success: false, error: result.stderr || result.error };
  }

  /**
   * Write a file to remote host
   */
  async writeFile(
    hostId: number,
    userId: number,
    filePath: string,
    content: string,
    taskId?: number
  ): Promise<{ success: boolean; error?: string }> {
    // Escape content for shell
    const escapedContent = content.replace(/'/g, "'\\''");
    const result = await this.executeCommand(
      hostId,
      userId,
      `echo '${escapedContent}' > "${filePath}"`,
      { taskId }
    );

    return { success: result.success, error: result.stderr || result.error };
  }

  /**
   * List directory contents
   */
  async listDirectory(
    hostId: number,
    userId: number,
    dirPath: string,
    taskId?: number
  ): Promise<{ success: boolean; files?: string[]; error?: string }> {
    const result = await this.executeCommand(
      hostId,
      userId,
      `ls -la "${dirPath}"`,
      { taskId }
    );

    if (result.success) {
      const files = result.stdout.split("\n").filter(line => line.trim());
      return { success: true, files };
    }
    return { success: false, error: result.stderr || result.error };
  }

  /**
   * Check if a command is allowed based on permissions
   */
  private checkPermissions(
    command: string,
    permissions?: SshPermission | null
  ): {
    allowed: boolean;
    reason?: string;
    requiresApproval?: boolean;
    approvalReason?: string;
    riskLevel?: "low" | "medium" | "high" | "critical";
  } {
    // Default: allow if no permissions configured
    if (!permissions) {
      return { allowed: true };
    }

    // Check blocked commands first
    const blockedCommands = permissions.blockedCommands || [];
    for (const blocked of blockedCommands) {
      if (this.commandMatches(command, blocked)) {
        return {
          allowed: false,
          reason: `Command matches blocked pattern: ${blocked}`,
        };
      }
    }

    // Check allowed commands (if whitelist is configured)
    const allowedCommands = permissions.allowedCommands || [];
    if (allowedCommands.length > 0) {
      const isAllowed = allowedCommands.some((allowed: string) =>
        this.commandMatches(command, allowed)
      );
      if (!isAllowed) {
        return { allowed: false, reason: "Command not in allowed list" };
      }
    }

    // Check if approval is required for all commands
    if (permissions.requireApprovalForAll) {
      return {
        allowed: true,
        requiresApproval: true,
        approvalReason: "All commands require approval for this host",
        riskLevel: "medium",
      };
    }

    // Check specific approval-required commands
    const approvalCommands = permissions.approvalRequiredCommands || [];
    for (const pattern of approvalCommands) {
      if (this.commandMatches(command, pattern)) {
        return {
          allowed: true,
          requiresApproval: true,
          approvalReason: `Command matches approval-required pattern: ${pattern}`,
          riskLevel: this.assessRiskLevel(command),
        };
      }
    }

    // Check for dangerous patterns (always require approval)
    const dangerousPatterns = [
      "rm -rf",
      "rm -r /",
      "dd if=",
      "mkfs",
      "> /dev/",
      "chmod -R 777",
      ":(){ :|:& };:",
      "shutdown",
      "reboot",
      "init 0",
      "init 6",
    ];

    for (const pattern of dangerousPatterns) {
      if (command.toLowerCase().includes(pattern.toLowerCase())) {
        return {
          allowed: true,
          requiresApproval: true,
          approvalReason: `Potentially dangerous command detected: ${pattern}`,
          riskLevel: "critical",
        };
      }
    }

    // Check sudo
    if (command.trim().startsWith("sudo") && !permissions.allowSudo) {
      return {
        allowed: true,
        requiresApproval: true,
        approvalReason: "Sudo commands require approval",
        riskLevel: "high",
      };
    }

    return { allowed: true };
  }

  /**
   * Check if command matches a pattern (supports wildcards)
   */
  private commandMatches(command: string, pattern: string): boolean {
    // Convert glob pattern to regex
    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    const regex = new RegExp(`^${regexPattern}$`, "i");
    return regex.test(command) || command.includes(pattern);
  }

  /**
   * Assess risk level of a command
   */
  private assessRiskLevel(
    command: string
  ): "low" | "medium" | "high" | "critical" {
    const cmd = command.toLowerCase();

    if (cmd.includes("rm -rf") || cmd.includes("dd ") || cmd.includes("mkfs")) {
      return "critical";
    }
    if (
      cmd.includes("sudo") ||
      cmd.includes("chmod") ||
      cmd.includes("chown")
    ) {
      return "high";
    }
    if (cmd.includes("rm ") || cmd.includes("mv ") || cmd.includes("cp ")) {
      return "medium";
    }
    return "low";
  }

  /**
   * Log command execution to audit log
   */
  private async logAudit(
    db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
    data: {
      hostId: number;
      userId: number;
      taskId?: number;
      command: string;
      workingDirectory?: string;
      stdout?: string;
      stderr?: string;
      exitCode?: number;
      status:
        | "pending"
        | "approved"
        | "rejected"
        | "running"
        | "completed"
        | "failed"
        | "timeout";
      approvalRequired?: boolean;
      durationMs?: number;
      clientIp?: string;
    }
  ): Promise<void> {
    await db.insert(sshAuditLog).values({
      hostId: data.hostId,
      userId: data.userId,
      taskId: data.taskId,
      command: data.command,
      workingDirectory: data.workingDirectory,
      stdout: data.stdout,
      stderr: data.stderr,
      exitCode: data.exitCode,
      status: data.status,
      approvalRequired: data.approvalRequired ? 1 : 0,
      durationMs: data.durationMs,
      clientIp: data.clientIp,
    });
  }
}

// Export singleton instance
export const sshManager = SSHConnectionManager.getInstance();

// ============================================================================
// Database Operations for SSH Hosts
// ============================================================================

/**
 * Create a new SSH host
 */
export async function createSshHost(
  userId: number,
  data: {
    name: string;
    hostname: string;
    port?: number;
    username: string;
    authType: "password" | "key";
    password?: string;
    privateKey?: string;
    passphrase?: string;
    description?: string;
    tags?: string[];
  }
): Promise<{ hostId: number }> {
  const db = await getDb();
  if (!db) {
    throw new Error("Database not available");
  }

  // Create host
  const [host] = await db
    .insert(sshHosts)
    .values({
      userId,
      name: data.name,
      hostname: data.hostname,
      port: data.port || 22,
      username: data.username,
      authType: data.authType,
      description: data.description,
      tags: data.tags,
      status: "unknown",
    })
    .$returningId();

  // Encrypt and store credentials
  const iv = crypto.randomBytes(16).toString("hex");

  let encryptedPrivateKey: string | undefined;
  let encryptedPassword: string | undefined;
  let keyType: string | undefined;

  if (data.authType === "key" && data.privateKey) {
    const encrypted = encryptCredential(data.privateKey);
    encryptedPrivateKey = encrypted.encrypted;
    keyType = data.privateKey.includes("RSA")
      ? "rsa"
      : data.privateKey.includes("ED25519")
        ? "ed25519"
        : "unknown";

    if (data.passphrase) {
      const encPass = encryptCredential(data.passphrase);
      encryptedPassword = encPass.encrypted;
    }
  } else if (data.authType === "password" && data.password) {
    const encrypted = encryptCredential(data.password);
    encryptedPassword = encrypted.encrypted;
  }

  await db.insert(sshCredentials).values({
    hostId: host.id,
    encryptedPrivateKey,
    encryptedPassword,
    encryptionIv: iv,
    keyType,
  });

  // Create default permissions
  await db.insert(sshPermissions).values({
    hostId: host.id,
    allowedPaths: ["/home/*", "/var/www/*", "/tmp/*"],
    blockedPaths: ["/etc/shadow", "/etc/passwd"],
    blockedCommands: ["rm -rf /", "dd if=/dev/zero"],
    approvalRequiredCommands: ["sudo *", "rm -rf *", "systemctl *"],
    requireApprovalForAll: 0,
    maxExecutionTime: 300,
    allowFileWrite: 1,
    allowFileDelete: 0,
    allowSudo: 0,
  });

  return { hostId: host.id };
}

/**
 * Get all SSH hosts for a user
 */
export async function getUserSshHosts(userId: number): Promise<SshHost[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(sshHosts)
    .where(eq(sshHosts.userId, userId))
    .orderBy(desc(sshHosts.updatedAt));
}

/**
 * Get SSH host by ID
 */
export async function getSshHost(
  hostId: number,
  userId: number
): Promise<SshHost | null> {
  const db = await getDb();
  if (!db) return null;

  const [host] = await db
    .select()
    .from(sshHosts)
    .where(and(eq(sshHosts.id, hostId), eq(sshHosts.userId, userId)));
  return host || null;
}

/**
 * Update SSH host
 */
export async function updateSshHost(
  hostId: number,
  userId: number,
  data: Partial<InsertSshHost>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(sshHosts)
    .set(data)
    .where(and(eq(sshHosts.id, hostId), eq(sshHosts.userId, userId)));
}

/**
 * Delete SSH host
 */
export async function deleteSshHost(
  hostId: number,
  userId: number
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Verify ownership
  const [host] = await db
    .select()
    .from(sshHosts)
    .where(and(eq(sshHosts.id, hostId), eq(sshHosts.userId, userId)));

  if (!host) {
    throw new Error("Host not found or unauthorized");
  }

  // Delete related records
  await db.delete(sshCredentials).where(eq(sshCredentials.hostId, hostId));
  await db.delete(sshPermissions).where(eq(sshPermissions.hostId, hostId));
  await db.delete(sshHosts).where(eq(sshHosts.id, hostId));
}

/**
 * Get host permissions
 */
export async function getHostPermissions(
  hostId: number
): Promise<SshPermission | null> {
  const db = await getDb();
  if (!db) return null;

  const [permissions] = await db
    .select()
    .from(sshPermissions)
    .where(eq(sshPermissions.hostId, hostId));
  return permissions || null;
}

/**
 * Update host permissions
 */
export async function updateHostPermissions(
  hostId: number,
  userId: number,
  data: Partial<InsertSshPermission>
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Verify ownership
  const [host] = await db
    .select()
    .from(sshHosts)
    .where(and(eq(sshHosts.id, hostId), eq(sshHosts.userId, userId)));

  if (!host) {
    throw new Error("Host not found or unauthorized");
  }

  await db
    .update(sshPermissions)
    .set(data)
    .where(eq(sshPermissions.hostId, hostId));
}

/**
 * Get audit log for a host
 */
export async function getHostAuditLog(
  hostId: number,
  userId: number,
  limit = 100
): Promise<(typeof sshAuditLog.$inferSelect)[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(sshAuditLog)
    .where(and(eq(sshAuditLog.hostId, hostId), eq(sshAuditLog.userId, userId)))
    .orderBy(desc(sshAuditLog.createdAt))
    .limit(limit);
}

/**
 * Approve a pending command
 */
export async function approvePendingCommand(
  approvalId: number,
  userId: number,
  modifiedCommand?: string
): Promise<{ success: boolean; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  const [approval] = await db
    .select()
    .from(pendingApprovals)
    .where(
      and(
        eq(pendingApprovals.id, approvalId),
        eq(pendingApprovals.userId, userId)
      )
    );

  if (!approval) {
    return { success: false, error: "Approval not found" };
  }

  if (approval.status !== "pending") {
    return { success: false, error: `Approval already ${approval.status}` };
  }

  if (approval.expiresAt && new Date(approval.expiresAt) < new Date()) {
    await db
      .update(pendingApprovals)
      .set({ status: "expired", resolvedAt: new Date() })
      .where(eq(pendingApprovals.id, approvalId));
    return { success: false, error: "Approval has expired" };
  }

  // Update approval status
  await db
    .update(pendingApprovals)
    .set({
      status: modifiedCommand ? "modified" : "approved",
      modifiedCommand,
      resolvedAt: new Date(),
    })
    .where(eq(pendingApprovals.id, approvalId));

  // Execute the command
  const commandToExecute = modifiedCommand || approval.command;
  const result = await sshManager.executeCommand(
    approval.hostId,
    userId,
    commandToExecute,
    {
      workingDirectory: approval.workingDirectory || undefined,
      taskId: approval.taskId || undefined,
    }
  );

  return { success: result.success, error: result.error };
}

/**
 * Reject a pending command
 */
export async function rejectPendingCommand(
  approvalId: number,
  userId: number,
  reason?: string
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db
    .update(pendingApprovals)
    .set({
      status: "rejected",
      rejectionReason: reason,
      resolvedAt: new Date(),
    })
    .where(
      and(
        eq(pendingApprovals.id, approvalId),
        eq(pendingApprovals.userId, userId)
      )
    );
}

/**
 * Get pending approvals for a user
 */
export async function getPendingApprovals(
  userId: number
): Promise<(typeof pendingApprovals.$inferSelect)[]> {
  const db = await getDb();
  if (!db) return [];

  return db
    .select()
    .from(pendingApprovals)
    .where(
      and(
        eq(pendingApprovals.userId, userId),
        eq(pendingApprovals.status, "pending")
      )
    )
    .orderBy(desc(pendingApprovals.createdAt));
}

/**
 * Verify host key and pin it
 */
export async function verifyAndPinHostKey(
  hostId: number,
  userId: number
): Promise<{ success: boolean; fingerprint?: string; error?: string }> {
  const db = await getDb();
  if (!db) return { success: false, error: "Database not available" };

  const result = await sshManager.testConnection(hostId, userId);

  if (result.success && result.fingerprint) {
    await db
      .update(sshHosts)
      .set({
        hostFingerprint: result.fingerprint,
        hostKeyVerified: 1,
      })
      .where(eq(sshHosts.id, hostId));

    return { success: true, fingerprint: result.fingerprint };
  }

  return { success: false, error: result.message };
}
