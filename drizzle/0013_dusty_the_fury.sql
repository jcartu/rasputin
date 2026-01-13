ALTER TABLE `episodicMemories` MODIFY COLUMN `description` mediumtext NOT NULL;--> statement-breakpoint
ALTER TABLE `episodicMemories` MODIFY COLUMN `context` mediumtext;--> statement-breakpoint
ALTER TABLE `episodicMemories` MODIFY COLUMN `action` mediumtext;--> statement-breakpoint
ALTER TABLE `episodicMemories` MODIFY COLUMN `outcome` mediumtext;--> statement-breakpoint
ALTER TABLE `trainingData` MODIFY COLUMN `input` mediumtext NOT NULL;--> statement-breakpoint
ALTER TABLE `trainingData` MODIFY COLUMN `output` mediumtext NOT NULL;