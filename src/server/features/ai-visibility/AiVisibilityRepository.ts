import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  aiVisibilityCheckItems,
  aiVisibilityChecks,
  aiVisibilityQuestions,
  aiVisibilitySettings,
} from "@/db/schema";

export type QuestionRow = typeof aiVisibilityQuestions.$inferSelect;
export type CheckRow = typeof aiVisibilityChecks.$inferSelect;
export type CheckItemRow = typeof aiVisibilityCheckItems.$inferSelect;

// Enough for several launches of every question; older history is not shown.
const RECENT_CHECKS = 600;

async function getBrandTerms(projectId: string): Promise<string[]> {
  const [row] = await db
    .select()
    .from(aiVisibilitySettings)
    .where(eq(aiVisibilitySettings.projectId, projectId))
    .limit(1);
  return row ? row.brandTerms.split("\n").filter(Boolean) : [];
}

async function setBrandTerms(projectId: string, terms: string[]) {
  const brandTerms = terms.join("\n");
  await db
    .insert(aiVisibilitySettings)
    .values({ projectId, brandTerms })
    .onConflictDoUpdate({
      target: aiVisibilitySettings.projectId,
      set: { brandTerms },
    });
}

async function listQuestions(projectId: string): Promise<QuestionRow[]> {
  return db
    .select()
    .from(aiVisibilityQuestions)
    .where(eq(aiVisibilityQuestions.projectId, projectId))
    .orderBy(aiVisibilityQuestions.createdAt);
}

async function insertQuestion(row: typeof aiVisibilityQuestions.$inferInsert) {
  await db.insert(aiVisibilityQuestions).values(row);
}

async function deleteQuestion(projectId: string, questionId: string) {
  await db
    .delete(aiVisibilityQuestions)
    .where(
      and(
        eq(aiVisibilityQuestions.id, questionId),
        eq(aiVisibilityQuestions.projectId, projectId),
      ),
    );
}

async function insertCheck(row: typeof aiVisibilityChecks.$inferInsert) {
  await db.insert(aiVisibilityChecks).values(row);
}

async function listChecks(questionIds: string[]): Promise<CheckRow[]> {
  if (questionIds.length === 0) return [];
  return db
    .select()
    .from(aiVisibilityChecks)
    .where(inArray(aiVisibilityChecks.questionId, questionIds))
    .orderBy(desc(aiVisibilityChecks.createdAt))
    .limit(RECENT_CHECKS);
}

async function listItems(checkIds: string[]): Promise<CheckItemRow[]> {
  if (checkIds.length === 0) return [];
  return db
    .select()
    .from(aiVisibilityCheckItems)
    .where(inArray(aiVisibilityCheckItems.checkId, checkIds))
    .orderBy(aiVisibilityCheckItems.position);
}

/**
 * Stores an answer only while the check is still uncollected, and reports
 * whether this caller won: two polls collecting at once must save it once.
 */
async function recordCheck(
  checkId: string,
  values: Pick<
    typeof aiVisibilityChecks.$inferInsert,
    "checkedAt" | "failed" | "brandInText" | "brandProductPosition" | "brandCited"
  >,
): Promise<boolean> {
  const updated = await db
    .update(aiVisibilityChecks)
    .set(values)
    .where(
      and(
        eq(aiVisibilityChecks.id, checkId),
        isNull(aiVisibilityChecks.checkedAt),
      ),
    )
    .returning({ id: aiVisibilityChecks.id });
  return updated.length > 0;
}

async function insertItems(rows: (typeof aiVisibilityCheckItems.$inferInsert)[]) {
  if (rows.length === 0) return;
  await db.insert(aiVisibilityCheckItems).values(rows);
}

export const AiVisibilityRepository = {
  getBrandTerms,
  setBrandTerms,
  listQuestions,
  insertQuestion,
  deleteQuestion,
  insertCheck,
  listChecks,
  listItems,
  recordCheck,
  insertItems,
} as const;
