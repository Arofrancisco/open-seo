import { useQuery } from "@tanstack/react-query";
import { getAmazonAsinLookupStatus } from "@/serverFunctions/amazonAsin";

/**
 * Polls a queued Amazon ASIN lookup task until it leaves "pending". Same
 * refetchInterval-as-a-function shape as rank-tracking's
 * useRankRunPolling, simplified: this query's own data is the result, so
 * there's no separate results key to invalidate on completion.
 */
export function useAmazonAsinLookupPolling(
  projectId: string,
  taskId: string | null,
) {
  return useQuery({
    queryKey: ["amazonAsinLookup", projectId, taskId],
    queryFn: () =>
      getAmazonAsinLookupStatus({ data: { projectId, taskId: taskId! } }),
    enabled: taskId != null,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 3000 : false,
  });
}
