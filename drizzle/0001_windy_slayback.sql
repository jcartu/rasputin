CREATE TABLE `chats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'New Chat',
	`mode` enum('consensus','synthesis') NOT NULL DEFAULT 'consensus',
	`speedTier` enum('fast','normal','max') NOT NULL DEFAULT 'normal',
	`selectedModels` json,
	`messageCount` int NOT NULL DEFAULT 0,
	`totalTokens` int NOT NULL DEFAULT 0,
	`totalCost` decimal(10,6) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chatId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`summary` text,
	`agreementPercentage` int,
	`latencyMs` int,
	`tokenCount` int,
	`cost` decimal(10,6),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `modelResponses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`modelId` varchar(128) NOT NULL,
	`modelName` varchar(128) NOT NULL,
	`content` text NOT NULL,
	`status` enum('pending','streaming','completed','error') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`latencyMs` int,
	`inputTokens` int,
	`outputTokens` int,
	`cost` decimal(10,6),
	`provider` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `modelResponses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `synthesisPipelineStages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`messageId` int NOT NULL,
	`stageName` varchar(64) NOT NULL,
	`stageOrder` int NOT NULL,
	`status` enum('pending','running','completed','error') NOT NULL DEFAULT 'pending',
	`output` text,
	`durationMs` int,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `synthesisPipelineStages_id` PRIMARY KEY(`id`)
);
