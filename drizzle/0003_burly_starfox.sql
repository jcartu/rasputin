CREATE TABLE `agentFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`userId` int NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`filePath` text NOT NULL,
	`mimeType` varchar(128),
	`fileSize` bigint,
	`source` enum('upload','generated') NOT NULL DEFAULT 'generated',
	`s3Url` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`toolCalls` json,
	`thinking` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'New Task',
	`query` text NOT NULL,
	`status` enum('idle','running','completed','failed','cancelled') NOT NULL DEFAULT 'idle',
	`result` text,
	`errorMessage` text,
	`iterationCount` int NOT NULL DEFAULT 0,
	`totalTokens` int NOT NULL DEFAULT 0,
	`totalCost` decimal(10,6) NOT NULL DEFAULT '0',
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `agentTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agentToolCalls` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`messageId` int,
	`toolName` varchar(64) NOT NULL,
	`input` json NOT NULL,
	`output` text,
	`status` enum('pending','running','completed','error') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`durationMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `agentToolCalls_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduledTaskRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduledTaskId` int NOT NULL,
	`agentTaskId` int,
	`status` enum('running','success','failed','skipped') NOT NULL,
	`result` text,
	`errorMessage` text,
	`durationMs` int,
	`voiceGenerated` int NOT NULL DEFAULT 0,
	`scheduledAt` timestamp NOT NULL,
	`startedAt` timestamp,
	`completedAt` timestamp,
	CONSTRAINT `scheduledTaskRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduledTasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`prompt` text NOT NULL,
	`scheduleType` enum('once','daily','weekly','monthly','cron') NOT NULL DEFAULT 'once',
	`cronExpression` varchar(100),
	`timeOfDay` varchar(5),
	`dayOfWeek` int,
	`dayOfMonth` int,
	`timezone` varchar(64) NOT NULL DEFAULT 'UTC',
	`speakResults` int NOT NULL DEFAULT 0,
	`voiceId` varchar(64),
	`enabled` int NOT NULL DEFAULT 1,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`lastRunStatus` enum('success','failed','skipped'),
	`lastRunResult` text,
	`runCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduledTasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `usageTracking` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`date` varchar(10) NOT NULL,
	`agentTaskCount` int NOT NULL DEFAULT 0,
	`consensusQueryCount` int NOT NULL DEFAULT 0,
	`synthesisQueryCount` int NOT NULL DEFAULT 0,
	`totalApiCalls` int NOT NULL DEFAULT 0,
	`totalTokens` bigint NOT NULL DEFAULT 0,
	`totalCost` decimal(10,6) NOT NULL DEFAULT '0',
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `usageTracking_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspaceCommits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`commitHash` varchar(64) NOT NULL,
	`message` text NOT NULL,
	`authorName` varchar(255),
	`authorEmail` varchar(320),
	`filesChanged` int DEFAULT 0,
	`insertions` int DEFAULT 0,
	`deletions` int DEFAULT 0,
	`parentHash` varchar(64),
	`isCheckpoint` int NOT NULL DEFAULT 0,
	`checkpointName` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workspaceCommits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspaceFiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`filePath` varchar(1024) NOT NULL,
	`fileName` varchar(255) NOT NULL,
	`isDirectory` int NOT NULL DEFAULT 0,
	`fileSize` bigint DEFAULT 0,
	`mimeType` varchar(128),
	`contentHash` varchar(64),
	`lastModified` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workspaceFiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspaceProcesses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workspaceId` int NOT NULL,
	`processType` enum('dev-server','build','test','shell','custom') NOT NULL DEFAULT 'shell',
	`pid` int,
	`command` text NOT NULL,
	`workingDir` text,
	`status` enum('starting','running','stopped','crashed') NOT NULL DEFAULT 'starting',
	`exitCode` int,
	`port` int,
	`cpuUsage` decimal(5,2),
	`memoryUsageMb` int,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`stoppedAt` timestamp,
	CONSTRAINT `workspaceProcesses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workspaceTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`templateId` varchar(64) NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(64) NOT NULL DEFAULT 'general',
	`icon` varchar(64) DEFAULT 'folder',
	`setupConfig` json,
	`isSystem` int NOT NULL DEFAULT 1,
	`sortOrder` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workspaceTemplates_id` PRIMARY KEY(`id`),
	CONSTRAINT `workspaceTemplates_templateId_unique` UNIQUE(`templateId`)
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`template` varchar(64) NOT NULL DEFAULT 'blank',
	`status` enum('creating','ready','running','stopped','error','deleted') NOT NULL DEFAULT 'creating',
	`basePath` text NOT NULL,
	`containerId` varchar(128),
	`containerStatus` enum('none','creating','running','stopped','error') NOT NULL DEFAULT 'none',
	`devServerPort` int,
	`devServerUrl` text,
	`gitInitialized` int NOT NULL DEFAULT 0,
	`gitBranch` varchar(128) DEFAULT 'main',
	`lastCommitHash` varchar(64),
	`lastCommitMessage` text,
	`cpuLimit` decimal(4,2) DEFAULT '2.00',
	`memoryLimitMb` int DEFAULT 2048,
	`diskLimitMb` int DEFAULT 5120,
	`diskUsageMb` int DEFAULT 0,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastAccessedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workspaces_id` PRIMARY KEY(`id`)
);
