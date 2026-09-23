import { z } from "zod";
import { dataforseoGet, dataforseoPost } from "@/server/lib/dataforseo/core";
import {
  assertOk,
  buildTaskBilling,
  isNoResultsTask,
  isRecord,
  isTaskInProgress,
  type DataforseoApiResponse,
  type DataforseoItemsTask,
  type DataforseoResponseLike,
  type DataforseoTaskLike,
} from "@/server/lib/dataforseo/envelope";
import { AppError } from "@/server/lib/errors";

// task_post creates a billed task. A 5xx does not prove the provider skipped
// the charge, so it must never be replayed.
const NO_RETRY = { maxServerErrorRetries: 0 } as const;

/**
 * Validates a task_post response and returns the created task's id. Mirrors
 * business.ts's postedTaskId: 20100 "Task Created" is the success status for
 * posts, and a rejected post entry still carries the cost DataForSEO charged.
 */
function postedTaskId<T extends DataforseoTaskLike & { id?: string }>(
  response: DataforseoResponseLike<T> | null,
): DataforseoApiResponse<string> {
  const task = assertOk(response, { okTaskStatusCode: 20100 });
  if (!task.id) {
    throw new AppError(
      "INTERNAL_ERROR",
      "DataForSEO did not return a task id",
    );
  }
  return { data: task.id, billing: buildTaskBilling(task) };
}

type AmazonEndpoint = "asin" | "sellers" | "products";

type AmazonTaskInput = {
  asin: string;
  locationCode: number;
  /** Locale-style, e.g. "es_ES" — the Merchant API rejects bare "es". */
  languageCode: string;
  seDomain: string;
};

export function postAmazonAsinTask(
  input: AmazonTaskInput,
): Promise<DataforseoApiResponse<string>> {
  return postAmazonTask("asin", input);
}

export function postAmazonSellersTask(
  input: AmazonTaskInput,
): Promise<DataforseoApiResponse<string>> {
  return postAmazonTask("sellers", input);
}

async function postAmazonTask(
  endpoint: AmazonEndpoint,
  input: AmazonTaskInput,
): Promise<DataforseoApiResponse<string>> {
  return postedTaskId(
    await dataforseoPost<DataforseoTaskLike & { id?: string }>(
      `/v3/merchant/amazon/${endpoint}/task_post`,
      [
        {
          asin: input.asin,
          location_code: input.locationCode,
          language_code: input.languageCode,
          se_domain: input.seDomain,
        },
      ],
      NO_RETRY,
    ),
  );
}

const amazonAsinRatingSchema = z
  .object({
    value: z.number().nullable().optional(),
    votes_count: z.number().nullable().optional(),
    rating_max: z.number().nullable().optional(),
  })
  .passthrough()
  .nullable()
  .optional();

const amazonAsinResultSchema = z
  .object({
    asin: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    image_url: z.string().nullable().optional(),
    price_from: z.number().nullable().optional(),
    price_to: z.number().nullable().optional(),
    currency: z.string().nullable().optional(),
    percentage_discount: z.number().nullable().optional(),
    is_available: z.boolean().nullable().optional(),
    author: z.string().nullable().optional(),
    rating: amazonAsinRatingSchema,
    product_information: z.array(z.unknown()).nullable().optional(),
  })
  .passthrough();

export type AmazonAsinResult = {
  asin: string | null;
  title: string | null;
  imageUrl: string | null;
  priceFrom: number | null;
  priceTo: number | null;
  currency: string | null;
  percentageDiscount: number | null;
  isAvailable: boolean | null;
  brand: string | null;
  rating: {
    value: number | null;
    votesCount: number | null;
    ratingMax: number | null;
  } | null;
  bestSellersRank: string | null;
};

const BEST_SELLERS_RANK_RE = /best sellers rank[^a-z0-9]*(.+)/i;

/**
 * DataForSEO doesn't return Best Sellers Rank as a structured field — it's
 * buried as free text inside `product_information`'s nested sections. Best
 * effort: scan every string value for the label and return what follows.
 * Never throws on an unexpected shape, same defensive stance as
 * combinedQuestionItems in business.ts.
 */
export function extractBestSellersRank(
  productInformation: unknown,
): string | null {
  if (!Array.isArray(productInformation)) return null;

  const stack: unknown[] = [...productInformation];
  while (stack.length > 0) {
    const value = stack.pop();
    if (typeof value === "string") {
      const match = value.match(BEST_SELLERS_RANK_RE);
      if (match?.[1]) return match[1].trim();
    } else if (Array.isArray(value)) {
      stack.push(...value);
    } else if (isRecord(value)) {
      stack.push(...Object.values(value));
    }
  }
  return null;
}

export type AmazonTaskOutcome<T> =
  | { status: "pending" }
  | { status: "not_found" }
  | { status: "completed"; result: T };

export type AmazonAsinTaskOutcome = AmazonTaskOutcome<AmazonAsinResult>;

type CompletedAmazonTask =
  | { done: false; outcome: { status: "pending" } | { status: "not_found" } }
  | { done: true; task: DataforseoItemsTask<unknown> };

/**
 * Collects a queued Amazon task. Deliberately not metered: collection is free
 * (the task was charged at task_post), so routing it through the metering
 * seam would charge twice — same pattern as fetchBusinessDataTaskResult.
 */
async function collectAmazonTask(
  endpoint: AmazonEndpoint,
  taskId: string,
): Promise<CompletedAmazonTask> {
  const response = await dataforseoGet<DataforseoItemsTask<unknown>>(
    `/v3/merchant/amazon/${endpoint}/task_get/advanced/${encodeURIComponent(taskId)}`,
  );

  const task = response?.tasks?.[0];
  if (!response || response.status_code !== 20000 || !task) {
    throw new AppError(
      "INTERNAL_ERROR",
      response?.status_message || "DataForSEO task_get failed",
    );
  }

  if (isTaskInProgress(task)) {
    return { done: false, outcome: { status: "pending" } };
  }

  if (task.status_code !== 20000) {
    // "No Search Results" covers an ASIN with no listing in this marketplace.
    if (isNoResultsTask(task)) {
      return { done: false, outcome: { status: "not_found" } };
    }
    throw new AppError(
      "INTERNAL_ERROR",
      task.status_message || `DataForSEO task failed (${task.status_code})`,
    );
  }

  return { done: true, task };
}

const BRAND_PREFIX_RE = /^(marca|brand|marke|marque)\s*:\s*/i;

function cleanBrand(author: string | null | undefined): string | null {
  const brand = author?.replace(BRAND_PREFIX_RE, "").trim();
  return brand ? brand : null;
}

export async function fetchAmazonAsinTaskResult(input: {
  taskId: string;
  asin: string;
}): Promise<AmazonAsinTaskOutcome> {
  const collected = await collectAmazonTask("asin", input.taskId);
  if (!collected.done) return collected.outcome;

  const item = collected.task.result?.[0]?.items?.[0];
  const parsed = amazonAsinResultSchema.safeParse(item ?? {});
  if (!parsed.success || !isRecord(item)) return { status: "not_found" };

  const data = parsed.data;
  return {
    status: "completed",
    result: {
      asin: data.asin ?? input.asin,
      title: data.title ?? null,
      imageUrl: data.image_url ?? null,
      priceFrom: data.price_from ?? null,
      priceTo: data.price_to ?? null,
      currency: data.currency ?? null,
      percentageDiscount: data.percentage_discount ?? null,
      isAvailable: data.is_available ?? null,
      brand: cleanBrand(data.author),
      rating: data.rating
        ? {
            value: data.rating.value ?? null,
            votesCount: data.rating.votes_count ?? null,
            ratingMax: data.rating.rating_max ?? null,
          }
        : null,
      bestSellersRank: extractBestSellersRank(data.product_information),
    },
  };
}

const nullableString = z.string().nullable().optional();
const nullableNumber = z.number().nullable().optional();

const amazonSellerItemSchema = z
  .object({
    rank_absolute: nullableNumber,
    seller_name: nullableString,
    seller_url: nullableString,
    ships_from: nullableString,
    condition: nullableString,
    price: z
      .object({
        current: nullableNumber,
        regular: nullableNumber,
        currency: nullableString,
      })
      .passthrough()
      .nullable()
      .optional(),
    rating: z
      .object({
        value: nullableNumber,
        votes_count: nullableNumber,
        rating_max: nullableNumber,
      })
      .passthrough()
      .nullable()
      .optional(),
    delivery_info: z
      .object({
        delivery_message: nullableString,
        delivery_date_from: nullableString,
        delivery_date_to: nullableString,
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export type AmazonSellerOffer = {
  position: number | null;
  sellerName: string | null;
  sellerUrl: string | null;
  shipsFrom: string | null;
  condition: string | null;
  price: number | null;
  regularPrice: number | null;
  currency: string | null;
  ratingValue: number | null;
  ratingMax: number | null;
  ratingVotes: number | null;
  deliveryMessage: string | null;
};

export type AmazonSellersResult = {
  asin: string;
  title: string | null;
  offers: AmazonSellerOffer[];
};

export type AmazonSellersTaskOutcome = AmazonTaskOutcome<AmazonSellersResult>;

export async function fetchAmazonSellersTaskResult(input: {
  taskId: string;
  asin: string;
}): Promise<AmazonSellersTaskOutcome> {
  const collected = await collectAmazonTask("sellers", input.taskId);
  if (!collected.done) return collected.outcome;

  const first = collected.task.result?.[0];
  const rawItems = Array.isArray(first?.items) ? first.items : [];
  // One malformed offer shouldn't hide the rest of the sellers list.
  const offers = rawItems.flatMap((raw): AmazonSellerOffer[] => {
    const parsed = amazonSellerItemSchema.safeParse(raw);
    if (!parsed.success) return [];
    const item = parsed.data;
    return [
      {
        position: item.rank_absolute ?? null,
        sellerName: item.seller_name ?? null,
        sellerUrl: item.seller_url ?? null,
        shipsFrom: item.ships_from ?? null,
        condition: item.condition ?? null,
        price: item.price?.current ?? null,
        regularPrice: item.price?.regular ?? null,
        currency: item.price?.currency ?? null,
        ratingValue: item.rating?.value ?? null,
        ratingMax: item.rating?.rating_max ?? null,
        ratingVotes: item.rating?.votes_count ?? null,
        deliveryMessage: item.delivery_info?.delivery_message ?? null,
      },
    ];
  });

  const title = isRecord(first) && typeof first.title === "string" ? first.title : null;
  return {
    status: "completed",
    result: { asin: input.asin, title, offers },
  };
}

// ---------------------------------------------------------------------------
// Amazon search results (Products endpoint) — where an ASIN ranks for a
// keyword. One task = one SERP of up to 100 results, billed at task_post.
// ---------------------------------------------------------------------------

const AMAZON_SERP_DEPTH = 100;

export function postAmazonProductsTask(
  input: Omit<AmazonTaskInput, "asin"> & { keyword: string },
): Promise<DataforseoApiResponse<string>> {
  return dataforseoPost<DataforseoTaskLike & { id?: string }>(
    "/v3/merchant/amazon/products/task_post",
    [
      {
        keyword: input.keyword,
        location_code: input.locationCode,
        language_code: input.languageCode,
        se_domain: input.seDomain,
        depth: AMAZON_SERP_DEPTH,
      },
    ],
    NO_RETRY,
  ).then(postedTaskId);
}

const amazonSerpItemSchema = z
  .object({
    type: z.string(),
    rank_group: nullableNumber,
    data_asin: nullableString,
  })
  .passthrough();

export type AmazonKeywordRank = {
  /** 1-based among organic results; null when not in the scanned results. */
  organicPosition: number | null;
  sponsoredPosition: number | null;
  organicResultsScanned: number;
};

export type AmazonProductsTaskOutcome = AmazonTaskOutcome<AmazonKeywordRank>;

export async function fetchAmazonProductsRank(input: {
  taskId: string;
  asin: string;
}): Promise<AmazonProductsTaskOutcome> {
  const collected = await collectAmazonTask("products", input.taskId);
  if (!collected.done) {
    // No results for the keyword still counts as a finished check.
    return collected.outcome.status === "not_found"
      ? {
          status: "completed",
          result: {
            organicPosition: null,
            sponsoredPosition: null,
            organicResultsScanned: 0,
          },
        }
      : collected.outcome;
  }

  const first = collected.task.result?.[0];
  const rawItems = Array.isArray(first?.items) ? first.items : [];
  const items = rawItems.flatMap((raw) => {
    const parsed = amazonSerpItemSchema.safeParse(raw);
    return parsed.success ? [parsed.data] : [];
  });
  const asin = input.asin.toUpperCase();

  // Positions are counted within each list rather than trusting rank_group,
  // so gaps from unparsed items can't shift the reported position.
  const positionIn = (type: string) => {
    const list = items.filter((item) => item.type === type);
    const index = list.findIndex(
      (item) => item.data_asin?.toUpperCase() === asin,
    );
    return { position: index === -1 ? null : index + 1, count: list.length };
  };

  const organic = positionIn("amazon_serp");
  const sponsored = positionIn("amazon_paid");
  return {
    status: "completed",
    result: {
      organicPosition: organic.position,
      sponsoredPosition: sponsored.position,
      organicResultsScanned: organic.count,
    },
  };
}
