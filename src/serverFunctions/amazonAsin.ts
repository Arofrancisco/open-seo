import { createServerFn } from "@tanstack/react-start";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  startAmazonAsinLookupSchema,
  getAmazonAsinLookupStatusSchema,
} from "@/types/schemas/amazonAsin";
import {
  createDataforseoClient,
  fetchAmazonAsinTaskResult,
  fetchAmazonSellersTaskResult,
} from "@/server/lib/dataforseo";
import { getAmazonMarketplace } from "@/shared/amazon-marketplaces";

export const startAmazonAsinLookup = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(startAmazonAsinLookupSchema)
  .handler(async ({ data, context }) => {
    const marketplace = getAmazonMarketplace(data.marketplace);
    const dataforseo = createDataforseoClient(context);
    const input = {
      asin: data.asin,
      locationCode: marketplace.locationCode,
      languageCode: marketplace.languageCode,
      seDomain: marketplace.seDomain,
    };
    const taskId =
      data.kind === "sellers"
        ? await dataforseo.merchant.sellersTaskPost(input)
        : await dataforseo.merchant.asinTaskPost(input);
    return { taskId };
  });

export const getAmazonAsinLookupStatus = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(getAmazonAsinLookupStatusSchema)
  .handler(async ({ data }) => {
    const input = { taskId: data.taskId, asin: data.asin };
    return data.kind === "sellers"
      ? { kind: "sellers" as const, outcome: await fetchAmazonSellersTaskResult(input) }
      : { kind: "asin" as const, outcome: await fetchAmazonAsinTaskResult(input) };
  });
