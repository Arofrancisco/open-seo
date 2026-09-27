import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { amazonReverseAsinResults, amazonReverseAsinRuns } from "@/db/schema";

export type ReverseAsinRunRow = typeof amazonReverseAsinRuns.$inferSelect;
export type ReverseAsinResultRow = typeof amazonReverseAsinResults.$inferSelect;

export type ReverseAsinStatus =
  | "fetching_product"
  | "generating"
  | "choosing_keywords"
  | "checking"
  | "done"
  | "not_found";

const RECENT_RUNS = 10;

async function createRun(row: typeof amazonReverseAsinRuns.$inferInsert) {
  await db.insert(amazonReverseAsinRuns).values(row);
}

async function getRun(
  projectId: string,
  runId: string,
): Promise<ReverseAsinRunRow | null> {
  const [row] = await db
    .select()
    .from(amazonReverseAsinRuns)
    .where(
      and(
        eq(amazonReverseAsinRuns.id, runId),
        eq(amazonReverseAsinRuns.projectId, projectId),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function listRuns(projectId: string): Promise<ReverseAsinRunRow[]> {
  return db
    .select()
    .from(amazonReverseAsinRuns)
    .where(eq(amazonReverseAsinRuns.projectId, projectId))
    .orderBy(desc(amazonReverseAsinRuns.createdAt))
    .limit(RECENT_RUNS);
}

/**
 * Moves a run from one status to another only if it is still in `from`, and
 * reports whether this caller won. Concurrent polls race here, and the winner
 * is the only one allowed to spend credits on the next step.
 */
async function transition(
  runId: string,
  from: ReverseAsinStatus,
  to: ReverseAsinStatus,
  extra: Partial<typeof amazonReverseAsinRuns.$inferInsert> = {},
): Promise<boolean> {
  const updated = await db
    .update(amazonReverseAsinRuns)
    .set({ ...extra, status: to })
    .where(
      and(
        eq(amazonReverseAsinRuns.id, runId),
        eq(amazonReverseAsinRuns.status, from),
      ),
    )
    .returning({ id: amazonReverseAsinRuns.id });
  return updated.length > 0;
}

async function insertResult(row: typeof amazonReverseAsinResults.$inferInsert) {
  await db.insert(amazonReverseAsinResults).values(row);
}

async function listResults(runId: string): Promise<ReverseAsinResultRow[]> {
  return db
    .select()
    .from(amazonReverseAsinResults)
    .where(eq(amazonReverseAsinResults.runId, runId));
}

/** Only writes while the row is still uncollected, so two polls store it once. */
async function recordResult(
  resultId: string,
  values: Pick<
    typeof amazonReverseAsinResults.$inferInsert,
    | "checkedAt"
    | "organicPosition"
    | "sponsoredPosition"
    | "organicResultsScanned"
    | "isAmazonChoice"
    | "isBestSeller"
  >,
) {
  await db
    .update(amazonReverseAsinResults)
    .set(values)
    .where(
      and(
        eq(amazonReverseAsinResults.id, resultId),
        isNull(amazonReverseAsinResults.checkedAt),
      ),
    );
}

export const AmazonReverseAsinRepository = {
  createRun,
  getRun,
  listRuns,
  transition,
  insertResult,
  listResults,
  recordResult,
} as const;
