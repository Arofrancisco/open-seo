import type { BillingCustomerContext } from "@/server/billing/subscription";
import {
  createDataforseoClient,
  fetchLlmScraperTaskResult,
} from "@/server/lib/dataforseo";
import { getAmazonMarketplace } from "@/shared/amazon-marketplaces";
import {
  analyzeAnswer,
  appears,
  countCompetitors,
  MAX_QUESTIONS_PER_PROJECT,
  RUNS_PER_QUESTION,
  toAiVisibilityMarketplace,
  type AiVisibilityMarketplace,
  type CompetitorCount,
  type LlmScraperAnswer,
} from "@/shared/ai-visibility";
import {
  AiVisibilityRepository as Repo,
  type CheckItemRow,
  type CheckRow,
  type QuestionRow,
} from "@/server/features/ai-visibility/AiVisibilityRepository";

// A task that still can't be collected after a day is recorded as failed so
// the question can be launched again.
const PENDING_GIVE_UP_MS = 24 * 60 * 60 * 1000;
const HISTORY_POINTS = 8;
const MAX_SOURCES_STORED = 15;

export type AiVisibilityBatchView = {
  batchId: string;
  createdAt: string;
  total: number;
  pending: number;
  failed: number;
  /** Answers that name the brand anywhere (text, product cards or sources). */
  appeared: number;
  /** Answers that show the brand among the product cards. */
  inProducts: number;
  /** Answers whose cited sources include the brand's own site. */
  cited: number;
  bestProductPosition: number | null;
  competitors: CompetitorCount[];
  fanOutQueries: string[];
};

export type AiVisibilityQuestionView = {
  id: string;
  question: string;
  marketplace: AiVisibilityMarketplace;
  latest: AiVisibilityBatchView | null;
  /** Earlier finished launches, oldest first. */
  history: { createdAt: string; appeared: number; total: number }[];
};

export type AiVisibilityOverview = {
  brandTerms: string[];
  runsPerQuestion: number;
  maxQuestions: number;
  questions: AiVisibilityQuestionView[];
};

/** Names ChatGPT put forward in one stored answer, and its fan-out queries. */
function readItems(items: CheckItemRow[]): { names: string[]; fanOut: string[] } {
  const names: string[] = [];
  const fanOut: string[] = [];
  for (const item of items) {
    if (item.kind === "product") {
      const name = (item.merchant ?? item.domain)?.trim();
      if (name) names.push(name);
    } else if (item.kind === "brand" && item.title) {
      names.push(item.title);
    } else if (item.kind === "fan_out" && item.title) {
      fanOut.push(item.title);
    }
  }
  return { names, fanOut };
}

function buildBatchView(
  checks: CheckRow[],
  itemsByCheck: Map<string, CheckItemRow[]>,
  terms: string[],
): AiVisibilityBatchView {
  const done = checks.filter((check) => check.checkedAt != null && !check.failed);
  const positions = done.flatMap((check) =>
    check.brandProductPosition == null ? [] : [check.brandProductPosition],
  );
  const perCheck = done.map((check) => readItems(itemsByCheck.get(check.id) ?? []));
  const fanOutCounts = new Map<string, number>();
  for (const { fanOut } of perCheck) {
    for (const query of new Set(fanOut)) {
      fanOutCounts.set(query, (fanOutCounts.get(query) ?? 0) + 1);
    }
  }
  return {
    batchId: checks[0].batchId,
    createdAt: checks[0].createdAt,
    total: checks.length,
    pending: checks.filter((check) => check.checkedAt == null).length,
    failed: checks.filter((check) => check.failed).length,
    appeared: done.filter((check) =>
      appears({
        brandInText: check.brandInText === true,
        brandProductPosition: check.brandProductPosition,
        brandCited: check.brandCited === true,
      }),
    ).length,
    inProducts: positions.length,
    cited: done.filter((check) => check.brandCited === true).length,
    bestProductPosition: positions.length > 0 ? Math.min(...positions) : null,
    competitors: countCompetitors(
      perCheck.map(({ names }) => names),
      terms,
    ),
    fanOutQueries: [...fanOutCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([query]) => query),
  };
}

async function markFailed(checkId: string) {
  await Repo.recordCheck(checkId, {
    checkedAt: new Date().toISOString(),
    failed: true,
    brandInText: null,
    brandProductPosition: null,
    brandCited: null,
  });
}

function itemRow(
  checkId: string,
  kind: string,
  position: number,
  fields: {
    title?: string | null;
    merchant?: string | null;
    domain?: string | null;
    url?: string | null;
  },
) {
  return {
    id: crypto.randomUUID(),
    checkId,
    kind,
    position,
    title: fields.title ?? null,
    merchant: fields.merchant ?? null,
    domain: fields.domain ?? null,
    url: fields.url ?? null,
  };
}

async function storeAnswer(
  checkId: string,
  answer: LlmScraperAnswer,
  terms: string[],
) {
  const analysis = analyzeAnswer(answer, terms);
  const won = await Repo.recordCheck(checkId, {
    checkedAt: new Date().toISOString(),
    failed: false,
    brandInText: analysis.brandInText,
    brandProductPosition: analysis.brandProductPosition,
    brandCited: analysis.brandCited,
  });
  if (!won) return;
  await Repo.insertItems([
    ...answer.products.map((product, i) => itemRow(checkId, "product", i + 1, product)),
    ...answer.brandEntities.map((title, i) => itemRow(checkId, "brand", i + 1, { title })),
    ...answer.sources
      .slice(0, MAX_SOURCES_STORED)
      .map((source, i) => itemRow(checkId, "source", i + 1, source)),
    ...answer.fanOutQueries.map((title, i) => itemRow(checkId, "fan_out", i + 1, { title })),
  ]);
}

async function collectCheck(check: CheckRow, terms: string[]) {
  const tooOld = Date.now() - Date.parse(check.createdAt) > PENDING_GIVE_UP_MS;
  try {
    const outcome = await fetchLlmScraperTaskResult({ taskId: check.taskId });
    if (outcome.status === "pending") {
      if (tooOld) await markFailed(check.id);
      return;
    }
    if (outcome.status === "failed") {
      await markFailed(check.id);
      return;
    }
    await storeAnswer(check.id, outcome.answer, terms);
  } catch (error) {
    if (tooOld) {
      await markFailed(check.id);
      return;
    }
    console.warn("ai-visibility.collect-failed", { checkId: check.id, error });
  }
}

/** Collecting finished answers is free: the task was paid at post time. */
async function advancePending(checks: CheckRow[], terms: string[]): Promise<boolean> {
  const pending = checks.filter((check) => check.checkedAt == null);
  await Promise.all(pending.map((check) => collectCheck(check, terms)));
  return pending.length > 0;
}

function groupBatches(checks: CheckRow[]): CheckRow[][] {
  const batches = new Map<string, CheckRow[]>();
  for (const check of checks) {
    const list = batches.get(check.batchId);
    if (list) list.push(check);
    else batches.set(check.batchId, [check]);
  }
  return [...batches.values()];
}

function buildQuestionView(
  question: QuestionRow,
  allChecks: CheckRow[],
  itemsByCheck: Map<string, CheckItemRow[]>,
  terms: string[],
): AiVisibilityQuestionView {
  // Checks arrive newest first, so the first batch is the latest launch.
  const views = groupBatches(
    allChecks.filter((check) => check.questionId === question.id),
  ).map((batch) => buildBatchView(batch, itemsByCheck, terms));
  const history = views
    .slice(1, HISTORY_POINTS + 1)
    .filter((view) => view.pending === 0 && view.total > view.failed)
    .map((view) => ({
      createdAt: view.createdAt,
      appeared: view.appeared,
      total: view.total - view.failed,
    }))
    .reverse();
  return {
    id: question.id,
    question: question.question,
    marketplace: toAiVisibilityMarketplace(question.marketplace),
    latest: views[0] ?? null,
    history,
  };
}

async function getOverview(projectId: string): Promise<AiVisibilityOverview> {
  const [terms, questions] = await Promise.all([
    Repo.getBrandTerms(projectId),
    Repo.listQuestions(projectId),
  ]);
  const questionIds = questions.map((question) => question.id);

  let checks = await Repo.listChecks(questionIds);
  if (await advancePending(checks, terms)) {
    checks = await Repo.listChecks(questionIds);
  }
  const items = await Repo.listItems(
    checks.filter((check) => check.checkedAt != null).map((check) => check.id),
  );
  const itemsByCheck = new Map<string, CheckItemRow[]>();
  for (const item of items) {
    const list = itemsByCheck.get(item.checkId);
    if (list) list.push(item);
    else itemsByCheck.set(item.checkId, [item]);
  }

  return {
    brandTerms: terms,
    runsPerQuestion: RUNS_PER_QUESTION,
    maxQuestions: MAX_QUESTIONS_PER_PROJECT,
    questions: questions.map((question) =>
      buildQuestionView(question, checks, itemsByCheck, terms),
    ),
  };
}

async function saveBrandTerms(projectId: string, terms: string[]) {
  const unique = [...new Set(terms.map((term) => term.trim()).filter(Boolean))];
  await Repo.setBrandTerms(projectId, unique);
}

async function addQuestion(input: {
  projectId: string;
  question: string;
  marketplace: AiVisibilityMarketplace;
}): Promise<{ problem: string | null }> {
  const existing = await Repo.listQuestions(input.projectId);
  if (existing.length >= MAX_QUESTIONS_PER_PROJECT) {
    return {
      problem: `Máximo ${MAX_QUESTIONS_PER_PROJECT} preguntas por proyecto. Borra alguna para añadir otra.`,
    };
  }
  const question = input.question.replace(/\s+/g, " ").trim();
  const duplicate = existing.some(
    (row) =>
      row.marketplace === input.marketplace &&
      row.question.toLowerCase() === question.toLowerCase(),
  );
  if (duplicate) return { problem: "Ya tienes esa pregunta." };
  await Repo.insertQuestion({
    id: crypto.randomUUID(),
    projectId: input.projectId,
    question,
    marketplace: input.marketplace,
  });
  return { problem: null };
}

async function removeQuestion(projectId: string, questionId: string) {
  await Repo.deleteQuestion(projectId, questionId);
}

/**
 * Asks each chosen question RUNS_PER_QUESTION times (ChatGPT does not answer
 * the same way twice). Stops at the first failure, e.g. out of credits: tasks
 * already posted are paid for, so they are kept.
 */
async function launch(input: {
  projectId: string;
  questionIds: string[];
  customer: BillingCustomerContext;
}): Promise<{
  posted: number;
  skipped: number;
  stoppedEarly: boolean;
  problem: string | null;
}> {
  const terms = await Repo.getBrandTerms(input.projectId);
  if (terms.length === 0) {
    return {
      posted: 0,
      skipped: 0,
      stoppedEarly: false,
      problem:
        "Primero guarda el nombre de tu marca (botón Guardar): sin él no podemos saber si te mencionan.",
    };
  }
  const questions = (await Repo.listQuestions(input.projectId)).filter((row) =>
    input.questionIds.includes(row.id),
  );
  const checks = await Repo.listChecks(questions.map((row) => row.id));
  const dataforseo = createDataforseoClient(input.customer);

  let posted = 0;
  let skipped = 0;
  for (const question of questions) {
    const busy = checks.some(
      (check) =>
        check.questionId === question.id &&
        check.checkedAt == null &&
        Date.now() - Date.parse(check.createdAt) < PENDING_GIVE_UP_MS,
    );
    if (busy) {
      skipped += 1;
      continue;
    }
    const marketplace = getAmazonMarketplace(
      toAiVisibilityMarketplace(question.marketplace),
    );
    const batchId = crypto.randomUUID();
    for (let run = 0; run < RUNS_PER_QUESTION; run += 1) {
      try {
        const taskId = await dataforseo.aiSearch.llmScraperTaskPost({
          keyword: question.question,
          locationCode: marketplace.locationCode,
          languageCode: marketplace.labsLanguageCode,
          priority: "high",
        });
        await Repo.insertCheck({
          id: crypto.randomUUID(),
          questionId: question.id,
          batchId,
          taskId,
        });
        posted += 1;
      } catch (error) {
        console.warn("ai-visibility.post-failed", { questionId: question.id, error });
        return { posted, skipped, stoppedEarly: true, problem: null };
      }
    }
  }
  return { posted, skipped, stoppedEarly: false, problem: null };
}

export const AiVisibilityService = {
  getOverview,
  saveBrandTerms,
  addQuestion,
  removeQuestion,
  launch,
} as const;
