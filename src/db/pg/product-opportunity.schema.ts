import { sql } from "drizzle-orm";
import {
  boolean,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";

// Timestamps are stored as *text* (same column shape as the SQLite schema); see
// the note in pg/app.schema.ts.
const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

// Postgres mirror of ../product-opportunity.schema.ts. Column notes live there.
export const productOpportunityAnalyses = pgTable(
  "product_opportunity_analyses",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    marketplace: text("marketplace").notNull(),
    context: text("context"),
    verdict: text("verdict").notNull(),
    headline: text("headline").notNull(),
    demand: text("demand").notNull(),
    competition: text("competition").notNull(),
    pricing: text("pricing").notNull(),
    newcomers: text("newcomers").notNull(),
    risks: text("risks").notNull(),
    nextSteps: text("next_steps").notNull(),
    createdAt: text("created_at").notNull().default(isoNow),
  },
  (table) => [
    index("product_opportunity_analyses_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

export const productOpportunityProducts = pgTable(
  "product_opportunity_products",
  {
    id: text("id").primaryKey(),
    analysisId: text("analysis_id")
      .notNull()
      .references(() => productOpportunityAnalyses.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    asin: text("asin").notNull(),
    title: text("title"),
    price: doublePrecision("price"),
    currency: text("currency"),
    rating: doublePrecision("rating"),
    votes: integer("votes"),
    monthlySales: integer("monthly_sales"),
    salesUnconfirmed: boolean("sales_unconfirmed").notNull().default(false),
    offNiche: boolean("off_niche").notNull().default(false),
    organicPosition: integer("organic_position"),
    advertised: boolean("advertised").notNull(),
    isAmazonChoice: boolean("is_amazon_choice").notNull(),
    isBestSeller: boolean("is_best_seller").notNull(),
  },
  (table) => [
    index("product_opportunity_products_analysis_idx").on(table.analysisId),
  ],
);
