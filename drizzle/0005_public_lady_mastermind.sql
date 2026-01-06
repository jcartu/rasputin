CREATE TABLE `episodicMemories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`taskId` int,
	`memoryType` enum('task_success','task_failure','user_preference','system_discovery','error_resolution','optimization','interaction') NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`context` text,
	`action` text,
	`outcome` text,
	`lessons` json,
	`entities` json,
	`tags` json,
	`importance` int NOT NULL DEFAULT 50,
	`accessCount` int NOT NULL DEFAULT 0,
	`lastAccessedAt` timestamp,
	`embeddingId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `episodicMemories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `learningEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`taskId` int,
	`eventType` enum('new_knowledge','skill_acquired','skill_improved','error_learned','preference_learned','pattern_detected','feedback_received') NOT NULL,
	`summary` text NOT NULL,
	`content` json,
	`confidence` int NOT NULL DEFAULT 70,
	`applied` int NOT NULL DEFAULT 0,
	`impactScore` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `learningEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memoryAccessLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`memoryType` enum('episodic','semantic','procedural') NOT NULL,
	`memoryId` int NOT NULL,
	`taskId` int,
	`query` text,
	`relevanceScore` decimal(5,4),
	`wasUseful` int,
	`accessedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memoryAccessLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memoryEmbeddings` (
	`id` varchar(64) NOT NULL,
	`memoryType` enum('episodic','semantic','procedural') NOT NULL,
	`memoryId` int NOT NULL,
	`sourceText` text NOT NULL,
	`model` varchar(128) NOT NULL,
	`dimensions` int NOT NULL,
	`vector` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memoryEmbeddings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `proceduralMemories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`name` varchar(255) NOT NULL,
	`description` text NOT NULL,
	`triggerConditions` json,
	`prerequisites` json,
	`steps` json NOT NULL,
	`postConditions` json,
	`errorHandlers` json,
	`successRate` int NOT NULL DEFAULT 100,
	`executionCount` int NOT NULL DEFAULT 0,
	`successCount` int NOT NULL DEFAULT 0,
	`avgExecutionTimeMs` int,
	`relatedProcedures` json,
	`sourceTaskId` int,
	`isActive` int NOT NULL DEFAULT 1,
	`embeddingId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `proceduralMemories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `semanticMemories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`category` enum('system_info','user_info','domain_knowledge','api_info','file_structure','configuration','relationship','definition') NOT NULL,
	`subject` varchar(255) NOT NULL,
	`predicate` varchar(128) NOT NULL,
	`object` text NOT NULL,
	`confidence` int NOT NULL DEFAULT 80,
	`source` varchar(255),
	`sourceTaskId` int,
	`isValid` int NOT NULL DEFAULT 1,
	`lastVerifiedAt` timestamp,
	`expiresAt` timestamp,
	`accessCount` int NOT NULL DEFAULT 0,
	`embeddingId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `semanticMemories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `trainingData` (
	`id` int AUTO_INCREMENT NOT NULL,
	`taskId` int NOT NULL,
	`dataType` enum('conversation','tool_usage','reasoning','code_generation','error_recovery') NOT NULL,
	`input` text NOT NULL,
	`output` text NOT NULL,
	`qualityScore` int NOT NULL DEFAULT 80,
	`usedForTraining` int NOT NULL DEFAULT 0,
	`trainingRunId` varchar(64),
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `trainingData_id` PRIMARY KEY(`id`)
);
