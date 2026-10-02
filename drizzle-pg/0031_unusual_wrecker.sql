CREATE TABLE "product_opportunity_analyses" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"keyword" text NOT NULL,
	"marketplace" text NOT NULL,
	"context" text,
	"verdict" text NOT NULL,
	"headline" text NOT NULL,
	"demand" text NOT NULL,
	"competition" text NOT NULL,
	"pricing" text NOT NULL,
	"newcomers" text NOT NULL,
	"risks" text NOT NULL,
	"next_steps" text NOT NULL,
	"created_at" text DEFAULT to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_opportunity_products" (
	"id" text PRIMARY KEY NOT NULL,
	"analysis_id" text NOT NULL,
	"position" integer NOT NULL,
	"asin" text NOT NULL,
	"title" text,
	"price" double precision,
	"currency" text,
	"rating" double precision,
	"votes" integer,
	"monthly_sales" integer,
	"organic_position" integer,
	"advertised" boolean NOT NULL,
	"is_amazon_choice" boolean NOT NULL,
	"is_best_seller" boolean NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_opportunity_analyses" ADD CONSTRAINT "product_opportunity_analyses_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_opportunity_products" ADD CONSTRAINT "product_opportunity_products_analysis_id_product_opportunity_analyses_id_fk" FOREIGN KEY ("analysis_id") REFERENCES "public"."product_opportunity_analyses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_opportunity_analyses_project_created_idx" ON "product_opportunity_analyses" USING btree ("project_id","created_at");--> statement-breakpoint
CREATE INDEX "product_opportunity_products_analysis_idx" ON "product_opportunity_products" USING btree ("analysis_id");