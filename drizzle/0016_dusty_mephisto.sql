CREATE TABLE `consensusVoteLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`proposalId` varchar(64) NOT NULL,
	`taskId` bigint,
	`question` text NOT NULL,
	`agentType` enum('planner','coder','executor','verifier','researcher','learner','safety') NOT NULL,
	`vote` enum('approve','reject','abstain') NOT NULL,
	`confidence` decimal(3,2) NOT NULL DEFAULT '0.50',
	`reasoning` text,
	`decision` enum('approved','rejected','timeout','insufficient'),
	`agreementPercentage` decimal(5,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `consensusVoteLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `swarmAgentMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`agentType` enum('planner','coder','executor','verifier','researcher','learner','safety') NOT NULL,
	`tasksCompleted` int NOT NULL DEFAULT 0,
	`tasksFailed` int NOT NULL DEFAULT 0,
	`averageDurationMs` int NOT NULL DEFAULT 0,
	`successRate` decimal(5,4) NOT NULL DEFAULT '1.0000',
	`lastTaskAt` timestamp,
	`totalTokensUsed` bigint NOT NULL DEFAULT 0,
	`totalCost` decimal(10,6) NOT NULL DEFAULT '0',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `swarmAgentMetrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `actionDSLLog` MODIFY COLUMN `taskId` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `agentFiles` MODIFY COLUMN `taskId` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `agentMessages` MODIFY COLUMN `taskId` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `agentSkills` MODIFY COLUMN `sourceTaskId` bigint;--> statement-breakpoint
ALTER TABLE `agentSubtasks` MODIFY COLUMN `parentTaskId` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `agentToolCalls` MODIFY COLUMN `taskId` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `agents` MODIFY COLUMN `taskId` bigint;--> statement-breakpoint
ALTER TABLE `asyncTaskLogs` MODIFY COLUMN `taskId` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `codeGenerationHistory` MODIFY COLUMN `taskId` bigint;--> statement-breakpoint
ALTER TABLE `learningEvents` MODIFY COLUMN `taskId` bigint;--> statement-breakpoint
ALTER TABLE `memoryAccessLog` MODIFY COLUMN `taskId` bigint;--> statement-breakpoint
ALTER TABLE `pendingApprovals` MODIFY COLUMN `taskId` bigint;--> statement-breakpoint
ALTER TABLE `proceduralMemories` MODIFY COLUMN `sourceTaskId` bigint;--> statement-breakpoint
ALTER TABLE `scheduledTaskRuns` MODIFY COLUMN `agentTaskId` bigint;--> statement-breakpoint
ALTER TABLE `semanticMemories` MODIFY COLUMN `sourceTaskId` bigint;--> statement-breakpoint
ALTER TABLE `sshAuditLog` MODIFY COLUMN `taskId` bigint;--> statement-breakpoint
ALTER TABLE `trainingData` MODIFY COLUMN `taskId` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `visionActionSessions` MODIFY COLUMN `taskId` bigint NOT NULL;