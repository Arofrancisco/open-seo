import { createServerFn } from "@tanstack/react-start";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  startAmazonAsinLookupSchema,
  getAmazonAsinLookupStatusSchema,
} from "@/types/schemas/amazonAsin";
import {
  createDataforseoClient,
  fetchAmazonAsinTaskResult,
} from "@/server/lib/dataforseo";
import { getAmazonMarketplace } from "@/shared/amazon-marketplaces";

export const startAmazonAsinLookup = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(startAmazonAsinLookupSchema)
  .handler(async ({ data, context }) => {
    const marketplace = getAmazonMarketplace(data.marketplace);
    const dataforseo = createDataforseoClient(context);
    const taskId = await dataforseo.merchant.asinTaskPost({
      asin: data.asin,
      locationCode: marketplace.locationCode,
      languageCode: marketplace.languageCode,
    });
    return { taskId };
  });

export const getAmazonAsinLookupStatus = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(getAmazonAsinLookupStatusSchema)
  .handler(async ({ data }) =>
    fetchAmazonAsinTaskResult({ taskId: data.taskId }),
  );
