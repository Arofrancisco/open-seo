import { isHostedClientAuthMode } from "@/lib/auth-mode";
import {
  applyBillingMarkupUsd,
  AUTUMN_SEO_DATA_CREDITS_PER_USD,
} from "@/shared/billing";

/**
 * One brand lookup = 6 DataForSEO calls (aggregated_metrics + top_pages +
 * mentions_search × 2 platforms). Rounded up with headroom because
 * mentions_search is row-priced at the full 100-row sample per platform.
 */
const BRAND_LOOKUP_RAW_COST_USD = 0.85;

/**
 * Adding competitors triggers 2 extra cross_aggregated_metrics calls (one per
 * platform). Measured live (Jun 2026) at $0.101 each — $0.202 total for a
 * 4-group comparison — via `pnpm billing:brand-lookup --competitors=...`. A
 * fixed estimate, marked up once at module load exactly like the base.
 */
const BRAND_LOOKUP_COMPETITOR_RAW_COST_USD = 0.2;

// Hosted customers are billed the marked-up USD; self-hosted users pay
// DataForSEO directly at the raw rate.
const markup = (rawUsd: number) =>
  isHostedClientAuthMode() ? applyBillingMarkupUsd(rawUsd) : rawUsd;

export const BRAND_LOOKUP_DISPLAYED_COST_USD = markup(BRAND_LOOKUP_RAW_COST_USD);
export const BRAND_LOOKUP_COMPETITOR_DISPLAYED_COST_USD = markup(
  BRAND_LOOKUP_COMPETITOR_RAW_COST_USD,
);

/** Estimated credits, rounded to tens so the figure reads as an estimate. */
export function estimatedCredits(usd: number): number {
  return Math.round((usd * AUTUMN_SEO_DATA_CREDITS_PER_USD) / 10) * 10;
}
