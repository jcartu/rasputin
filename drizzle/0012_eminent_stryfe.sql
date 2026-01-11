CREATE TABLE `asyncTaskLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`level` enum('debug','info','warn','error') NOT NULL,
	`message` text NOT NULL,
	`data` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `asyncTaskLogs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `asyncTaskQueue` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`taskType` enum('jarvis_task','agent_team','deep_research','code_generation','document_generation','scheduled_task','webhook_task','custom') NOT NULL,
	`status` enum('queued','running','completed','failed','cancelled','paused') NOT NULL DEFAULT 'queued',
	`priority` int NOT NULL DEFAULT 5,
	`prompt` text NOT NULL,
	`input` json,
	`result` text,
	`error` text,
	`progress` int NOT NULL DEFAULT 0,
	`progressMessage` varchar(500),
	`retryCount` int NOT NULL DEFAULT 0,
	`maxRetries` int NOT NULL DEFAULT 3,
	`webhookUrl` varchar(1000),
	`webhookDelivered` boolean DEFAULT false,
	`webhookDeliveredAt` timestamp,
	`workerId` varchar(100),
	`startedAt` timestamp,
	`completedAt` timestamp,
	`estimatedDurationMs` int,
	`actualDurationMs` int,
	`tokensUsed` int DEFAULT 0,
	`cost` decimal(10,6) DEFAULT '0',
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`scheduledFor` timestamp,
	`expiresAt` timestamp,
	CONSTRAINT `asyncTaskQueue_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dynamic_agent_types` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`type_name` varchar(50) NOT NULL,
	`display_name` varchar(100),
	`system_prompt` text NOT NULL,
	`capabilities` json,
	`tool_restrictions` json,
	`proposed_reason` text,
	`trigger_patterns` json,
	`usage_count` int NOT NULL DEFAULT 0,
	`success_rate` decimal(5,2),
	`is_active` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dynamic_agent_types_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `dynamic_tools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text NOT NULL,
	`parameters` json NOT NULL,
	`implementation` text NOT NULL,
	`test_cases` json,
	`is_active` int NOT NULL DEFAULT 1,
	`usage_count` int NOT NULL DEFAULT 0,
	`last_used_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `dynamic_tools_id` PRIMARY KEY(`id`)
);
