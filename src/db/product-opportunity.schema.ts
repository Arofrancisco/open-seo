import { index, integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { projects } from "./app.schema";

// "¿Qué producto lanzo?": every niche analysis a project ran, so a paid result
// is never lost when the page changes. The summary figures are recomputed from
// the stored products; only what can't be recomputed (the verdict) is kept.
// Kept in its own file (not app.schema.ts) so upstream changes merge cleanly.

export const productOpportunityAnalyses = sqliteTable(
  "product_opportunity_analyses",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    // AmazonMarketplaceCode ("ES", "US", ...).
    marketplace: text("marketplace").notNull(),
    context: text("context"),
    // abierto | competido | cerrado
    verdict: text("verdict").notNull(),
    headline: text("headline").notNull(),
    demand: text("demand").notNull(),
    competition: text("competition").notNull(),
    pricing: text("pricing").notNull(),
    newcomers: text("newcomers").notNull(),
    // One item per line.
    risks: text("risks").notNull(),
    nextSteps: text("next_steps").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (table) => [
    index("product_opportunity_analyses_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

// The products Amazon showed, after cleaning, in Amazon's order.
export const productOpportunityProducts = sqliteTable(
  "product_opportunity_products",
  {
    id: text("id").primaryKey(),
    analysisId: text("analysis_id")
      .notNull()
      .references(() => productOpportunityAnalyses.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    asin: text("asin").notNull(),
    title: text("title"),
    price: real("price"),
    currency: text("currency"),
    rating: real("rating"),
    votes: integer("votes"),
    monthlySales: integer("monthly_sales"),
    // See MarketProduct in shared/product-opportunity.ts.
    salesUnconfirmed: integer("sales_unconfirmed", { mode: "boolean" })
      .notNull()
      .default(false),
    offNiche: integer("off_niche", { mode: "boolean" }).notNull().default(false),
    organicPosition: integer("organic_position"),
    advertised: integer("advertised", { mode: "boolean" }).notNull(),
    isAmazonChoice: integer("is_amazon_choice", { mode: "boolean" }).notNull(),
    isBestSeller: integer("is_best_seller", { mode: "boolean" }).notNull(),
  },
  (table) => [
    index("product_opportunity_products_analysis_idx").on(table.analysisId),
  ],
);
