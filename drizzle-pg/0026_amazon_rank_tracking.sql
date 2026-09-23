CREATE TABLE "amazon_rank_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"keyword_id" text NOT NULL,
	"checked_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"organic_position" integer,
	"sponsored_position" integer,
	"organic_results_scanned" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "amazon_rank_keywords" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"asin" text NOT NULL,
	"keyword" text NOT NULL,
	"marketplace" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
ALTER TABLE "amazon_rank_checks" ADD CONSTRAINT "amazon_rank_checks_keyword_id_amazon_rank_keywords_id_fk" FOREIGN KEY ("keyword_id") REFERENCES "public"."amazon_rank_keywords"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "amazon_rank_keywords" ADD CONSTRAINT "amazon_rank_keywords_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "amazon_rank_checks_keyword_checked_idx" ON "amazon_rank_checks" USING btree ("keyword_id","checked_at");--> statement-breakpoint
CREATE UNIQUE INDEX "amazon_rank_keywords_project_asin_keyword_idx" ON "amazon_rank_keywords" USING btree ("project_id","asin","keyword","marketplace");