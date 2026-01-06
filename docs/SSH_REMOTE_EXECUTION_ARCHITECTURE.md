# RASPUTIN Remote SSH Execution Architecture

**Author:** Manus AI  
**Date:** January 4, 2026  
**Version:** 1.0

---

## Executive Summary

This document outlines the architecture for extending RASPUTIN's JARVIS Agent with **remote SSH execution capabilities**. This feature will allow users to connect JARVIS to their own servers, development machines, or cloud instances and execute commands via natural language. The system transforms JARVIS from a sandboxed AI assistant into a **self-hosted DevOps agent** with real system access.

---

## 1. System Overview

### 1.1 Current State

JARVIS currently operates within a sandboxed environment with access to:

| Capability         | Current Implementation          |
| ------------------ | ------------------------------- |
| Code Execution     | Local Python/Node.js in sandbox |
| File Operations    | Local filesystem only           |
| Web Search         | Via Perplexity API              |
| Image Generation   | Via internal ImageService       |
| Browser Automation | Headless Chromium in sandbox    |

### 1.2 Target State

The enhanced JARVIS will gain the ability to:

| Capability               | New Implementation                          |
| ------------------------ | ------------------------------------------- |
| Remote Shell             | SSH connections to registered hosts         |
| Remote File Ops          | Read/write files on remote systems          |
| Remote Execution         | Run scripts and commands remotely           |
| Multi-Host Orchestration | Coordinate actions across multiple machines |
| Deployment Pipelines     | Git pull, build, deploy workflows           |

---

## 2. Architecture Components

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      RASPUTIN Web Interface                      │
├─────────────────────────────────────────────────────────────────┤
│                         JARVIS Agent                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Orchestrator│  │ Tool Router │  │ Context Manager         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                        Tool Layer                                │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────────┐   │
│  │ Web      │ │ Code     │ │ Image    │ │ SSH Remote        │   │
│  │ Search   │ │ Execute  │ │ Generate │ │ Execution (NEW)   │   │
│  └──────────┘ └──────────┘ └──────────┘ └───────────────────┘   │
├─────────────────────────────────────────────────────────────────┤
│                    SSH Connection Manager                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Connection  │  │ Session     │  │ Credential              │  │
│  │ Pool        │  │ Manager     │  │ Vault                   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│                      Remote Hosts                                │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐        │
│  │ Server 1 │  │ Server 2 │  │ Dev Box  │  │ Cloud VM │        │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Core Components

#### 2.2.1 SSH Connection Manager

The SSH Connection Manager handles all aspects of remote connectivity:

**Connection Pool**: Maintains persistent SSH connections to reduce latency. Connections are kept alive with heartbeats and automatically reconnected on failure.

**Session Manager**: Tracks active shell sessions per host, allowing JARVIS to maintain context (current directory, environment variables) across multiple commands.

**Credential Vault**: Securely stores SSH credentials (private keys, passwords) encrypted at rest using the user's master key.

#### 2.2.2 Host Registry

The Host Registry is a database table storing registered remote machines:

```typescript
// Database Schema
export const sshHosts = mysqlTable("sshHosts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),

  // Host identification
  name: varchar("name", { length: 128 }).notNull(),
  hostname: varchar("hostname", { length: 255 }).notNull(),
  port: int("port").notNull().default(22),

  // Authentication
  username: varchar("username", { length: 64 }).notNull(),
  authType: mysqlEnum("authType", ["key", "password"]).notNull(),
  privateKeyId: int("privateKeyId"), // Reference to encrypted key

  // Permissions & Scope
  allowedPaths: json("allowedPaths").$type<string[]>(),
  allowedCommands: json("allowedCommands").$type<string[]>(),
  requireConfirmation: json("requireConfirmation").$type<string[]>(),

  // Metadata
  description: text("description"),
  tags: json("tags").$type<string[]>(),
  lastConnected: timestamp("lastConnected"),
  status: mysqlEnum("status", ["active", "inactive", "error"]).default(
    "active"
  ),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

#### 2.2.3 SSH Credential Storage

Credentials are stored encrypted in a separate table:

```typescript
export const sshCredentials = mysqlTable("sshCredentials", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),

  name: varchar("name", { length: 128 }).notNull(),
  type: mysqlEnum("type", ["private_key", "password"]).notNull(),

  // Encrypted with user's master key (derived from their auth)
  encryptedValue: text("encryptedValue").notNull(),

  // Key metadata (for SSH keys)
  keyType: varchar("keyType", { length: 32 }), // rsa, ed25519, etc.
  keyFingerprint: varchar("keyFingerprint", { length: 128 }),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

---

## 3. Security Model

### 3.1 Authentication Flow

```
User adds new host → Enter credentials → Encrypt with master key →
Store in vault → Test connection → Host registered
```

The master key is derived from the user's authentication session and never stored directly. This means:

- Credentials are only decryptable when the user is logged in
- Server compromise without active session cannot expose credentials
- Each user's credentials are isolated

### 3.2 Permission Scopes

Each registered host can have granular permissions:

| Permission            | Description                    | Example                                     |
| --------------------- | ------------------------------ | ------------------------------------------- |
| `allowedPaths`        | Directories JARVIS can access  | `["/home/user", "/var/www"]`                |
| `allowedCommands`     | Whitelisted command patterns   | `["git *", "npm *", "systemctl restart *"]` |
| `blockedCommands`     | Explicitly forbidden commands  | `["rm -rf /", "dd if=*"]`                   |
| `requireConfirmation` | Commands needing user approval | `["sudo *", "systemctl *", "docker rm *"]`  |
| `maxExecutionTime`    | Timeout for commands           | `300` (seconds)                             |

### 3.3 Confirmation Workflow

For sensitive operations, JARVIS will pause and request user confirmation:

```
User: "Restart the nginx service on my production server"

JARVIS: "I'm about to run the following command on 'prod-server':

         sudo systemctl restart nginx

         This will briefly interrupt web traffic. Proceed? [Confirm] [Cancel]"
```

### 3.4 Audit Logging

Every remote command is logged:

```typescript
export const sshAuditLog = mysqlTable("sshAuditLog", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  hostId: int("hostId").notNull(),
  taskId: int("taskId"), // Link to JARVIS task

  command: text("command").notNull(),
  workingDirectory: varchar("workingDirectory", { length: 512 }),

  exitCode: int("exitCode"),
  stdout: text("stdout"),
  stderr: text("stderr"),

  executionTimeMs: int("executionTimeMs"),
  confirmedByUser: boolean("confirmedByUser").default(false),

  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
```

---

## 4. JARVIS Tool Implementation

### 4.1 New SSH Tools

JARVIS will gain these new tools:

#### `ssh_execute`

Execute a command on a remote host.

```typescript
{
  name: "ssh_execute",
  description: "Execute a shell command on a registered remote host",
  parameters: {
    host: "string - Name or ID of the registered host",
    command: "string - The shell command to execute",
    workingDirectory: "string (optional) - Directory to run command in",
    timeout: "number (optional) - Max execution time in seconds"
  }
}
```

#### `ssh_read_file`

Read a file from a remote host.

```typescript
{
  name: "ssh_read_file",
  description: "Read the contents of a file on a remote host",
  parameters: {
    host: "string - Name or ID of the registered host",
    path: "string - Absolute path to the file",
    encoding: "string (optional) - File encoding, default utf-8"
  }
}
```

#### `ssh_write_file`

Write content to a file on a remote host.

```typescript
{
  name: "ssh_write_file",
  description: "Write content to a file on a remote host",
  parameters: {
    host: "string - Name or ID of the registered host",
    path: "string - Absolute path to the file",
    content: "string - Content to write",
    mode: "string (optional) - File permissions (e.g., '644')"
  }
}
```

#### `ssh_list_hosts`

List all registered hosts for the current user.

```typescript
{
  name: "ssh_list_hosts",
  description: "List all registered SSH hosts",
  parameters: {}
}
```

### 4.2 Tool Execution Flow

```
1. User: "Deploy the latest code to my staging server"

2. JARVIS Orchestrator analyzes request:
   - Identifies target: "staging server" → resolves to host "staging-01"
   - Plans actions: git pull, npm install, pm2 restart

3. JARVIS calls ssh_execute:
   - host: "staging-01"
   - command: "cd /var/www/app && git pull origin main"

4. SSH Connection Manager:
   - Retrieves host config from registry
   - Decrypts credentials from vault
   - Checks command against permissions
   - Executes via SSH
   - Logs to audit trail

5. JARVIS receives output, continues with next step...
```

---

## 5. User Interface

### 5.1 Host Management Page

A new section in RASPUTIN for managing SSH hosts:

```
┌─────────────────────────────────────────────────────────────────┐
│  SSH Hosts                                        [+ Add Host]  │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🟢 prod-server                                          │   │
│  │    ubuntu@192.168.1.100:22                              │   │
│  │    Last connected: 2 hours ago                          │   │
│  │    [Edit] [Test] [Logs] [Delete]                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🟢 staging-01                                           │   │
│  │    deploy@staging.example.com:22                        │   │
│  │    Last connected: 5 minutes ago                        │   │
│  │    [Edit] [Test] [Logs] [Delete]                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 🔴 dev-box                                              │   │
│  │    user@192.168.1.50:22                                 │   │
│  │    Status: Connection refused                           │   │
│  │    [Edit] [Test] [Logs] [Delete]                        │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Add Host Dialog

```
┌─────────────────────────────────────────────────────────────────┐
│  Add SSH Host                                              [X]  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Host Name:     [staging-server________________]                │
│  Hostname/IP:   [staging.example.com___________]                │
│  Port:          [22___]                                         │
│  Username:      [deploy_______________________]                 │
│                                                                 │
│  Authentication:                                                │
│  ○ SSH Key   ● Password                                         │
│                                                                 │
│  [Select Private Key ▼] or [Enter Password: ••••••••]          │
│                                                                 │
│  ─── Permissions (Advanced) ───────────────────────────────     │
│                                                                 │
│  Allowed Paths:    [/home/deploy, /var/www_____]               │
│  Require Confirm:  [sudo *, systemctl *________]               │
│                                                                 │
│                              [Test Connection]  [Save Host]     │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Command Confirmation Modal

```
┌─────────────────────────────────────────────────────────────────┐
│  ⚠️  Confirm Remote Command                                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  JARVIS wants to execute the following command:                 │
│                                                                 │
│  Host: prod-server (ubuntu@192.168.1.100)                      │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ sudo systemctl restart nginx                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ⚠️  This command matches your "require confirmation" rules.    │
│                                                                 │
│                                    [Cancel]  [Execute Command]  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Implementation Phases

### Phase 1: Foundation (Week 1-2)

| Task                   | Description                                               | Priority |
| ---------------------- | --------------------------------------------------------- | -------- |
| Database schema        | Create sshHosts, sshCredentials, sshAuditLog tables       | High     |
| Credential encryption  | Implement secure key storage with user-derived encryption | High     |
| SSH client library     | Integrate ssh2 npm package with connection pooling        | High     |
| Basic ssh_execute tool | Single command execution with output capture              | High     |

### Phase 2: Core Features (Week 3-4)

| Task                  | Description                                | Priority |
| --------------------- | ------------------------------------------ | -------- |
| Host management UI    | Add/edit/delete hosts with test connection | High     |
| Permission system     | Implement allowedPaths, blockedCommands    | High     |
| Confirmation workflow | Modal for sensitive commands               | High     |
| File operations       | ssh_read_file, ssh_write_file tools        | Medium   |
| Audit logging         | Log all commands with full context         | High     |

### Phase 3: Advanced Features (Week 5-6)

| Task                  | Description                                | Priority |
| --------------------- | ------------------------------------------ | -------- |
| Session persistence   | Maintain working directory across commands | Medium   |
| Multi-host operations | Execute on multiple hosts in parallel      | Medium   |
| Deployment templates  | Pre-built workflows for common deployments | Low      |
| Host groups           | Organize hosts by environment/purpose      | Low      |

### Phase 4: Polish & Security Audit (Week 7-8)

| Task                     | Description                           | Priority |
| ------------------------ | ------------------------------------- | -------- |
| Security review          | Penetration testing, credential audit | Critical |
| Error handling           | Graceful failures, retry logic        | High     |
| Documentation            | User guide, security best practices   | Medium   |
| Performance optimization | Connection pooling, command batching  | Medium   |

---

## 7. Technical Dependencies

### 7.1 NPM Packages

```json
{
  "ssh2": "^1.15.0", // SSH client
  "ssh2-sftp-client": "^9.1.0", // SFTP operations
  "node-forge": "^1.3.1" // Encryption utilities
}
```

### 7.2 Infrastructure Requirements

The RASPUTIN server needs:

- Outbound SSH access (port 22 by default, configurable)
- Sufficient memory for connection pool (estimate 10MB per active connection)
- Secure storage for encrypted credentials

---

## 8. Security Considerations

### 8.1 Threat Model

| Threat               | Mitigation                                   |
| -------------------- | -------------------------------------------- |
| Credential theft     | Encryption at rest, session-bound decryption |
| Command injection    | Input sanitization, command whitelisting     |
| Privilege escalation | Permission scopes, confirmation for sudo     |
| Audit evasion        | Immutable audit logs, real-time streaming    |
| Session hijacking    | Short-lived tokens, IP binding               |

### 8.2 Best Practices for Users

1. **Use SSH keys** instead of passwords when possible
2. **Create dedicated users** for JARVIS with limited sudo access
3. **Define narrow permission scopes** - only allow paths/commands needed
4. **Enable confirmation** for all destructive operations
5. **Review audit logs** regularly
6. **Rotate credentials** periodically

---

## 9. Example Use Cases

### 9.1 Deploy a Web Application

```
User: "Deploy the latest version of my app to staging"

JARVIS:
1. ssh_execute(staging, "cd /var/www/myapp && git fetch origin")
2. ssh_execute(staging, "git checkout main && git pull")
3. ssh_execute(staging, "npm ci --production")
4. ssh_execute(staging, "npm run build")
5. [Confirmation required] ssh_execute(staging, "sudo systemctl restart myapp")

"Deployment complete. The app is now running version 2.3.1 on staging."
```

### 9.2 Debug a Production Issue

```
User: "Check why my API is returning 500 errors on production"

JARVIS:
1. ssh_execute(prod, "tail -100 /var/log/myapp/error.log")
2. ssh_execute(prod, "df -h")  // Check disk space
3. ssh_execute(prod, "free -m") // Check memory
4. ssh_execute(prod, "systemctl status myapp")

"I found the issue. The error logs show 'ENOSPC: no space left on device'.
Your /var partition is 98% full. Would you like me to clean up old log files?"
```

### 9.3 Set Up a New Server

```
User: "Set up my new Ubuntu server for Node.js development"

JARVIS:
1. ssh_execute(new-server, "sudo apt update && sudo apt upgrade -y")
2. ssh_execute(new-server, "curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -")
3. ssh_execute(new-server, "sudo apt install -y nodejs")
4. ssh_execute(new-server, "sudo npm install -g pm2")
5. ssh_execute(new-server, "node --version && npm --version && pm2 --version")

"Server setup complete. Installed Node.js v20.10.0, npm v10.2.3, and PM2 v5.3.0."
```

---

## 10. Conclusion

The SSH Remote Execution feature transforms RASPUTIN from a sandboxed AI assistant into a powerful DevOps agent capable of managing real infrastructure. By implementing robust security controls (encryption, permissions, confirmations, audit logging), we can provide this powerful capability while maintaining user trust and system safety.

The phased implementation approach allows for iterative development and security review at each stage, ensuring a production-ready feature that users can confidently deploy to manage their servers.

---

## References

- [ssh2 npm package](https://www.npmjs.com/package/ssh2) - SSH client for Node.js
- [OWASP Secure Coding Practices](https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/) - Security guidelines
- [OpenSSH Best Practices](https://www.ssh.com/academy/ssh/security) - SSH security recommendations
