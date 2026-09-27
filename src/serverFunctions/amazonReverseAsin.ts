import { createServerFn } from "@tanstack/react-start";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  confirmReverseAsinKeywordsSchema,
  listReverseAsinRunsSchema,
  reverseAsinRunRefSchema,
  startReverseAsinSchema,
} from "@/types/schemas/amazonReverseAsin";
import { AmazonReverseAsinService } from "@/server/features/amazon-reverse-asin/AmazonReverseAsinService";

export type {
  ReverseAsinResultView,
  ReverseAsinRunSummary,
  ReverseAsinRunView,
} from "@/server/features/amazon-reverse-asin/AmazonReverseAsinService";

export const listReverseAsinRuns = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(listReverseAsinRunsSchema)
  .handler(({ context }) => AmazonReverseAsinService.listRuns(context.projectId));

export const startReverseAsin = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(startReverseAsinSchema)
  .handler(({ data, context }) =>
    AmazonReverseAsinService.start({
      projectId: context.projectId,
      asin: data.asin,
      marketplace: data.marketplace,
      customer: context,
    }),
  );

// Loading a run also advances it: reads the product once it is ready,
// generates the candidates, and collects finished Amazon searches.
export const getReverseAsinRun = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(reverseAsinRunRefSchema)
  .handler(({ data, context }) =>
    AmazonReverseAsinService.getView({
      projectId: context.projectId,
      runId: data.runId,
      customer: context,
    }),
  );

export const confirmReverseAsinKeywords = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(confirmReverseAsinKeywordsSchema)
  .handler(({ data, context }) =>
    AmazonReverseAsinService.confirmKeywords({
      projectId: context.projectId,
      runId: data.runId,
      keywords: data.keywords,
      customer: context,
    }),
  );
