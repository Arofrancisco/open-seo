CREATE TABLE `amazon_reverse_asin_results` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`keyword` text NOT NULL,
	`google_volume` integer,
	`task_id` text NOT NULL,
	`checked_at` text,
	`organic_position` integer,
	`sponsored_position` integer,
	`organic_results_scanned` integer,
	`is_amazon_choice` integer,
	`is_best_seller` integer,
	FOREIGN KEY (`run_id`) REFERENCES `amazon_reverse_asin_runs`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `amazon_reverse_asin_results_run_idx` ON `amazon_reverse_asin_results` (`run_id`);--> statement-breakpoint
CREATE TABLE `amazon_reverse_asin_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`asin` text NOT NULL,
	`marketplace` text NOT NULL,
	`status` text NOT NULL,
	`product_task_id` text,
	`title` text,
	`brand` text,
	`candidates` text,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `amazon_reverse_asin_runs_project_created_idx` ON `amazon_reverse_asin_runs` (`project_id`,`created_at`);