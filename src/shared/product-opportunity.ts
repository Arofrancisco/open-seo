import { z } from "zod";

/**
 * Market sizing for "¿Qué producto lanzo?": turns the products Amazon shows
 * for a niche into the signals a launch decision needs — how much the niche
 * sells, at what price, how concentrated it is, and whether new brands get in.
 * Pure functions so the numbers can be tested without the API.
 */

export type MarketProductInput = {
  asin: string;
  title: string | null;
  price: number | null;
  currency: string | null;
  rating: number | null;
  votes: number | null;
  boughtPastMonth: number | null;
  sponsored: boolean;
  hasFormatLabels: boolean;
  isAmazonChoice: boolean;
  isBestSeller: boolean;
};

export type MarketProduct = Omit<
  MarketProductInput,
  "boughtPastMonth" | "sponsored" | "hasFormatLabels"
> & {
  /** Monthly units after fixing the "thousands" figure; null when unknown. */
  monthlySales: number | null;
  /** 1-based position among organic results; null when only seen as an ad. */
  organicPosition: number | null;
  advertised: boolean;
};

// Amazon only shows "bought in the past month" from 50 upwards, so a smaller
// figure is either "N mil" read as N, or a number lifted from the title
// (e.g. "18 MLD probióticos" read as 18). Only round thousands on a listing
// with real review volume are trusted as thousands; the rest stay unknown.
const MIN_SHOWN_BY_AMAZON = 50;
const MAX_THOUSANDS_FIGURE = 10;
const MIN_VOTES_FOR_THOUSANDS = 100;

export function normalizeBoughtPastMonth(
  bought: number | null,
  votes: number | null,
): number | null {
  if (bought === null || bought <= 0) return null;
  if (bought >= MIN_SHOWN_BY_AMAZON) return bought;
  const looksLikeThousands =
    Number.isInteger(bought) &&
    bought <= MAX_THOUSANDS_FIGURE &&
    (votes ?? 0) >= MIN_VOTES_FOR_THOUSANDS;
  return looksLikeThousands ? bought * 1000 : null;
}

/**
 * Drops books and other formatted media, merges an ASIN seen both as an ad and
 * organically, and fixes the sales figure. Keeps Amazon's order.
 */
export function cleanMarketProducts(
  items: MarketProductInput[],
): MarketProduct[] {
  const byAsin = new Map<string, MarketProduct>();
  let organicCount = 0;

  for (const item of items) {
    if (item.hasFormatLabels) continue;
    const organicPosition = item.sponsored ? null : ++organicCount;
    const existing = byAsin.get(item.asin);
    if (existing) {
      existing.organicPosition ??= organicPosition;
      existing.advertised ||= item.sponsored;
      continue;
    }
    byAsin.set(item.asin, {
      asin: item.asin,
      title: item.title,
      price: item.price,
      currency: item.currency,
      rating: item.rating,
      votes: item.votes,
      isAmazonChoice: item.isAmazonChoice,
      isBestSeller: item.isBestSeller,
      monthlySales: normalizeBoughtPastMonth(item.boughtPastMonth, item.votes),
      organicPosition,
      advertised: item.sponsored,
    });
  }
  return [...byAsin.values()];
}

// A listing that already sells well with few reviews is the clearest sign a
// newcomer can still win in this niche.
const NEWCOMER_MAX_VOTES = 100;
const NEWCOMER_MIN_SALES = 200;
const TOP_SELLERS = 10;

export type MarketSummary = {
  products: number;
  withSalesData: number;
  /** Sum of known monthly sales: a floor, since Amazon rounds down. */
  monthlySalesFloor: number;
  price: { min: number; median: number; max: number } | null;
  medianVotes: number | null;
  /** Share of known sales taken by the three best sellers, 0-1. */
  top3Share: number | null;
  topSellers: MarketProduct[];
  newcomers: MarketProduct[];
};

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1] + sorted[middle]) / 2
    : sorted[middle];
}

const isNumber = (value: number | null): value is number => value !== null;

// USD per million tokens (input, output). Unknown models are billed at the
// highest listed rate so a model swap can never undercharge.
const PRICE_PER_MTOK: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
};
const FALLBACK_PRICE = { input: 4, output: 20 };

export function claudeCostUsd(
  model: string,
  usage: { input_tokens: number; output_tokens: number },
): number {
  const price = PRICE_PER_MTOK[model] ?? FALLBACK_PRICE;
  return (
    (usage.input_tokens * price.input + usage.output_tokens * price.output) /
    1_000_000
  );
}

/** The model's verdict on a niche, rendered as-is on the page. */
export const nicheVerdictSchema = z.object({
  verdict: z.enum(["abierto", "competido", "cerrado"]),
  headline: z.string(),
  demand: z.string(),
  competition: z.string(),
  pricing: z.string(),
  newcomers: z.string(),
  risks: z.array(z.string()),
  nextSteps: z.array(z.string()),
});

export type NicheVerdict = z.infer<typeof nicheVerdictSchema>;

export function summarizeMarket(products: MarketProduct[]): MarketSummary {
  const selling = products
    .filter((product) => product.monthlySales !== null)
    .sort((a, b) => (b.monthlySales ?? 0) - (a.monthlySales ?? 0));
  const total = selling.reduce((sum, p) => sum + (p.monthlySales ?? 0), 0);
  const top3 = selling.slice(0, 3).reduce((s, p) => s + (p.monthlySales ?? 0), 0);

  const prices = products.map((p) => p.price).filter(isNumber);
  const medianPrice = median(prices);

  return {
    products: products.length,
    withSalesData: selling.length,
    monthlySalesFloor: total,
    price:
      medianPrice === null
        ? null
        : { min: Math.min(...prices), median: medianPrice, max: Math.max(...prices) },
    medianVotes: median(products.map((p) => p.votes).filter(isNumber)),
    top3Share: total > 0 ? top3 / total : null,
    topSellers: selling.slice(0, TOP_SELLERS),
    newcomers: selling.filter(
      (p) =>
        (p.votes ?? 0) < NEWCOMER_MAX_VOTES &&
        (p.monthlySales ?? 0) >= NEWCOMER_MIN_SALES,
    ),
  };
}
