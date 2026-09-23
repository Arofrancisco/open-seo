import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { amazonRankChecks, amazonRankKeywords } from "@/db/schema";

export type AmazonRankKeywordRow = typeof amazonRankKeywords.$inferSelect;
export type AmazonRankCheckRow = typeof amazonRankChecks.$inferSelect;

async function listKeywords(projectId: string): Promise<AmazonRankKeywordRow[]> {
  return db
    .select()
    .from(amazonRankKeywords)
    .where(eq(amazonRankKeywords.projectId, projectId))
    .orderBy(amazonRankKeywords.createdAt);
}

async function getKeyword(
  projectId: string,
  keywordId: string,
): Promise<AmazonRankKeywordRow | null> {
  const [row] = await db
    .select()
    .from(amazonRankKeywords)
    .where(
      and(
        eq(amazonRankKeywords.id, keywordId),
        eq(amazonRankKeywords.projectId, projectId),
      ),
    )
    .limit(1);
  return row ?? null;
}

/** Returns false when the same ASIN/keyword/marketplace is already tracked. */
async function addKeyword(
  row: typeof amazonRankKeywords.$inferInsert,
): Promise<boolean> {
  const inserted = await db
    .insert(amazonRankKeywords)
    .values(row)
    .onConflictDoNothing()
    .returning({ id: amazonRankKeywords.id });
  return inserted.length > 0;
}

async function deleteKeyword(projectId: string, keywordId: string) {
  await db
    .delete(amazonRankKeywords)
    .where(
      and(
        eq(amazonRankKeywords.id, keywordId),
        eq(amazonRankKeywords.projectId, projectId),
      ),
    );
}

async function setPending(keywordId: string, taskId: string) {
  await db
    .update(amazonRankKeywords)
    .set({ pendingTaskId: taskId, pendingSince: new Date().toISOString() })
    .where(eq(amazonRankKeywords.id, keywordId));
}

/** Only clears when the stored task is still this one, so a newer check isn't lost. */
async function clearPending(keywordId: string, taskId: string) {
  await db
    .update(amazonRankKeywords)
    .set({ pendingTaskId: null, pendingSince: null })
    .where(
      and(
        eq(amazonRankKeywords.id, keywordId),
        eq(amazonRankKeywords.pendingTaskId, taskId),
      ),
    );
}

/**
 * The check id is the DataForSEO task id, so a result collected twice (two
 * overlapping list loads) is stored once.
 */
async function recordCheck(row: typeof amazonRankChecks.$inferInsert) {
  await db.insert(amazonRankChecks).values(row).onConflictDoNothing();
}

async function listChecksForKeywords(
  keywordIds: string[],
): Promise<AmazonRankCheckRow[]> {
  if (keywordIds.length === 0) return [];
  return db
    .select()
    .from(amazonRankChecks)
    .where(inArray(amazonRankChecks.keywordId, keywordIds))
    .orderBy(desc(amazonRankChecks.checkedAt));
}

export const AmazonRankRepository = {
  listKeywords,
  getKeyword,
  addKeyword,
  deleteKeyword,
  setPending,
  clearPending,
  recordCheck,
  listChecksForKeywords,
} as const;
