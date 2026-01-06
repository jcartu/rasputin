CREATE TABLE `agentSubtasks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentTaskId` int NOT NULL,
	`assignedAgentId` int NOT NULL,
	`createdByAgentId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`status` enum('pending','assigned','in_progress','completed','failed','cancelled') DEFAULT 'pending',
	`priority` enum('low','normal','high','urgent') DEFAULT 'normal',
	`input` json,
	`output` json,
	`dependsOn` json,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agentSubtasks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `agents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`parentAgentId` int,
	`taskId` int,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`agentType` enum('orchestrator','code','research','sysadmin','data','custom') DEFAULT 'orchestrator',
	`status` enum('idle','thinking','executing','waiting','completed','failed','terminated') DEFAULT 'idle',
	`systemPrompt` text,
	`capabilities` json,
	`currentGoal` text,
	`context` json,
	`messagesProcessed` int DEFAULT 0,
	`toolCallsMade` int DEFAULT 0,
	`tokensUsed` int DEFAULT 0,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `agents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alertRules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`hostId` int,
	`name` varchar(100) NOT NULL,
	`description` text,
	`metric` varchar(50) NOT NULL,
	`operator` enum('gt','gte','lt','lte','eq','neq') NOT NULL,
	`threshold` decimal(10,2) NOT NULL,
	`durationSeconds` int DEFAULT 60,
	`severity` enum('info','warning','critical') DEFAULT 'warning',
	`autoRemediate` int DEFAULT 0,
	`remediationId` int,
	`notifyOwner` int DEFAULT 1,
	`isEnabled` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `alertRules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `codeChunks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`filePath` text NOT NULL,
	`language` varchar(50),
	`content` text NOT NULL,
	`startLine` int NOT NULL,
	`endLine` int NOT NULL,
	`chunkType` enum('function','class','method','module','comment','other') DEFAULT 'other',
	`symbolName` varchar(255),
	`embedding` json,
	`embeddingModel` varchar(50),
	`hash` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `codeChunks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `codeRelationships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`sourceChunkId` int NOT NULL,
	`targetChunkId` int,
	`targetSymbol` varchar(255),
	`relationshipType` enum('imports','calls','extends','implements','uses','defines') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `codeRelationships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `codeSymbols` (
	`id` int AUTO_INCREMENT NOT NULL,
	`projectId` int NOT NULL,
	`chunkId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`fullyQualifiedName` text,
	`symbolType` enum('function','class','method','variable','constant','interface','type','enum','module') NOT NULL,
	`signature` text,
	`docstring` text,
	`filePath` text NOT NULL,
	`line` int NOT NULL,
	`isExported` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `codeSymbols_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `codebaseProjects` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`sourceType` enum('local','github','gitlab','ssh') DEFAULT 'local',
	`sourcePath` text NOT NULL,
	`branch` varchar(100) DEFAULT 'main',
	`includePatterns` json,
	`excludePatterns` json,
	`totalFiles` int DEFAULT 0,
	`totalChunks` int DEFAULT 0,
	`totalSymbols` int DEFAULT 0,
	`indexSizeBytes` bigint DEFAULT 0,
	`status` enum('pending','indexing','ready','error','stale') DEFAULT 'pending',
	`lastIndexedAt` timestamp,
	`lastError` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `codebaseProjects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `eventActions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`triggerId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`actionType` enum('jarvis_task','notification','webhook','command','chain_event') NOT NULL,
	`actionConfig` json NOT NULL,
	`executionOrder` int DEFAULT 0,
	`maxRetries` int DEFAULT 3,
	`retryDelaySeconds` int DEFAULT 60,
	`isEnabled` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `eventActions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `eventCronJobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`triggerId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`cronExpression` varchar(100) NOT NULL,
	`timezone` varchar(50) DEFAULT 'UTC',
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`lastRunSuccess` int,
	`lastRunError` text,
	`totalRuns` int DEFAULT 0,
	`successfulRuns` int DEFAULT 0,
	`failedRuns` int DEFAULT 0,
	`isEnabled` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `eventCronJobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `eventLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`triggerId` int NOT NULL,
	`actionId` int,
	`webhookEndpointId` int,
	`eventType` varchar(50) NOT NULL,
	`payload` json,
	`success` int,
	`result` json,
	`errorMessage` text,
	`executionTimeMs` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `eventLog_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `eventTriggers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`webhookEndpointId` int,
	`name` varchar(100) NOT NULL,
	`description` text,
	`triggerType` enum('webhook','schedule','alert','manual') NOT NULL,
	`conditionType` enum('always','json_match','regex','expression') DEFAULT 'always',
	`conditionConfig` json,
	`cronExpression` varchar(100),
	`isEnabled` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `eventTriggers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `healthMetrics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hostId` int NOT NULL,
	`cpuUsagePercent` decimal(5,2),
	`cpuLoadAvg1m` decimal(6,2),
	`cpuLoadAvg5m` decimal(6,2),
	`cpuLoadAvg15m` decimal(6,2),
	`memoryTotalMb` int,
	`memoryUsedMb` int,
	`memoryUsagePercent` decimal(5,2),
	`swapTotalMb` int,
	`swapUsedMb` int,
	`diskTotalGb` int,
	`diskUsedGb` int,
	`diskUsagePercent` decimal(5,2),
	`diskIoReadMbps` decimal(8,2),
	`diskIoWriteMbps` decimal(8,2),
	`networkRxMbps` decimal(8,2),
	`networkTxMbps` decimal(8,2),
	`networkConnections` int,
	`gpuCount` int,
	`gpuUtilizationPercent` decimal(5,2),
	`gpuMemoryUsedMb` int,
	`gpuMemoryTotalMb` int,
	`gpuTemperatureC` int,
	`gpuPowerWatts` int,
	`processCount` int,
	`zombieProcesses` int,
	`uptimeSeconds` bigint,
	`collectedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `healthMetrics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incidentActions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`incidentId` int NOT NULL,
	`remediationId` int,
	`actionType` varchar(50) NOT NULL,
	`actionBy` varchar(50) NOT NULL,
	`description` text,
	`command` text,
	`output` text,
	`success` int,
	`errorMessage` text,
	`executedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `incidentActions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `incidents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hostId` int NOT NULL,
	`alertRuleId` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`severity` enum('info','warning','critical') DEFAULT 'warning',
	`status` enum('open','acknowledged','investigating','resolved','closed') DEFAULT 'open',
	`metricName` varchar(50),
	`metricValue` decimal(10,2),
	`thresholdValue` decimal(10,2),
	`resolvedAt` timestamp,
	`resolvedBy` varchar(50),
	`resolutionNotes` text,
	`detectedAt` timestamp NOT NULL DEFAULT (now()),
	`acknowledgedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `incidents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `infrastructureHosts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`hostname` varchar(255) NOT NULL,
	`port` int DEFAULT 22,
	`description` text,
	`hostType` enum('server','container','vm','cloud') DEFAULT 'server',
	`status` enum('online','offline','degraded','unknown') DEFAULT 'unknown',
	`sshHostId` int,
	`lastSeen` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `infrastructureHosts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `interAgentMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`fromAgentId` int NOT NULL,
	`toAgentId` int NOT NULL,
	`messageType` enum('task','result','query','response','status','error') NOT NULL,
	`content` text NOT NULL,
	`metadata` json,
	`taskDescription` text,
	`taskPriority` enum('low','normal','high','urgent') DEFAULT 'normal',
	`isRead` int DEFAULT 0,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `interAgentMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `remediations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`targetMetric` varchar(50),
	`targetCondition` text,
	`actionType` enum('command','script','restart_service','clear_cache','kill_process','custom') NOT NULL,
	`actionPayload` text,
	`requiresApproval` int DEFAULT 1,
	`maxExecutionsPerHour` int DEFAULT 3,
	`rollbackCommand` text,
	`executionCount` int DEFAULT 0,
	`successCount` int DEFAULT 0,
	`failureCount` int DEFAULT 0,
	`isEnabled` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `remediations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webhookEndpoints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`path` varchar(255) NOT NULL,
	`secret` varchar(255),
	`sourceType` enum('github','gitlab','custom','monitoring') DEFAULT 'custom',
	`totalReceived` int DEFAULT 0,
	`lastReceivedAt` timestamp,
	`isEnabled` int DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webhookEndpoints_id` PRIMARY KEY(`id`),
	CONSTRAINT `webhookEndpoints_path_unique` UNIQUE(`path`)
);
