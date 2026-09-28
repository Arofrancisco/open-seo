import type { BillingCustomerContext } from "@/server/billing/subscription";
import {
  createDataforseoClient,
  fetchAmazonAsinTaskResult,
  fetchAmazonProductsRank,
} from "@/server/lib/dataforseo";
import { AppError } from "@/server/lib/errors";
import {
  getAmazonMarketplace,
  type AmazonMarketplaceCode,
} from "@/shared/amazon-marketplaces";
import {
  mergeCandidates,
  planTitleKeywords,
  withAmazonVolumes,
  type ReverseAsinCandidate,
} from "@/shared/reverse-asin-candidates";
import {
  AmazonReverseAsinRepository as Repo,
  type ReverseAsinResultRow,
  type ReverseAsinRunRow,
  type ReverseAsinStatus,
} from "@/server/features/amazon-reverse-asin/AmazonReverseAsinRepository";

// Google suggestions per seed. Every seed is queried: each title segment
// brings different buyer searches, and the Amazon volume lookup then ranks them.
const SUGGESTIONS_LIMIT = 25;
// Amazon searches use the priority queue (~1 minute); past a day a task that
// still can't be collected is recorded as "not found" so the run can finish.
const PENDING_GIVE_UP_MS = 24 * 60 * 60 * 1000;
const COLLECT_BATCH = 10;

export type ReverseAsinResultView = {
  keyword: string;
  amazonVolume: number | null;
  googleVolume: number | null;
  pending: boolean;
  organicPosition: number | null;
  sponsoredPosition: number | null;
  organicResultsScanned: number | null;
  isAmazonChoice: boolean | null;
  isBestSeller: boolean | null;
};

export type ReverseAsinRunView = {
  id: string;
  asin: string;
  marketplace: AmazonMarketplaceCode;
  status: ReverseAsinStatus;
  title: string | null;
  brand: string | null;
  createdAt: string;
  candidates: ReverseAsinCandidate[];
  results: ReverseAsinResultView[];
};

export type ReverseAsinRunSummary = Pick<
  ReverseAsinRunView,
  "id" | "asin" | "marketplace" | "status" | "title" | "createdAt"
>;

function parseCandidates(raw: string | null): ReverseAsinCandidate[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- written by generateCandidates from ReverseAsinCandidate[]
    return Array.isArray(parsed) ? (parsed as ReverseAsinCandidate[]) : [];
  } catch {
    return [];
  }
}

function toResultView(row: ReverseAsinResultRow): ReverseAsinResultView {
  return {
    keyword: row.keyword,
    amazonVolume: row.amazonVolume,
    googleVolume: row.googleVolume,
    pending: row.checkedAt == null,
    organicPosition: row.organicPosition,
    sponsoredPosition: row.sponsoredPosition,
    organicResultsScanned: row.organicResultsScanned,
    isAmazonChoice: row.isAmazonChoice,
    isBestSeller: row.isBestSeller,
  };
}

function toView(
  run: ReverseAsinRunRow,
  results: ReverseAsinResultRow[],
): ReverseAsinRunView {
  return {
    id: run.id,
    asin: run.asin,
    marketplace: run.marketplace as AmazonMarketplaceCode,
    status: run.status as ReverseAsinStatus,
    title: run.title,
    brand: run.brand,
    createdAt: run.createdAt,
    candidates: parseCandidates(run.candidates),
    results: results.map(toResultView),
  };
}

async function start(input: {
  projectId: string;
  asin: string;
  marketplace: AmazonMarketplaceCode;
  customer: BillingCustomerContext;
}): Promise<{ runId: string }> {
  const marketplace = getAmazonMarketplace(input.marketplace);
  const productTaskId = await createDataforseoClient(
    input.customer,
  ).merchant.asinTaskPost({
    asin: input.asin,
    locationCode: marketplace.locationCode,
    languageCode: marketplace.languageCode,
    seDomain: marketplace.seDomain,
    priority: "high",
  });
  const runId = crypto.randomUUID();
  await Repo.createRun({
    id: runId,
    projectId: input.projectId,
    asin: input.asin,
    marketplace: input.marketplace,
    status: "fetching_product",
    productTaskId,
  });
  return { runId };
}

/**
 * Title phrases are free; Google suggestions and the Amazon volume lookup are
 * paid Labs calls. If either fails (e.g. out of credits) the user still gets
 * the candidates gathered so far.
 */
async function generateCandidates(
  run: ReverseAsinRunRow,
  product: { title: string; brand: string | null },
  customer: BillingCustomerContext,
): Promise<ReverseAsinCandidate[]> {
  const marketplace = getAmazonMarketplace(
    run.marketplace as AmazonMarketplaceCode,
  );
  const plan = planTitleKeywords({
    title: product.title,
    brand: product.brand,
    labsLanguageCode: marketplace.labsLanguageCode,
  });

  const google: { keyword: string; googleVolume: number | null }[] = [];
  const dataforseo = createDataforseoClient(customer);
  try {
    for (const seed of plan.seeds) {
      const items = await dataforseo.keywords.suggestions({
        keyword: seed,
        locationCode: marketplace.locationCode,
        languageCode: marketplace.labsLanguageCode,
        limit: SUGGESTIONS_LIMIT,
        creditFeature: "amazon",
      });
      for (const item of items) {
        if (item.keyword) {
          google.push({
            keyword: item.keyword,
            googleVolume: item.keyword_info?.search_volume ?? null,
          });
        }
      }
    }
  } catch (error) {
    console.warn("amazon-reverse-asin.suggestions-failed", {
      runId: run.id,
      error,
    });
  }

  const candidates = mergeCandidates({ google, titlePhrases: plan.titlePhrases });
  if (candidates.length === 0) return candidates;
  try {
    const items = await dataforseo.labs.amazonSearchVolume({
      keywords: candidates.map((candidate) => candidate.keyword),
      locationCode: marketplace.locationCode,
      languageCode: marketplace.labsLanguageCode,
    });
    const volumes = new Map(
      items.flatMap((item) =>
        item.keyword
          ? [[item.keyword.toLocaleLowerCase(), item.search_volume ?? null] as const]
          : [],
      ),
    );
    return withAmazonVolumes(candidates, volumes);
  } catch (error) {
    console.warn("amazon-reverse-asin.amazon-volume-failed", {
      runId: run.id,
      error,
    });
    return candidates;
  }
}

async function advanceProduct(
  run: ReverseAsinRunRow,
  customer: BillingCustomerContext,
) {
  if (!run.productTaskId) return;
  const outcome = await fetchAmazonAsinTaskResult({
    taskId: run.productTaskId,
    asin: run.asin,
  });
  if (outcome.status === "pending") return;
  if (outcome.status === "not_found" || !outcome.result.title) {
    await Repo.transition(run.id, "fetching_product", "not_found");
    return;
  }

  const product = {
    title: outcome.result.title,
    brand: outcome.result.brand,
  };
  const claimed = await Repo.transition(
    run.id,
    "fetching_product",
    "generating",
    product,
  );
  if (!claimed) return;

  const candidates = await generateCandidates(run, product, customer);
  await Repo.transition(run.id, "generating", "choosing_keywords", {
    candidates: JSON.stringify(candidates),
  });
}

async function collectResult(run: ReverseAsinRunRow, row: ReverseAsinResultRow) {
  try {
    const outcome = await fetchAmazonProductsRank({
      taskId: row.taskId,
      asin: run.asin,
    });
    if (outcome.status !== "completed") return;
    const { topResults: _topResults, ...rank } = outcome.result;
    await Repo.recordResult(row.id, {
      checkedAt: new Date().toISOString(),
      ...rank,
    });
  } catch (error) {
    if (Date.now() - Date.parse(run.createdAt) > PENDING_GIVE_UP_MS) {
      await Repo.recordResult(row.id, {
        checkedAt: new Date().toISOString(),
        organicPosition: null,
        sponsoredPosition: null,
        organicResultsScanned: 0,
        isAmazonChoice: null,
        isBestSeller: null,
      });
      return;
    }
    console.warn("amazon-reverse-asin.collect-failed", { resultId: row.id, error });
  }
}

/** Collecting finished Amazon searches is free: the task was paid at post time. */
async function advanceChecks(run: ReverseAsinRunRow) {
  const pending = (await Repo.listResults(run.id)).filter(
    (row) => row.checkedAt == null,
  );
  for (let i = 0; i < pending.length; i += COLLECT_BATCH) {
    await Promise.all(
      pending.slice(i, i + COLLECT_BATCH).map((row) => collectResult(run, row)),
    );
  }
  const stillPending = (await Repo.listResults(run.id)).some(
    (row) => row.checkedAt == null,
  );
  if (!stillPending) await Repo.transition(run.id, "checking", "done");
}

async function getView(input: {
  projectId: string;
  runId: string;
  customer: BillingCustomerContext;
}): Promise<ReverseAsinRunView> {
  const run = await Repo.getRun(input.projectId, input.runId);
  if (!run) throw new AppError("NOT_FOUND", "Análisis no encontrado");

  if (run.status === "fetching_product") {
    await advanceProduct(run, input.customer);
  } else if (run.status === "checking") {
    await advanceChecks(run);
  }

  const fresh = (await Repo.getRun(input.projectId, input.runId)) ?? run;
  return toView(fresh, await Repo.listResults(run.id));
}

/**
 * Posts one Amazon search per chosen keyword. Stops at the first failure (e.g.
 * out of credits): searches already posted are paid for, so they are kept.
 */
async function confirmKeywords(input: {
  projectId: string;
  runId: string;
  keywords: string[];
  customer: BillingCustomerContext;
}): Promise<{ posted: number; stoppedEarly: boolean }> {
  const run = await Repo.getRun(input.projectId, input.runId);
  if (!run) throw new AppError("NOT_FOUND", "Análisis no encontrado");
  const claimed = await Repo.transition(run.id, "choosing_keywords", "checking");
  if (!claimed) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Este análisis ya se ha lanzado. Recarga la página para ver el progreso.",
    );
  }

  const byKeyword = new Map(
    parseCandidates(run.candidates).map((candidate) => [
      candidate.keyword,
      candidate,
    ]),
  );
  const marketplace = getAmazonMarketplace(
    run.marketplace as AmazonMarketplaceCode,
  );
  const dataforseo = createDataforseoClient(input.customer);
  const keywords = [...new Set(input.keywords)];

  // Keywords typed by hand weren't in the candidate lookup: fetch their Amazon
  // volume now. Not worth failing the run over, so errors are ignored.
  const manual = keywords.filter((keyword) => !byKeyword.has(keyword));
  const manualVolumes = new Map<string, number | null>();
  if (manual.length > 0) {
    try {
      const items = await dataforseo.labs.amazonSearchVolume({
        keywords: manual,
        locationCode: marketplace.locationCode,
        languageCode: marketplace.labsLanguageCode,
      });
      for (const item of items) {
        if (item.keyword) {
          manualVolumes.set(item.keyword.toLocaleLowerCase(), item.search_volume ?? null);
        }
      }
    } catch (error) {
      console.warn("amazon-reverse-asin.manual-volume-failed", { runId: run.id, error });
    }
  }

  let posted = 0;
  try {
    for (const keyword of keywords) {
      const taskId = await dataforseo.merchant.productsTaskPost({
        keyword,
        locationCode: marketplace.locationCode,
        languageCode: marketplace.languageCode,
        seDomain: marketplace.seDomain,
        priority: "high",
      });
      await Repo.insertResult({
        id: crypto.randomUUID(),
        runId: run.id,
        keyword,
        amazonVolume:
          byKeyword.get(keyword)?.amazonVolume ?? manualVolumes.get(keyword) ?? null,
        googleVolume: byKeyword.get(keyword)?.googleVolume ?? null,
        taskId,
      });
      posted++;
    }
  } catch (error) {
    if (posted === 0) {
      await Repo.transition(run.id, "checking", "choosing_keywords");
      throw error;
    }
    return { posted, stoppedEarly: true };
  }
  return { posted, stoppedEarly: false };
}

async function listRuns(projectId: string): Promise<ReverseAsinRunSummary[]> {
  const runs = await Repo.listRuns(projectId);
  return runs.map((run) => ({
    id: run.id,
    asin: run.asin,
    marketplace: run.marketplace as AmazonMarketplaceCode,
    status: run.status as ReverseAsinStatus,
    title: run.title,
    createdAt: run.createdAt,
  }));
}

export const AmazonReverseAsinService = {
  start,
  getView,
  confirmKeywords,
  listRuns,
} as const;
