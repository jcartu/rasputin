# RASPUTIN SSH Remote Execution - Consensus Architecture

**Author:** Manus AI  
**Date:** January 4, 2026  
**Version:** 2.0 (Post-Model Consensus Review)

---

## Executive Summary

After reviewing the initial SSH architecture with three frontier AI models (Gemini 2.5 Pro, Claude Sonnet 4, and Grok 3), a strong consensus emerged around several **critical changes** needed before implementation. This document presents the revised architecture incorporating their feedback.

---

## Model Consensus Summary

All three models identified the same core issues and converged on similar solutions:

| Issue                                         | Gemini 2.5 Pro | Claude Sonnet 4 | Grok 3      | Consensus                                |
| --------------------------------------------- | -------------- | --------------- | ----------- | ---------------------------------------- |
| **Centralized credentials are dangerous**     | ⚠️ Critical    | ⚠️ Critical     | ⚠️ Critical | **Use distributed agent model**          |
| **LLM writing raw shell commands is risky**   | ⚠️ Critical    | ⚠️ Critical     | ⚠️ High     | **Use semantic tools, not raw commands** |
| **Blacklist security is flawed**              | ⚠️ High        | ⚠️ High         | ⚠️ High     | **Whitelist-only, default-deny**         |
| **Connection pooling creates attack surface** | ⚠️ Medium      | ⚠️ High         | ⚠️ Medium   | **Use ephemeral connections**            |
| **Missing host key verification**             | ⚠️ High        | ⚠️ High         | ⚠️ High     | **Strict host key pinning**              |
| **No rate limiting**                          | ⚠️ Medium      | ⚠️ Medium       | ⚠️ Medium   | **Add per-user/host throttling**         |

---

## Revised Architecture

### The Distributed Agent Model

The most significant change is moving from **centralized SSH connections** to a **distributed agent model**. This is the industry standard used by GitHub Actions, GitLab Runners, and Ansible Tower.

```
┌─────────────────────────────────────────────────────────────────┐
│                    RASPUTIN Cloud Service                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    JARVIS Orchestrator                   │    │
│  │  • Receives natural language requests                    │    │
│  │  • Plans execution using semantic tools                  │    │
│  │  • Sends signed command intents to agents                │    │
│  └─────────────────────────────────────────────────────────┘    │
│                              │                                   │
│                    Secure WebSocket/HTTPS                        │
└──────────────────────────────┼──────────────────────────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│  User's       │    │  User's       │    │  User's       │
│  Network A    │    │  Network B    │    │  Network C    │
│               │    │               │    │               │
│ ┌───────────┐ │    │ ┌───────────┐ │    │ ┌───────────┐ │
│ │ RASPUTIN  │ │    │ │ RASPUTIN  │ │    │ │ RASPUTIN  │ │
│ │ Agent     │ │    │ │ Agent     │ │    │ │ Agent     │ │
│ └─────┬─────┘ │    │ └─────┬─────┘ │    │ └─────┬─────┘ │
│       │       │    │       │       │    │       │       │
│   SSH │       │    │   SSH │       │    │   SSH │       │
│       ▼       │    │       ▼       │    │       ▼       │
│ ┌───────────┐ │    │ ┌───────────┐ │    │ ┌───────────┐ │
│ │ Server 1  │ │    │ │ Server 2  │ │    │ │ Server 3  │ │
│ │ Server 2  │ │    │ │ Server 3  │ │    │ │ Server 4  │ │
│ └───────────┘ │    │ └───────────┘ │    │ └───────────┘ │
└───────────────┘    └───────────────┘    └───────────────┘
```

### Why This Is Better

| Aspect                 | Old (Centralized)                            | New (Distributed Agent)                              |
| ---------------------- | -------------------------------------------- | ---------------------------------------------------- |
| **Credential Storage** | RASPUTIN server stores all SSH keys          | Credentials stay in user's network                   |
| **Attack Surface**     | Server compromise = all users exposed        | Server compromise = can only send commands to agents |
| **Network Access**     | Users must whitelist RASPUTIN IPs            | Connections originate from inside user's network     |
| **Liability**          | RASPUTIN responsible for credential security | User controls their own credentials                  |
| **Firewall Friendly**  | Requires inbound SSH from cloud              | Agent makes outbound HTTPS only                      |

---

## Semantic Tools (Not Raw Commands)

Instead of letting the LLM write arbitrary shell commands, we define **semantic tools** that map to safe, parameterized operations.

### Bad (Original Design)

```typescript
// LLM generates raw shell commands - DANGEROUS
ssh_execute(host: "prod", command: "sudo systemctl restart nginx")
```

### Good (Revised Design)

```typescript
// LLM selects semantic tool with parameters - SAFE
service_manage(host: "prod", service: "nginx", action: "restart")
file_read(host: "prod", path: "/var/log/nginx/error.log", lines: 100)
git_deploy(host: "prod", repo: "/var/www/app", branch: "main")
```

### Semantic Tool Library

| Tool              | Parameters                                        | Underlying Command                      |
| ----------------- | ------------------------------------------------- | --------------------------------------- |
| `service_manage`  | host, service, action (start/stop/restart/status) | `systemctl {action} {service}`          |
| `file_read`       | host, path, lines, encoding                       | `tail -n {lines} {path}`                |
| `file_write`      | host, path, content, mode                         | Secure file write via SFTP              |
| `git_deploy`      | host, repo, branch, commands[]                    | `cd {repo} && git pull origin {branch}` |
| `process_list`    | host, filter                                      | `ps aux \| grep {filter}`               |
| `disk_usage`      | host, path                                        | `df -h {path}`                          |
| `log_tail`        | host, logfile, lines, follow                      | `tail -n {lines} {logfile}`             |
| `package_install` | host, package, manager                            | `{manager} install -y {package}`        |
| `docker_manage`   | host, container, action                           | `docker {action} {container}`           |

The agent validates that:

1. The tool is in the user's allowed list
2. Parameters match expected patterns
3. No shell injection is possible (parameters are escaped)

---

## Security Model (Revised)

### 1. Whitelist-Only, Default-Deny

```typescript
interface HostPermissions {
  // ONLY these tools are allowed - everything else is blocked
  allowedTools: {
    tool: string;
    allowedActions?: string[]; // e.g., ["restart", "status"] but not ["stop"]
    allowedPaths?: string[]; // e.g., ["/var/www/*", "/home/deploy/*"]
  }[];

  // Commands requiring explicit user confirmation
  requireConfirmation: string[]; // e.g., ["service_manage:restart", "docker_manage:rm"]

  // Resource limits
  limits: {
    maxConcurrentCommands: number;
    maxExecutionTimeSeconds: number;
    rateLimitPerMinute: number;
  };
}
```

### 2. Command Approval Workflow

For high-risk operations, JARVIS generates an **intent** that the user must approve:

```typescript
interface CommandIntent {
  id: string;
  reasoning: string; // Why JARVIS wants to do this
  plannedTools: ToolCall[]; // What it plans to execute
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  affectedResources: string[]; // Files, services, etc.
  estimatedDuration: string;
  rollbackPlan?: string; // How to undo if needed
}

// User reviews and approves
interface ApprovedExecution {
  intentId: string;
  approvedBy: string;
  approvedTools: ToolCall[]; // May be subset of planned
  expiresAt: Date; // Short-lived approval
  oneTimeUse: boolean; // Cannot be replayed
}
```

### 3. Ephemeral Connections (Not Pooled)

```typescript
class SecureSSHExecutor {
  async executeCommand(
    host: HostConfig,
    tool: ApprovedToolCall,
    credentials: TemporaryCredentials
  ): Promise<ExecutionResult> {
    // Create fresh connection for each operation
    const connection = await this.createConnection(host, credentials);

    try {
      // Validate host key against pinned fingerprint
      await this.verifyHostKey(connection, host.pinnedFingerprint);

      // Execute the semantic tool (not raw command)
      const command = this.buildSafeCommand(tool);
      const result = await this.execute(connection, command);

      // Audit log
      await this.auditLog(host, tool, result);

      return result;
    } finally {
      // Always close - no connection reuse
      await connection.close();
    }
  }
}
```

### 4. Host Key Pinning

```typescript
interface HostConfig {
  // ... other fields

  // SSH host key fingerprint - REQUIRED
  pinnedHostKeyFingerprint: string; // SHA256:xxxxx

  // Reject connection if key doesn't match
  strictHostKeyChecking: true;
}
```

When adding a host, the agent:

1. Connects and retrieves the host key
2. Displays fingerprint to user for verification
3. Stores pinned fingerprint
4. Rejects all future connections if fingerprint changes (MITM protection)

---

## The RASPUTIN Agent

A lightweight, self-hosted agent that users install in their network.

### Agent Responsibilities

1. **Receive signed command intents** from RASPUTIN cloud via secure WebSocket
2. **Validate signatures** to ensure commands came from legitimate RASPUTIN service
3. **Store credentials locally** (SSH keys, passwords) - never sent to cloud
4. **Execute semantic tools** on target hosts via SSH
5. **Stream results** back to RASPUTIN cloud
6. **Maintain audit log** locally for compliance

### Agent Installation

```bash
# One-line install (like Tailscale, Cloudflare Tunnel)
curl -fsSL https://rasputin.ai/install-agent.sh | sudo bash

# Or Docker
docker run -d \
  --name rasputin-agent \
  -v /path/to/ssh-keys:/keys:ro \
  -e RASPUTIN_TOKEN=your-agent-token \
  rasputin/agent:latest
```

### Agent Configuration

```yaml
# /etc/rasputin/agent.yaml
agent:
  token: "eyJ..." # Links agent to user's RASPUTIN account

hosts:
  - name: "prod-server"
    hostname: "192.168.1.100"
    port: 22
    username: "deploy"
    privateKeyPath: "/keys/prod.pem"
    pinnedHostKey: "SHA256:abc123..."

    permissions:
      allowedTools:
        - tool: "service_manage"
          allowedActions: ["restart", "status"]
        - tool: "git_deploy"
          allowedPaths: ["/var/www/myapp"]
        - tool: "log_tail"
          allowedPaths: ["/var/log/*"]

      requireConfirmation:
        - "service_manage:restart"

      limits:
        maxConcurrentCommands: 3
        maxExecutionTimeSeconds: 300
        rateLimitPerMinute: 30
```

---

## Implementation Phases (Revised)

### Phase 1: Agent Foundation (Week 1-2)

| Task                     | Description                                         |
| ------------------------ | --------------------------------------------------- |
| Agent binary             | Go/Rust binary for cross-platform support           |
| WebSocket connection     | Secure connection to RASPUTIN cloud                 |
| Command signing          | Ed25519 signatures for command verification         |
| Basic SSH execution      | Single-command execution with ephemeral connections |
| Local credential storage | Encrypted config file for SSH keys                  |

### Phase 2: Semantic Tools (Week 3-4)

| Task                   | Description                                                |
| ---------------------- | ---------------------------------------------------------- |
| Tool library           | Implement core semantic tools (service, file, git, docker) |
| Parameter validation   | Strict input validation and escaping                       |
| Permission enforcement | Whitelist checking before execution                        |
| Result streaming       | Real-time output back to UI                                |

### Phase 3: Safety & UX (Week 5-6)

| Task                  | Description                                         |
| --------------------- | --------------------------------------------------- |
| Confirmation workflow | UI for reviewing and approving high-risk operations |
| Host key pinning      | Fingerprint verification and MITM protection        |
| Audit logging         | Local + cloud audit trail                           |
| Agent management UI   | Add/remove/configure agents in RASPUTIN             |

### Phase 4: Advanced Features (Week 7-8)

| Task                   | Description                                     |
| ---------------------- | ----------------------------------------------- |
| Multi-host operations  | Execute across multiple hosts in parallel       |
| Deployment templates   | Pre-built workflows (git deploy, docker deploy) |
| Rollback support       | Undo last operation                             |
| Monitoring integration | Health checks, alerts                           |

---

## Example Workflows (Revised)

### Deploy Application

```
User: "Deploy the latest code to staging"

JARVIS analyzes and creates intent:
┌─────────────────────────────────────────────────────────────┐
│ Deployment Plan for staging-server                          │
├─────────────────────────────────────────────────────────────┤
│ Risk Level: MEDIUM                                          │
│                                                             │
│ Steps:                                                      │
│ 1. git_deploy(repo: "/var/www/app", branch: "main")        │
│ 2. file_read(path: "/var/www/app/package.json") [verify]   │
│ 3. service_manage(service: "myapp", action: "restart") ⚠️   │
│                                                             │
│ Affected: /var/www/app, myapp service                       │
│ Estimated time: 2-3 minutes                                 │
│                                                             │
│                              [Cancel]  [Approve & Execute]  │
└─────────────────────────────────────────────────────────────┘

User clicks [Approve & Execute]

Agent executes:
1. ✓ cd /var/www/app && git pull origin main
2. ✓ Read package.json - version 2.3.1
3. ✓ systemctl restart myapp

JARVIS: "Deployed v2.3.1 to staging. Service restarted successfully."
```

### Debug Production Issue

```
User: "Why is my API returning 500 errors?"

JARVIS (no confirmation needed for read-only):
1. log_tail(host: "prod", logfile: "/var/log/myapp/error.log", lines: 100)
2. disk_usage(host: "prod", path: "/")
3. process_list(host: "prod", filter: "myapp")

JARVIS: "Found the issue. Error logs show 'ENOSPC: no space left on device'.
Your root partition is 98% full. The /var/log directory is consuming 45GB.

Would you like me to:
1. Rotate and compress old logs (safe)
2. Delete logs older than 30 days (requires confirmation)"
```

---

## Security Checklist

Before going live, verify:

- [ ] Agent binary is signed and verified on install
- [ ] All commands are signed with Ed25519
- [ ] Credentials never leave user's network
- [ ] Host key pinning is enforced
- [ ] Whitelist-only permissions (no blacklists)
- [ ] Rate limiting is active
- [ ] Audit logs are immutable
- [ ] Confirmation workflow for destructive operations
- [ ] Session tokens are short-lived
- [ ] Agent auto-updates for security patches

---

## Conclusion

The revised architecture addresses all critical security concerns raised by the frontier models:

1. **Credentials stay local** - The distributed agent model means SSH keys never leave the user's network
2. **Semantic tools prevent injection** - LLM selects tools, doesn't write shell code
3. **Default-deny security** - Whitelist-only permissions
4. **Ephemeral connections** - No persistent connection pool to exploit
5. **Host key pinning** - MITM protection
6. **Approval workflow** - Human in the loop for risky operations

This architecture follows industry best practices used by GitHub Actions, GitLab CI, and enterprise infrastructure tools.
