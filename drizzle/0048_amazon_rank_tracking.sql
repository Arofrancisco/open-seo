CREATE TABLE `amazon_rank_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`keyword_id` text NOT NULL,
	`checked_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`organic_position` integer,
	`sponsored_position` integer,
	`organic_results_scanned` integer NOT NULL,
	FOREIGN KEY (`keyword_id`) REFERENCES `amazon_rank_keywords`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `amazon_rank_checks_keyword_checked_idx` ON `amazon_rank_checks` (`keyword_id`,`checked_at`);--> statement-breakpoint
CREATE TABLE `amazon_rank_keywords` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`asin` text NOT NULL,
	`keyword` text NOT NULL,
	`marketplace` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `amazon_rank_keywords_project_asin_keyword_idx` ON `amazon_rank_keywords` (`project_id`,`asin`,`keyword`,`marketplace`);