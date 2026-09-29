CREATE TABLE "ai_visibility_check_items" (
	"id" text PRIMARY KEY NOT NULL,
	"check_id" text NOT NULL,
	"kind" text NOT NULL,
	"position" integer NOT NULL,
	"title" text,
	"merchant" text,
	"domain" text,
	"url" text
);
--> statement-breakpoint
CREATE TABLE "ai_visibility_checks" (
	"id" text PRIMARY KEY NOT NULL,
	"question_id" text NOT NULL,
	"batch_id" text NOT NULL,
	"task_id" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL,
	"checked_at" text,
	"failed" boolean,
	"brand_in_text" boolean,
	"brand_product_position" integer,
	"brand_cited" boolean
);
--> statement-breakpoint
CREATE TABLE "ai_visibility_questions" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"question" text NOT NULL,
	"marketplace" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_visibility_settings" (
	"project_id" text PRIMARY KEY NOT NULL,
	"brand_terms" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_visibility_check_items" ADD CONSTRAINT "ai_visibility_check_items_check_id_ai_visibility_checks_id_fk" FOREIGN KEY ("check_id") REFERENCES "public"."ai_visibility_checks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_visibility_checks" ADD CONSTRAINT "ai_visibility_checks_question_id_ai_visibility_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."ai_visibility_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_visibility_questions" ADD CONSTRAINT "ai_visibility_questions_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_visibility_settings" ADD CONSTRAINT "ai_visibility_settings_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_visibility_check_items_check_idx" ON "ai_visibility_check_items" USING btree ("check_id");--> statement-breakpoint
CREATE INDEX "ai_visibility_checks_question_created_idx" ON "ai_visibility_checks" USING btree ("question_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_visibility_questions_unique_idx" ON "ai_visibility_questions" USING btree ("project_id","marketplace","question");