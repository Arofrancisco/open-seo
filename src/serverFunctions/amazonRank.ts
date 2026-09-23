import { createServerFn } from "@tanstack/react-start";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  addAmazonRankKeywordSchema,
  amazonRankKeywordRefSchema,
  listAmazonRankKeywordsSchema,
  MAX_AMAZON_RANK_KEYWORDS_PER_PROJECT,
} from "@/types/schemas/amazonRank";
import { AmazonRankRepository } from "@/server/features/amazon-rank/AmazonRankRepository";
import { AmazonRankService } from "@/server/features/amazon-rank/AmazonRankService";
import { AppError } from "@/server/lib/errors";

export type {
  AmazonRankCheckView,
  AmazonRankKeywordView,
} from "@/server/features/amazon-rank/AmazonRankService";

// Loading the list also collects any finished pending checks, so a result
// lands even when the page was closed while the check ran.
export const listAmazonRankKeywords = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listAmazonRankKeywordsSchema)
  .handler(({ context }) =>
    AmazonRankService.listKeywordViews(context.projectId),
  );

// Full history for CSV/JSON export.
export const exportAmazonRankHistory = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listAmazonRankKeywordsSchema)
  .handler(({ context }) =>
    AmazonRankService.listKeywordViews(
      context.projectId,
      Number.POSITIVE_INFINITY,
    ),
  );

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
    await AmazonRankService.startCheck(
      context.projectId,
      data.keywordId,
      context,
    );
    return { ok: true };
  });

export const startAllAmazonRankChecks = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listAmazonRankKeywordsSchema)
  .handler(({ context }) =>
    AmazonRankService.startAllChecks(context.projectId, context),
  );
