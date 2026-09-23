ALTER TABLE `amazon_rank_checks` ADD `is_amazon_choice` integer;--> statement-breakpoint
ALTER TABLE `amazon_rank_checks` ADD `is_best_seller` integer;--> statement-breakpoint
ALTER TABLE `amazon_rank_checks` ADD `top_results` text;--> statement-breakpoint
ALTER TABLE `amazon_rank_keywords` ADD `pending_task_id` text;--> statement-breakpoint
ALTER TABLE `amazon_rank_keywords` ADD `pending_since` text;