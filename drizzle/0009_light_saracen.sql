CREATE TABLE `knowledgeCache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`cacheKey` varchar(255) NOT NULL,
	`query` text NOT NULL,
	`source` enum('web_search','searxng','browse','api','documentation') NOT NULL,
	`content` text NOT NULL,
	`metadata` json,
	`embedding` json,
	`hitCount` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`lastAccessedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `knowledgeCache_id` PRIMARY KEY(`id`)
);
