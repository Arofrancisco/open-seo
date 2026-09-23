import { sql } from "drizzle-orm";
import {
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
  },
  (table) => [
    index("amazon_rank_checks_keyword_checked_idx").on(
      table.keywordId,
      table.checkedAt,
    ),
  ],
);
