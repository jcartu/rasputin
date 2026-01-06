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
