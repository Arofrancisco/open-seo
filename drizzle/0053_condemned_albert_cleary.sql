CREATE TABLE `product_opportunity_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`keyword` text NOT NULL,
	`marketplace` text NOT NULL,
	`context` text,
	`verdict` text NOT NULL,
	`headline` text NOT NULL,
	`demand` text NOT NULL,
	`competition` text NOT NULL,
	`pricing` text NOT NULL,
	`newcomers` text NOT NULL,
	`risks` text NOT NULL,
	`next_steps` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')) NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_opportunity_analyses_project_created_idx` ON `product_opportunity_analyses` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `product_opportunity_products` (
	`id` text PRIMARY KEY NOT NULL,
	`analysis_id` text NOT NULL,
	`position` integer NOT NULL,
	`asin` text NOT NULL,
	`title` text,
	`price` real,
	`currency` text,
	`rating` real,
	`votes` integer,
	`monthly_sales` integer,
	`organic_position` integer,
	`advertised` integer NOT NULL,
	`is_amazon_choice` integer NOT NULL,
	`is_best_seller` integer NOT NULL,
	FOREIGN KEY (`analysis_id`) REFERENCES `product_opportunity_analyses`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `product_opportunity_products_analysis_idx` ON `product_opportunity_products` (`analysis_id`);