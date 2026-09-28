import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { projects } from "./app.schema";

// Amazon keyword rank tracking: which ASIN a project follows for which Amazon
// search term, and the position history of each check. Kept in its own file
// (not app.schema.ts) so upstream schema changes merge without conflicts.

export const amazonRankKeywords = sqliteTable(
  "amazon_rank_keywords",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    asin: text("asin").notNull(),
    keyword: text("keyword").notNull(),
    // AmazonMarketplaceCode ("ES", "US", ...).
    marketplace: text("marketplace").notNull(),
    // DataForSEO task posted but not yet collected. Stored so a result still
    // lands when the user closes the page before it finishes.
    pendingTaskId: text("pending_task_id"),
    pendingSince: text("pending_since"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (table) => [
    uniqueIndex("amazon_rank_keywords_project_asin_keyword_idx").on(
      table.projectId,
      table.asin,
      table.keyword,
      table.marketplace,
    ),
  ],
);

export const amazonRankChecks = sqliteTable(
  "amazon_rank_checks",
  {
    id: text("id").primaryKey(),
    keywordId: text("keyword_id")
      .notNull()
      .references(() => amazonRankKeywords.id, { onDelete: "cascade" }),
    checkedAt: text("checked_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    // Null = the ASIN was not among the results fetched.
    organicPosition: integer("organic_position"),
    sponsoredPosition: integer("sponsored_position"),
    // How many organic results were scanned, so "not found" reads as
    // "not in the top N".
    organicResultsScanned: integer("organic_results_scanned").notNull(),
    // Badges on the tracked ASIN for this keyword; null when it wasn't found.
    isAmazonChoice: integer("is_amazon_choice", { mode: "boolean" }),
    isBestSeller: integer("is_best_seller", { mode: "boolean" }),
    // JSON array of the top organic results at check time (AmazonTopResult[]).
    topResults: text("top_results"),
  },
  (table) => [
    index("amazon_rank_checks_keyword_checked_idx").on(
      table.keywordId,
      table.checkedAt,
    ),
  ],
);

// Reverse ASIN (approximate): one run per ASIN analysed, then one row per
// candidate keyword searched on Amazon to see where the ASIN appears.

export const amazonReverseAsinRuns = sqliteTable(
  "amazon_reverse_asin_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    asin: text("asin").notNull(),
    marketplace: text("marketplace").notNull(),
    // fetching_product → generating → choosing_keywords → checking → done,
    // or not_found when the ASIN has no listing in that marketplace.
    status: text("status").notNull(),
    productTaskId: text("product_task_id"),
    title: text("title"),
    brand: text("brand"),
    // JSON array of ReverseAsinCandidate, set once the product is read.
    candidates: text("candidates"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (table) => [
    index("amazon_reverse_asin_runs_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

export const amazonReverseAsinResults = sqliteTable(
  "amazon_reverse_asin_results",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => amazonReverseAsinRuns.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    // Monthly searches on Amazon for the marketplace; null when unknown.
    amazonVolume: integer("amazon_volume"),
    // Google monthly volume for the marketplace's country; null when unknown.
    googleVolume: integer("google_volume"),
    taskId: text("task_id").notNull(),
    // Null until the Amazon search is collected.
    checkedAt: text("checked_at"),
    organicPosition: integer("organic_position"),
    sponsoredPosition: integer("sponsored_position"),
    organicResultsScanned: integer("organic_results_scanned"),
    isAmazonChoice: integer("is_amazon_choice", { mode: "boolean" }),
    isBestSeller: integer("is_best_seller", { mode: "boolean" }),
  },
  (table) => [
    index("amazon_reverse_asin_results_run_idx").on(table.runId),
  ],
);
