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
