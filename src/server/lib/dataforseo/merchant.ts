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

export async function postAmazonAsinTask(input: {
  asin: string;
  locationCode: number;
  languageCode: string;
}): Promise<DataforseoApiResponse<string>> {
  return postedTaskId(
    await dataforseoPost<DataforseoTaskLike & { id?: string }>(
      "/v3/merchant/amazon/asin/task_post",
      [
        {
          asin: input.asin,
          location_code: input.locationCode,
          language_code: input.languageCode,
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

export type AmazonAsinTaskOutcome =
  | { status: "pending" }
  | { status: "not_found" }
  | { status: "completed"; result: AmazonAsinResult };

/**
 * Collects a queued Amazon ASIN task. Deliberately not metered: collection is
 * free (the task was charged at task_post), so routing it through the
 * metering seam would charge twice — same pattern as
 * fetchBusinessDataTaskResult.
 */
export async function fetchAmazonAsinTaskResult(input: {
  taskId: string;
}): Promise<AmazonAsinTaskOutcome> {
  const response = await dataforseoGet<DataforseoItemsTask<unknown>>(
    `/v3/merchant/amazon/asin/task_get/advanced/${encodeURIComponent(input.taskId)}`,
  );

  const task = response?.tasks?.[0];
  if (!response || response.status_code !== 20000 || !task) {
    throw new AppError(
      "INTERNAL_ERROR",
      response?.status_message || "DataForSEO task_get failed",
    );
  }

  if (isTaskInProgress(task)) return { status: "pending" };

  if (task.status_code !== 20000) {
    // "No Search Results" covers an ASIN with no listing in this marketplace.
    if (isNoResultsTask(task)) return { status: "not_found" };
    throw new AppError(
      "INTERNAL_ERROR",
      task.status_message || `DataForSEO task failed (${task.status_code})`,
    );
  }

  const item = task.result?.[0]?.items?.[0];
  const parsed = amazonAsinResultSchema.safeParse(item ?? {});
  if (!parsed.success || !isRecord(item)) return { status: "not_found" };

  const data = parsed.data;
  return {
    status: "completed",
    result: {
      asin: data.asin ?? null,
      title: data.title ?? null,
      imageUrl: data.image_url ?? null,
      priceFrom: data.price_from ?? null,
      priceTo: data.price_to ?? null,
      currency: data.currency ?? null,
      percentageDiscount: data.percentage_discount ?? null,
      isAvailable: data.is_available ?? null,
      brand: data.author ?? null,
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
