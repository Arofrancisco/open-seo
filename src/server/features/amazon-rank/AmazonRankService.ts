import type { BillingCustomerContext } from "@/server/billing/subscription";
import {
  createDataforseoClient,
  fetchAmazonProductsRank,
  type AmazonTopResult,
} from "@/server/lib/dataforseo";
import {
  getAmazonMarketplace,
  type AmazonMarketplaceCode,
} from "@/shared/amazon-marketplaces";
import { AppError } from "@/server/lib/errors";
import {
  AmazonRankRepository,
  type AmazonRankCheckRow,
  type AmazonRankKeywordRow,
} from "@/server/features/amazon-rank/AmazonRankRepository";
import {
  computeAmazonRankAlerts,
  type AmazonRankAlert,
} from "@/server/features/amazon-rank/amazonRankAlerts";

// A pending task that still can't be collected after this long is dropped so
// the row doesn't spin forever (DataForSEO keeps results ~30 days, but the
// standard queue finishes within 45 minutes).
const PENDING_GIVE_UP_MS = 24 * 60 * 60 * 1000;
const HISTORY_IN_LIST = 20;

export type AmazonRankCheckView = {
  checkedAt: string;
  organicPosition: number | null;
  sponsoredPosition: number | null;
  organicResultsScanned: number;
  isAmazonChoice: boolean | null;
  isBestSeller: boolean | null;
  topResults: AmazonTopResult[];
};

export type AmazonRankKeywordView = {
  id: string;
  asin: string;
  keyword: string;
  marketplace: AmazonMarketplaceCode;
  pending: boolean;
  /** Newest first. */
  history: AmazonRankCheckView[];
  /** Computed from the two most recent checks; empty on the first check. */
  alerts: AmazonRankAlert[];
};

function parseTopResults(raw: string | null): AmazonTopResult[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- written by recordCheck from AmazonTopResult[]
    return Array.isArray(parsed) ? (parsed as AmazonTopResult[]) : [];
  } catch {
    return [];
  }
}

function toCheckView(check: AmazonRankCheckRow): AmazonRankCheckView {
  return {
    checkedAt: check.checkedAt,
    organicPosition: check.organicPosition,
    sponsoredPosition: check.sponsoredPosition,
    organicResultsScanned: check.organicResultsScanned,
    isAmazonChoice: check.isAmazonChoice,
    isBestSeller: check.isBestSeller,
    topResults: parseTopResults(check.topResults),
  };
}

/** Collects a keyword's pending task if it has finished. Collection is free. */
async function collectPending(keyword: AmazonRankKeywordRow): Promise<boolean> {
  const taskId = keyword.pendingTaskId;
  if (!taskId) return false;
  try {
    const outcome = await fetchAmazonProductsRank({
      taskId,
      asin: keyword.asin,
    });
    if (outcome.status !== "completed") return true;
    const { topResults, ...rank } = outcome.result;
    await AmazonRankRepository.recordCheck({
      id: taskId,
      keywordId: keyword.id,
      checkedAt: new Date().toISOString(),
      ...rank,
      topResults: JSON.stringify(topResults),
    });
    await AmazonRankRepository.clearPending(keyword.id, taskId);
    return false;
  } catch (error) {
    const since = keyword.pendingSince ? Date.parse(keyword.pendingSince) : 0;
    if (Date.now() - since > PENDING_GIVE_UP_MS) {
      await AmazonRankRepository.clearPending(keyword.id, taskId);
      return false;
    }
    console.warn("amazon-rank.collect-failed", { keywordId: keyword.id, error });
    return true;
  }
}

async function listKeywordViews(
  projectId: string,
  historyLimit: number = HISTORY_IN_LIST,
): Promise<AmazonRankKeywordView[]> {
  const keywords = await AmazonRankRepository.listKeywords(projectId);
  const stillPending = await Promise.all(keywords.map(collectPending));
  const checks = await AmazonRankRepository.listChecksForKeywords(
    keywords.map((keyword) => keyword.id),
  );
  const byKeyword = new Map<string, AmazonRankCheckView[]>();
  for (const check of checks) {
    const list = byKeyword.get(check.keywordId) ?? [];
    if (list.length < historyLimit) list.push(toCheckView(check));
    byKeyword.set(check.keywordId, list);
  }
  return keywords.map((keyword, index) => {
    const history = byKeyword.get(keyword.id) ?? [];
    const [latest = null, previous = null] = history;
    return {
      id: keyword.id,
      asin: keyword.asin,
      keyword: keyword.keyword,
      marketplace: keyword.marketplace as AmazonMarketplaceCode,
      pending: stillPending[index] ?? false,
      history,
      alerts: latest
        ? computeAmazonRankAlerts(latest, previous, keyword.asin)
        : [],
    };
  });
}

async function postCheck(
  keyword: AmazonRankKeywordRow,
  customer: BillingCustomerContext,
) {
  const marketplace = getAmazonMarketplace(
    keyword.marketplace as AmazonMarketplaceCode,
  );
  const taskId = await createDataforseoClient(
    customer,
  ).merchant.productsTaskPost({
    keyword: keyword.keyword,
    locationCode: marketplace.locationCode,
    languageCode: marketplace.languageCode,
    seDomain: marketplace.seDomain,
  });
  await AmazonRankRepository.setPending(keyword.id, taskId);
}

async function startCheck(
  projectId: string,
  keywordId: string,
  customer: BillingCustomerContext,
) {
  const keyword = await AmazonRankRepository.getKeyword(projectId, keywordId);
  if (!keyword) throw new AppError("NOT_FOUND", "Palabra clave no encontrada");
  // A check already in flight will land on its own; posting again would pay
  // twice for the same data.
  if (keyword.pendingTaskId) return;
  await postCheck(keyword, customer);
}

/** Posts a check for every idle keyword; stops at the first failure (e.g. out of credits). */
async function startAllChecks(
  projectId: string,
  customer: BillingCustomerContext,
): Promise<{ started: number; skipped: number }> {
  const keywords = await AmazonRankRepository.listKeywords(projectId);
  let started = 0;
  let skipped = 0;
  for (const keyword of keywords) {
    if (keyword.pendingTaskId) {
      skipped++;
      continue;
    }
    await postCheck(keyword, customer);
    started++;
  }
  return { started, skipped };
}

export const AmazonRankService = {
  listKeywordViews,
  startCheck,
  startAllChecks,
} as const;
