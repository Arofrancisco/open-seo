import { createServerFn } from "@tanstack/react-start";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { productOpportunitySchema } from "@/types/schemas/productOpportunity";
import { analyzeProductOpportunity } from "@/server/features/product-opportunity/ProductOpportunityService";
import { getAmazonMarketplace } from "@/shared/amazon-marketplaces";

export type { ProductOpportunityResult } from "@/server/features/product-opportunity/ProductOpportunityService";

export const analyzeNiche = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(productOpportunitySchema)
  .handler(({ data, context }) =>
    analyzeProductOpportunity({
      customer: context,
      keyword: data.keyword,
      marketplace: getAmazonMarketplace(data.marketplace),
      context: data.context || undefined,
    }),
  );
