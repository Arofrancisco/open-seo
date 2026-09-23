import { useQuery } from "@tanstack/react-query";
import { getAmazonAsinLookupStatus } from "@/serverFunctions/amazonAsin";
import type { AmazonLookupKind } from "@/types/schemas/amazonAsin";

export type AmazonLookupJob = {
  kind: AmazonLookupKind;
  asin: string;
  taskId: string;
};

/**
 * Polls a queued Amazon task until it leaves "pending". Same
 * refetchInterval-as-a-function shape as rank-tracking's useRankRunPolling,
 * simplified: this query's own data is the result.
 */
export function useAmazonAsinLookupPolling(
  projectId: string,
  job: AmazonLookupJob | null,
) {
  return useQuery({
    queryKey: ["amazonLookup", projectId, job?.kind, job?.taskId],
    queryFn: () =>
      getAmazonAsinLookupStatus({ data: { projectId, ...job! } }),
    enabled: job != null,
    refetchInterval: (query) =>
      query.state.data?.outcome.status === "pending" ? 3000 : false,
  });
}
