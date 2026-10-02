import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { productOpportunitySchema } from "@/types/schemas/productOpportunity";
import {
  analyzeProductOpportunity,
  deleteSavedAnalysis,
  getSavedAnalysis,
  listSavedAnalyses,
} from "@/server/features/product-opportunity/ProductOpportunityService";
import { getAmazonMarketplace } from "@/shared/amazon-marketplaces";

export type {
  ProductOpportunityResult,
  SavedAnalysis,
} from "@/server/features/product-opportunity/ProductOpportunityService";

const projectSchema = z.object({ projectId: z.string().uuid() });
const analysisSchema = projectSchema.extend({ analysisId: z.string().uuid() });

export const analyzeNiche = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(productOpportunitySchema)
  .handler(({ data, context }) =>
    analyzeProductOpportunity({
      customer: context,
      projectId: data.projectId,
      keyword: data.keyword,
      marketplace: getAmazonMarketplace(data.marketplace),
      context: data.context || undefined,
    }),
  );

export const listNicheAnalyses = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(projectSchema)
  .handler(({ data }) => listSavedAnalyses(data.projectId));

export const getNicheAnalysis = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(analysisSchema)
  .handler(({ data }) => getSavedAnalysis(data.projectId, data.analysisId));

export const deleteNicheAnalysis = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(analysisSchema)
  .handler(({ data }) => deleteSavedAnalysis(data.projectId, data.analysisId));
