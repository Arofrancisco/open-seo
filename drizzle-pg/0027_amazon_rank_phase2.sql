ALTER TABLE "amazon_rank_checks" ADD COLUMN "is_amazon_choice" boolean;--> statement-breakpoint
ALTER TABLE "amazon_rank_checks" ADD COLUMN "is_best_seller" boolean;--> statement-breakpoint
ALTER TABLE "amazon_rank_checks" ADD COLUMN "top_results" text;--> statement-breakpoint
ALTER TABLE "amazon_rank_keywords" ADD COLUMN "pending_task_id" text;--> statement-breakpoint
ALTER TABLE "amazon_rank_keywords" ADD COLUMN "pending_since" text;