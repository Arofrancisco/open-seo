import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { DB_BATCH_SIZE, runBatch } from "@/db/runBatch";
import {
  productOpportunityAnalyses,
  productOpportunityProducts,
} from "@/db/schema";

export type AnalysisRow = typeof productOpportunityAnalyses.$inferSelect;
export type ProductRow = typeof productOpportunityProducts.$inferSelect;
type ProductInsert = typeof productOpportunityProducts.$inferInsert;

// Plenty to compare niches over months; older analyses stay stored, just unlisted.
const LISTED_ANALYSES = 50;

// Each product row binds 14 parameters; keep every statement under the
// per-statement parameter cap.
const PRODUCT_COLUMNS = 14;
const ROWS_PER_INSERT = Math.max(1, Math.floor(DB_BATCH_SIZE / PRODUCT_COLUMNS));

async function insertAnalysis(
  analysis: typeof productOpportunityAnalyses.$inferInsert,
  products: ProductInsert[],
) {
  const chunks: ProductInsert[][] = [];
  for (let i = 0; i < products.length; i += ROWS_PER_INSERT) {
    chunks.push(products.slice(i, i + ROWS_PER_INSERT));
  }
  await runBatch((tx) => [
    tx.insert(productOpportunityAnalyses).values(analysis),
    ...chunks.map((chunk) => tx.insert(productOpportunityProducts).values(chunk)),
  ]);
}

async function listAnalyses(projectId: string): Promise<AnalysisRow[]> {
  return db
    .select()
    .from(productOpportunityAnalyses)
    .where(eq(productOpportunityAnalyses.projectId, projectId))
    .orderBy(desc(productOpportunityAnalyses.createdAt))
    .limit(LISTED_ANALYSES);
}

async function getAnalysis(
  projectId: string,
  analysisId: string,
): Promise<{ analysis: AnalysisRow; products: ProductRow[] } | null> {
  const [analysis] = await db
    .select()
    .from(productOpportunityAnalyses)
    .where(
      and(
        eq(productOpportunityAnalyses.id, analysisId),
        eq(productOpportunityAnalyses.projectId, projectId),
      ),
    )
    .limit(1);
  if (!analysis) return null;
  const products = await db
    .select()
    .from(productOpportunityProducts)
    .where(eq(productOpportunityProducts.analysisId, analysisId))
    .orderBy(productOpportunityProducts.position);
  return { analysis, products };
}

async function deleteAnalysis(projectId: string, analysisId: string) {
  await db
    .delete(productOpportunityAnalyses)
    .where(
      and(
        eq(productOpportunityAnalyses.id, analysisId),
        eq(productOpportunityAnalyses.projectId, projectId),
      ),
    );
}

export const ProductOpportunityRepository = {
  insertAnalysis,
  listAnalyses,
  getAnalysis,
  deleteAnalysis,
};
