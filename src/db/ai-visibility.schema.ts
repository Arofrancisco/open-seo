import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { projects } from "./app.schema";

// "¿Te recomienda la IA?": which shopping questions a project tracks, and what
// ChatGPT answered each time they were asked. Kept in its own file (not
// app.schema.ts) so upstream schema changes merge without conflicts.

export const aiVisibilitySettings = sqliteTable("ai_visibility_settings", {
  projectId: text("project_id")
    .primaryKey()
    .references(() => projects.id, { onDelete: "cascade" }),
  // Names and domains that count as "the brand", one per line.
  brandTerms: text("brand_terms").notNull(),
});

export const aiVisibilityQuestions = sqliteTable(
  "ai_visibility_questions",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    // AmazonMarketplaceCode ("ES", "US", ...): picks the country and language.
    marketplace: text("marketplace").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
  },
  (table) => [
    uniqueIndex("ai_visibility_questions_unique_idx").on(
      table.projectId,
      table.marketplace,
      table.question,
    ),
  ],
);

// One row per time the question was asked. A launch asks it several times
// (same batchId) because ChatGPT does not answer the same way twice.
export const aiVisibilityChecks = sqliteTable(
  "ai_visibility_checks",
  {
    id: text("id").primaryKey(),
    questionId: text("question_id")
      .notNull()
      .references(() => aiVisibilityQuestions.id, { onDelete: "cascade" }),
    batchId: text("batch_id").notNull(),
    taskId: text("task_id").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`),
    // Null until the answer is collected.
    checkedAt: text("checked_at"),
    failed: integer("failed", { mode: "boolean" }),
    brandInText: integer("brand_in_text", { mode: "boolean" }),
    brandProductPosition: integer("brand_product_position"),
    brandCited: integer("brand_cited", { mode: "boolean" }),
  },
  (table) => [
    index("ai_visibility_checks_question_created_idx").on(
      table.questionId,
      table.createdAt,
    ),
  ],
);

// What the answer contained. kind: product | brand | source | fan_out.
export const aiVisibilityCheckItems = sqliteTable(
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
