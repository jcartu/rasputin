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
