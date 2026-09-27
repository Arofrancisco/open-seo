CREATE TABLE "amazon_reverse_asin_results" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"keyword" text NOT NULL,
	"google_volume" integer,
	"task_id" text NOT NULL,
	"checked_at" text,
	"organic_position" integer,
	"sponsored_position" integer,
	"organic_results_scanned" integer,
	"is_amazon_choice" boolean,
	"is_best_seller" boolean
);
--> statement-breakpoint
CREATE TABLE "amazon_reverse_asin_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"asin" text NOT NULL,
	"marketplace" text NOT NULL,
	"status" text NOT NULL,
	"product_task_id" text,
	"title" text,
	"brand" text,
	"candidates" text,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "amazon_reverse_asin_results" ADD CONSTRAINT "amazon_reverse_asin_results_run_id_amazon_reverse_asin_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."amazon_reverse_asin_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amazon_reverse_asin_runs" ADD CONSTRAINT "amazon_reverse_asin_runs_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "amazon_reverse_asin_results_run_idx" ON "amazon_reverse_asin_results" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "amazon_reverse_asin_runs_project_created_idx" ON "amazon_reverse_asin_runs" USING btree ("project_id","created_at");