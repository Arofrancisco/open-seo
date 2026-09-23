import { createServerFn } from "@tanstack/react-start";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  addAmazonRankKeywordSchema,
  amazonRankKeywordRefSchema,
  getAmazonRankCheckStatusSchema,
  listAmazonRankKeywordsSchema,
  MAX_AMAZON_RANK_KEYWORDS_PER_PROJECT,
} from "@/types/schemas/amazonRank";
import { AmazonRankRepository } from "@/server/features/amazon-rank/AmazonRankRepository";
import {
  createDataforseoClient,
  fetchAmazonProductsRank,
} from "@/server/lib/dataforseo";
import {
  getAmazonMarketplace,
  type AmazonMarketplaceCode,
} from "@/shared/amazon-marketplaces";
import { AppError } from "@/server/lib/errors";

export type AmazonRankCheckView = {
  checkedAt: string;
  organicPosition: number | null;
  sponsoredPosition: number | null;
  organicResultsScanned: number;
};

export type AmazonRankKeywordView = {
  id: string;
  asin: string;
  keyword: string;
  marketplace: AmazonMarketplaceCode;
  latest: AmazonRankCheckView | null;
  previous: AmazonRankCheckView | null;
};

async function requireKeyword(projectId: string, keywordId: string) {
  const keyword = await AmazonRankRepository.getKeyword(projectId, keywordId);
  if (!keyword) {
    throw new AppError("NOT_FOUND", "Palabra clave no encontrada");
  }
  return keyword;
}

export const listAmazonRankKeywords = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listAmazonRankKeywordsSchema)
  .handler(async ({ context }): Promise<AmazonRankKeywordView[]> => {
    const keywords = await AmazonRankRepository.listKeywords(context.projectId);
    const checks = await AmazonRankRepository.listChecksForKeywords(
      keywords.map((keyword) => keyword.id),
    );
    // Checks arrive newest first, so the first two per keyword are latest and
    // previous.
    const byKeyword = new Map<string, AmazonRankCheckView[]>();
    for (const check of checks) {
      const list = byKeyword.get(check.keywordId) ?? [];
      if (list.length < 2) {
        list.push({
          checkedAt: check.checkedAt,
          organicPosition: check.organicPosition,
          sponsoredPosition: check.sponsoredPosition,
          organicResultsScanned: check.organicResultsScanned,
        });
        byKeyword.set(check.keywordId, list);
      }
    }
    return keywords.map((keyword) => {
      const [latest = null, previous = null] = byKeyword.get(keyword.id) ?? [];
      return {
        id: keyword.id,
        asin: keyword.asin,
        keyword: keyword.keyword,
        marketplace: keyword.marketplace as AmazonMarketplaceCode,
        latest,
        previous,
      };
    });
  });

export const addAmazonRankKeyword = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(addAmazonRankKeywordSchema)
  .handler(async ({ data, context }) => {
    const existing = await AmazonRankRepository.listKeywords(context.projectId);
    if (existing.length >= MAX_AMAZON_RANK_KEYWORDS_PER_PROJECT) {
      throw new AppError(
        "VALIDATION_ERROR",
        `Máximo ${MAX_AMAZON_RANK_KEYWORDS_PER_PROJECT} palabras clave por proyecto`,
      );
    }
    const added = await AmazonRankRepository.addKeyword({
      id: crypto.randomUUID(),
      projectId: context.projectId,
      asin: data.asin,
      keyword: data.keyword,
      marketplace: data.marketplace,
    });
    return { added };
  });

export const deleteAmazonRankKeyword = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(amazonRankKeywordRefSchema)
  .handler(async ({ data, context }) => {
    await AmazonRankRepository.deleteKeyword(context.projectId, data.keywordId);
    return { ok: true };
  });

export const startAmazonRankCheck = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(amazonRankKeywordRefSchema)
  .handler(async ({ data, context }) => {
    const keyword = await requireKeyword(context.projectId, data.keywordId);
    const marketplace = getAmazonMarketplace(
      keyword.marketplace as AmazonMarketplaceCode,
    );
    const dataforseo = createDataforseoClient(context);
    const taskId = await dataforseo.merchant.productsTaskPost({
      keyword: keyword.keyword,
      locationCode: marketplace.locationCode,
      languageCode: marketplace.languageCode,
      seDomain: marketplace.seDomain,
    });
    return { taskId };
  });

export const getAmazonRankCheckStatus = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(getAmazonRankCheckStatusSchema)
  .handler(async ({ data, context }) => {
    const keyword = await requireKeyword(context.projectId, data.keywordId);
    const outcome = await fetchAmazonProductsRank({
      taskId: data.taskId,
      asin: keyword.asin,
    });
    if (outcome.status === "completed") {
      await AmazonRankRepository.recordCheck({
        id: data.taskId,
        keywordId: keyword.id,
        checkedAt: new Date().toISOString(),
        ...outcome.result,
      });
    }
    return { status: outcome.status };
  });
