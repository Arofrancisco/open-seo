import { createServerFn } from "@tanstack/react-start";
import { requireProjectContext } from "@/serverFunctions/middleware";
import { googleTrendsSchema } from "@/types/schemas/googleTrends";
import { createDataforseoClient } from "@/server/lib/dataforseo";
import { AppError } from "@/server/lib/errors";
import { trendsLocation } from "@/shared/google-trends";

export type { GoogleTrendsResult } from "@/server/lib/dataforseo/google-trends";

// A single-keyword request is required for related queries (API rule).
export const exploreGoogleTrends = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(googleTrendsSchema)
  .handler(({ data, context }) => {
    if (data.item === "queries" && data.keywords.length !== 1) {
      throw new AppError("VALIDATION_ERROR", "Las búsquedas relacionadas necesitan una sola palabra.");
    }
    return createDataforseoClient(context).keywords.trends({
      keywords: data.keywords,
      locationCode: data.locationCode,
      languageCode: trendsLocation(data.locationCode).languageCode,
      source: data.source,
      range: data.range,
      item: data.item,
    });
  });
