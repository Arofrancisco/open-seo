CREATE TABLE `ai_visibility_check_items` (
	`id` text PRIMARY KEY NOT NULL,
	`check_id` text NOT NULL,
	`kind` text NOT NULL,
	`position` integer NOT NULL,
	`title` text,
	`merchant` text,
	`domain` text,
	`url` text,
	FOREIGN KEY (`check_id`) REFERENCES `ai_visibility_checks`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_visibility_check_items_check_idx` ON `ai_visibility_check_items` (`check_id`);--> statement-breakpoint
CREATE TABLE `ai_visibility_checks` (
	`id` text PRIMARY KEY NOT NULL,
	`question_id` text NOT NULL,
	`batch_id` text NOT NULL,
	`task_id` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	`checked_at` text,
	`failed` integer,
	`brand_in_text` integer,
	`brand_product_position` integer,
	`brand_cited` integer,
	FOREIGN KEY (`question_id`) REFERENCES `ai_visibility_questions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_visibility_checks_question_created_idx` ON `ai_visibility_checks` (`question_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `ai_visibility_questions` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`question` text NOT NULL,
	`marketplace` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ai_visibility_questions_unique_idx` ON `ai_visibility_questions` (`project_id`,`marketplace`,`question`);--> statement-breakpoint
CREATE TABLE `ai_visibility_settings` (
	`project_id` text PRIMARY KEY NOT NULL,
	`brand_terms` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
