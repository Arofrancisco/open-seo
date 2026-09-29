import { z } from "zod";
import { dataforseoGet, dataforseoPost } from "@/server/lib/dataforseo/core";
import {
  assertOk,
  buildTaskBilling,
  isNoResultsTask,
  isTaskInProgress,
  type DataforseoApiResponse,
  type DataforseoItemsTask,
  type DataforseoTaskLike,
} from "@/server/lib/dataforseo/envelope";
import { AppError } from "@/server/lib/errors";
import type { LlmScraperAnswer } from "@/shared/ai-visibility";

// LLM Scraper (ChatGPT): what the real chatgpt.com answers for a prompt,
// including the product cards it shows. Unlike LLM Responses (the plain API),
// this is what a shopper actually sees.
//
// task_post is where DataForSEO charges; collection is free for 30 days, so
// fetchLlmScraperTaskResult is deliberately not metered (same as Amazon tasks).

// task_post creates a billed task. A 5xx does not prove the provider skipped
// the charge, so it must never be replayed.
const NO_RETRY = { maxServerErrorRetries: 0 } as const;

type PostInput = {
  keyword: string;
  locationCode: number;
  /** Bare language code ("es"), unlike the Merchant API's "es_ES". */
  languageCode: string;
  /** "high" = priority queue (~1-5 min) at twice the price of the normal one. */
  priority?: "normal" | "high";
};

export async function postLlmScraperTask(
  input: PostInput,
): Promise<DataforseoApiResponse<string>> {
  const response = await dataforseoPost<DataforseoTaskLike & { id?: string }>(
    "/v3/ai_optimization/chat_gpt/llm_scraper/task_post",
    [
      {
        keyword: input.keyword,
        location_code: input.locationCode,
        language_code: input.languageCode,
        force_web_search: true,
        ...(input.priority === "high" ? { priority: 2 } : {}),
      },
    ],
    NO_RETRY,
  );
  const task = assertOk(response, { okTaskStatusCode: 20100 });
  if (!task.id) {
    throw new AppError("INTERNAL_ERROR", "DataForSEO did not return a task id");
  }
  return { data: task.id, billing: buildTaskBilling(task) };
}

const nullableString = z.string().nullable().optional();

const productSchema = z
  .object({
    title: nullableString,
    merchants: nullableString,
    url: nullableString,
    domain: nullableString,
  })
  .passthrough();

const itemSchema = z
  .object({
    type: z.string(),
    items: z.array(productSchema).nullable().optional(),
  })
  .passthrough();

const resultSchema = z
  .object({
    markdown: nullableString,
    sources: z
      .array(
        z
          .object({ title: nullableString, domain: nullableString, url: nullableString })
          .passthrough(),
      )
      .nullable()
      .optional(),
    fan_out_queries: z.array(z.string()).nullable().optional(),
    brand_entities: z
      .array(z.object({ title: nullableString }).passthrough())
      .nullable()
      .optional(),
    items: z.array(itemSchema).nullable().optional(),
  })
  .passthrough();

export type LlmScraperOutcome =
  | { status: "pending" }
  | { status: "failed" }
  | { status: "completed"; answer: LlmScraperAnswer };

function clean(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export async function fetchLlmScraperTaskResult(input: {
  taskId: string;
}): Promise<LlmScraperOutcome> {
  const response = await dataforseoGet<DataforseoItemsTask<unknown>>(
    `/v3/ai_optimization/chat_gpt/llm_scraper/task_get/advanced/${encodeURIComponent(input.taskId)}`,
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
    if (isNoResultsTask(task)) return { status: "failed" };
    throw new AppError(
      "INTERNAL_ERROR",
      task.status_message || `DataForSEO task failed (${task.status_code})`,
    );
  }

  const parsed = resultSchema.safeParse(task.result?.[0] ?? {});
  if (!parsed.success) return { status: "failed" };
  const result = parsed.data;

  const products = (result.items ?? [])
    .filter((item) => item.type === "chat_gpt_products")
    .flatMap((item) => item.items ?? [])
    .map((product) => ({
      title: clean(product.title),
      merchant: clean(product.merchants),
      domain: clean(product.domain),
      url: clean(product.url),
    }));

  return {
    status: "completed",
    answer: {
      text: result.markdown ?? "",
      products,
      brandEntities: (result.brand_entities ?? []).flatMap((entity) => {
        const title = clean(entity.title);
        return title ? [title] : [];
      }),
      sources: (result.sources ?? []).map((source) => ({
        title: clean(source.title),
        domain: clean(source.domain),
        url: clean(source.url),
      })),
      fanOutQueries: (result.fan_out_queries ?? []).slice(0, 20),
    },
  };
}
