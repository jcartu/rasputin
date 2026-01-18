ALTER TABLE `episodicMemories` MODIFY COLUMN `taskId` bigint;--> statement-breakpoint
ALTER TABLE `jarvisEventLog` MODIFY COLUMN `taskId` bigint NOT NULL;--> statement-breakpoint
ALTER TABLE `knowledgeCache` MODIFY COLUMN `source` enum('web_search','searxng','browse','api','documentation','llm_response') NOT NULL;