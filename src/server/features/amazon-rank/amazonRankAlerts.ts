import type { AmazonRankCheckView } from "@/server/features/amazon-rank/AmazonRankService";

// A drop this size or more between two consecutive checks is worth flagging;
// smaller wobbles are normal SERP noise.
const POSITION_DROP_ALERT_THRESHOLD = 5;

export type AmazonRankAlert =
  | { type: "position_drop"; from: number; to: number }
  | { type: "fell_out_of_results" }
  | { type: "lost_amazon_choice" }
  | { type: "lost_best_seller" }
  | { type: "new_competitor"; asin: string; title: string | null };

/**
 * Compares the two most recent checks for a keyword and flags anything worth
 * a client's attention. Pure computation over data already loaded for the
 * table — no extra DataForSEO call or database write.
 */
export function computeAmazonRankAlerts(
  latest: AmazonRankCheckView,
  previous: AmazonRankCheckView | null,
  ownAsin: string,
): AmazonRankAlert[] {
  if (!previous) return [];
  const alerts: AmazonRankAlert[] = [];

  if (
    previous.organicPosition != null &&
    latest.organicPosition != null &&
    latest.organicPosition - previous.organicPosition >=
      POSITION_DROP_ALERT_THRESHOLD
  ) {
    alerts.push({
      type: "position_drop",
      from: previous.organicPosition,
      to: latest.organicPosition,
    });
  } else if (previous.organicPosition != null && latest.organicPosition == null) {
    alerts.push({ type: "fell_out_of_results" });
  }

  if (previous.isAmazonChoice && !latest.isAmazonChoice) {
    alerts.push({ type: "lost_amazon_choice" });
  }
  if (previous.isBestSeller && !latest.isBestSeller) {
    alerts.push({ type: "lost_best_seller" });
  }

  // An empty previous top-5 means no baseline (e.g. a check recorded before
  // this field existed), not that the results list was genuinely empty —
  // comparing against it would flag every current entry as "new".
  if (previous.topResults.length > 0) {
    const own = ownAsin.toUpperCase();
    const previousAsins = new Set(
      previous.topResults
        .map((item) => item.asin?.toUpperCase())
        .filter((asin): asin is string => Boolean(asin) && asin !== own),
    );
    for (const item of latest.topResults) {
      const asin = item.asin?.toUpperCase();
      if (!asin || asin === own || previousAsins.has(asin)) continue;
      alerts.push({ type: "new_competitor", asin, title: item.title });
    }
  }

  return alerts;
}
