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

// Postgres mirror of ../ai-visibility.schema.ts. Column notes live there.
export const aiVisibilitySettings = pgTable("ai_visibility_settings", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  brandTerms: text("brand_terms").notNull(),
});

export const aiVisibilityQuestions = pgTable(
  "ai_visibility_questions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    marketplace: text("marketplace").notNull(),
    createdAt: text("created_at").notNull().default(isoNow),
  },
  (table) => [
    uniqueIndex("ai_visibility_questions_unique_idx").on(
      table.projectId,
      table.marketplace,
      table.question,
    ),
  ],
);

export const aiVisibilityChecks = pgTable(
  "ai_visibility_checks",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => aiVisibilityQuestions.id, { onDelete: "cascade" }),
    batchId: text("batch_id").notNull(),
    taskId: text("task_id").notNull(),
    createdAt: text("created_at").notNull().default(isoNow),
    checkedAt: text("checked_at"),
    failed: boolean("failed"),
    brandInText: boolean("brand_in_text"),
    brandProductPosition: integer("brand_product_position"),
    brandCited: boolean("brand_cited"),
  },
  (table) => [
    index("ai_visibility_checks_question_created_idx").on(
      table.questionId,
      table.createdAt,
    ),
  ],
);

export const aiVisibilityCheckItems = pgTable(
  "ai_visibility_check_items",
  {
    id: text("id").primaryKey(),
    checkId: text("check_id")
      .notNull()
      .references(() => aiVisibilityChecks.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    position: integer("position").notNull(),
    title: text("title"),
    merchant: text("merchant"),
    domain: text("domain"),
    url: text("url"),
  },
  (table) => [index("ai_visibility_check_items_check_idx").on(table.checkId)],
);
