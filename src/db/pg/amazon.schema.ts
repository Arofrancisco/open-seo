import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { projects } from "./app.schema";

// Timestamps are stored as *text* (same column shape as the SQLite schema); see
// the note in pg/app.schema.ts.
const isoNow = sql`to_char(now() AT TIME ZONE 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;

// Postgres mirror of ../amazon.schema.ts. Column notes live there.
export const amazonRankKeywords = pgTable(
  "amazon_rank_keywords",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    asin: text("asin").notNull(),
    keyword: text("keyword").notNull(),
    marketplace: text("marketplace").notNull(),
    pendingTaskId: text("pending_task_id"),
    pendingSince: text("pending_since"),
    createdAt: text("created_at").notNull().default(isoNow),
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

export const amazonRankChecks = pgTable(
  "amazon_rank_checks",
  {
    id: text("id").primaryKey(),
    keywordId: text("keyword_id")
      .notNull()
      .references(() => amazonRankKeywords.id, { onDelete: "cascade" }),
    checkedAt: text("checked_at").notNull().default(isoNow),
    organicPosition: integer("organic_position"),
    sponsoredPosition: integer("sponsored_position"),
    organicResultsScanned: integer("organic_results_scanned").notNull(),
    isAmazonChoice: boolean("is_amazon_choice"),
    isBestSeller: boolean("is_best_seller"),
    topResults: text("top_results"),
  },
  (table) => [
    index("amazon_rank_checks_keyword_checked_idx").on(
      table.keywordId,
      table.checkedAt,
    ),
  ],
);

export const amazonReverseAsinRuns = pgTable(
  "amazon_reverse_asin_runs",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    asin: text("asin").notNull(),
    marketplace: text("marketplace").notNull(),
    status: text("status").notNull(),
    productTaskId: text("product_task_id"),
    title: text("title"),
    brand: text("brand"),
    candidates: text("candidates"),
    createdAt: text("created_at").notNull().default(isoNow),
  },
  (table) => [
    index("amazon_reverse_asin_runs_project_created_idx").on(
      table.projectId,
      table.createdAt,
    ),
  ],
);

export const amazonReverseAsinResults = pgTable(
  "amazon_reverse_asin_results",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => amazonReverseAsinRuns.id, { onDelete: "cascade" }),
    keyword: text("keyword").notNull(),
    amazonVolume: integer("amazon_volume"),
    googleVolume: integer("google_volume"),
    taskId: text("task_id").notNull(),
    checkedAt: text("checked_at"),
    organicPosition: integer("organic_position"),
    sponsoredPosition: integer("sponsored_position"),
    organicResultsScanned: integer("organic_results_scanned"),
    isAmazonChoice: boolean("is_amazon_choice"),
    isBestSeller: boolean("is_best_seller"),
  },
  (table) => [index("amazon_reverse_asin_results_run_idx").on(table.runId)],
);
