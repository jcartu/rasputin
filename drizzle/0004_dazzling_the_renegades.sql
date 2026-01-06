CREATE TABLE `agentSkills` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`triggerCondition` text NOT NULL,
	`pattern` text NOT NULL,
	`examples` json,
	`failures` json,
	`confidence` decimal(4,3) NOT NULL DEFAULT '0.5',
	`successCount` int NOT NULL DEFAULT 0,
	`failureCount` int NOT NULL DEFAULT 0,
	`category` varchar(64) DEFAULT 'general',
	`tags` json,
	`isActive` int NOT NULL DEFAULT 1,
	`sourceTaskId` int,
	`lastUsedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentSkills_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `pendingApprovals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`hostId` int NOT NULL,
	`taskId` int,
	`command` text NOT NULL,
	`workingDirectory` varchar(1024),
	`reason` text,
	`riskLevel` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`status` enum('pending','approved','rejected','expired','modified') NOT NULL DEFAULT 'pending',
	`modifiedCommand` text,
	`rejectionReason` text,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`resolvedAt` timestamp,
	CONSTRAINT `pendingApprovals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `selfModificationLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`modificationType` enum('tool_update','prompt_update','skill_add','skill_update','config_change','code_patch') NOT NULL,
	`target` varchar(512) NOT NULL,
	`description` text NOT NULL,
	`changeContent` text,
	`previousState` text,
	`reason` text,
	`success` int NOT NULL DEFAULT 1,
	`errorMessage` text,
	`benchmarkBefore` json,
	`benchmarkAfter` json,
	`rolledBack` int NOT NULL DEFAULT 0,
	`rolledBackAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `selfModificationLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sshAuditLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hostId` int NOT NULL,
	`userId` int NOT NULL,
	`taskId` int,
	`command` text NOT NULL,
	`workingDirectory` varchar(1024),
	`stdout` text,
	`stderr` text,
	`exitCode` int,
	`status` enum('pending','approved','rejected','running','completed','failed','timeout') NOT NULL DEFAULT 'pending',
	`approvalRequired` int NOT NULL DEFAULT 0,
	`approvedBy` int,
	`approvedAt` timestamp,
	`durationMs` int,
	`clientIp` varchar(64),
	`clientInfo` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sshAuditLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sshCredentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hostId` int NOT NULL,
	`encryptedPrivateKey` text,
	`encryptedPassword` text,
	`encryptionIv` varchar(64),
	`keyType` varchar(32),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sshCredentials_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sshHosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`hostname` varchar(255) NOT NULL,
	`port` int NOT NULL DEFAULT 22,
	`username` varchar(128) NOT NULL,
	`authType` enum('password','key') NOT NULL DEFAULT 'key',
	`status` enum('unknown','online','offline','error') NOT NULL DEFAULT 'unknown',
	`lastTestResult` text,
	`lastConnectedAt` timestamp,
	`hostFingerprint` varchar(128),
	`hostKeyVerified` int NOT NULL DEFAULT 0,
	`tags` json,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sshHosts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sshPermissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hostId` int NOT NULL,
	`allowedPaths` json,
	`blockedPaths` json,
	`allowedCommands` json,
	`blockedCommands` json,
	`approvalRequiredCommands` json,
	`requireApprovalForAll` int NOT NULL DEFAULT 0,
	`maxExecutionTime` int DEFAULT 300,
	`allowFileWrite` int NOT NULL DEFAULT 1,
	`allowFileDelete` int NOT NULL DEFAULT 0,
	`allowSudo` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sshPermissions_id` PRIMARY KEY(`id`)
);
