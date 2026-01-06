CREATE TABLE `appIterations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`iterationNumber` int NOT NULL,
	`userRequest` text NOT NULL,
	`plan` text,
	`changes` json,
	`filesModified` json,
	`commitHash` varchar(64),
	`testResults` json,
	`testsPassed` int NOT NULL DEFAULT 0,
	`deploymentStatus` enum('pending','deploying','deployed','failed') NOT NULL,
	`deploymentError` text,
	`deployedAt` timestamp,
	`rolledBack` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `appIterations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `codeGenerationHistory` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int,
	`taskId` int,
	`filePath` varchar(512) NOT NULL,
	`model` varchar(128) NOT NULL,
	`prompt` text NOT NULL,
	`generatedCode` text NOT NULL,
	`accepted` int NOT NULL DEFAULT 0,
	`feedback` text,
	`testResults` json,
	`metrics` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `codeGenerationHistory_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webAppProjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`type` enum('react','nextjs','vue','svelte','express','fastapi','rails') NOT NULL,
	`repositoryUrl` varchar(512),
	`deploymentUrl` varchar(512),
	`status` enum('scaffolding','developing','testing','deployed','archived') NOT NULL DEFAULT 'scaffolding',
	`stack` json,
	`database` varchar(64),
	`authentication` varchar(64),
	`features` json,
	`deploymentPlatform` varchar(64),
	`envVariables` text,
	`totalLoc` int NOT NULL DEFAULT 0,
	`testCoverage` int NOT NULL DEFAULT 0,
	`lastDeployedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webAppProjects_id` PRIMARY KEY(`id`)
);
