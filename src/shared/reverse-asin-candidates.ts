/**
 * Candidate keywords for the approximate Reverse ASIN: DataForSEO Labs has no
 * Amazon keyword data for most marketplaces (Spain included), so we guess the
 * searches a product could rank for from its title, then check each one on
 * Amazon. Pure functions, no I/O.
 */

export const MAX_REVERSE_ASIN_KEYWORDS = 50;
export const MAX_REVERSE_ASIN_CANDIDATES = 60;
const DEFAULT_SELECTED = 30;
const MAX_TITLE_PHRASES = 20;
const MAX_EXTRA_SEGMENT_SEEDS = 2;

export type ReverseAsinCandidate = {
  keyword: string;
  /** Amazon monthly searches in the marketplace; null when unknown. */
  amazonVolume: number | null;
  /** Google monthly searches in the marketplace's country; null when unknown. */
  googleVolume: number | null;
  source: "google" | "title";
};

const STOPWORDS: Record<string, readonly string[]> = {
  es: ["de", "del", "la", "las", "el", "los", "y", "e", "o", "u", "para", "con", "sin", "en", "por", "a", "al", "un", "una", "unos", "unas", "tu", "su", "sus", "mi", "que", "cm", "mm", "ml", "g", "kg", "l", "x", "uds", "ud", "unidades", "pack", "piezas", "pcs"],
  en: ["the", "a", "an", "and", "or", "for", "with", "without", "of", "in", "on", "to", "by", "your", "my", "cm", "mm", "ml", "g", "kg", "oz", "lb", "x", "pack", "pcs", "pieces", "count", "set"],
  de: ["der", "die", "das", "und", "oder", "für", "mit", "ohne", "von", "im", "in", "zu", "ein", "eine", "cm", "mm", "ml", "g", "kg", "x", "stück", "stk", "set"],
  fr: ["le", "la", "les", "de", "des", "du", "et", "ou", "pour", "avec", "sans", "en", "à", "au", "aux", "un", "une", "cm", "mm", "ml", "g", "kg", "x", "lot", "pièces", "pcs"],
  it: ["il", "lo", "la", "i", "gli", "le", "di", "del", "della", "e", "o", "per", "con", "senza", "in", "a", "al", "un", "una", "cm", "mm", "ml", "g", "kg", "x", "pezzi", "pz", "set"],
};

// Segment breaks in Amazon titles: commas, pipes, brackets, dashes between spaces.
const SEGMENT_SPLIT_RE = /[,|()[\]/:;–—+]|\s-\s/;
const WORD_RE = /[\p{L}\p{N}]+(?:['’][\p{L}]+)?/gu;

function words(text: string): string[] {
  return (text.toLocaleLowerCase().match(WORD_RE) ?? []).map((w) =>
    w.replace(/’/g, "'"),
  );
}

function contentWords(
  segment: string,
  stopwords: ReadonlySet<string>,
  brandWords: ReadonlySet<string>,
): string[] {
  return words(segment).filter(
    (word) =>
      word.length > 1 &&
      !/^\d+$/.test(word) &&
      !stopwords.has(word) &&
      !brandWords.has(word),
  );
}

function ngrams(tokens: readonly string[], size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i + size <= tokens.length; i++) {
    out.push(tokens.slice(i, i + size).join(" "));
  }
  return out;
}

export type TitleKeywordPlan = {
  /** Seeds for the Google keyword-suggestions lookup, most specific first. */
  seeds: string[];
  /** Phrases taken straight from the title, in title order. */
  titlePhrases: string[];
};

/**
 * Splits the title into segments (Amazon titles are "Brand Product Type, Feature,
 * Feature..."), drops the brand, stopwords, numbers and units, and returns the
 * 2–3 word phrases the product type is most likely searched with.
 */
export function planTitleKeywords(input: {
  title: string;
  brand: string | null;
  labsLanguageCode: string;
}): TitleKeywordPlan {
  const stopwords = new Set(STOPWORDS[input.labsLanguageCode] ?? STOPWORDS.en);
  const brandWords = new Set(input.brand ? words(input.brand) : []);
  const segments = input.title
    .split(SEGMENT_SPLIT_RE)
    .map((segment) => contentWords(segment, stopwords, brandWords))
    .filter((tokens) => tokens.length > 0);

  const [head = [], ...rest] = segments;
  const phrases = new Set<string>();
  // The first segment carries the product type: take its opening phrases first.
  for (const phrase of [
    ...ngrams(head.slice(0, 4), 2),
    ...ngrams(head.slice(0, 4), 3),
    ...rest.flatMap((tokens) => ngrams(tokens.slice(0, 4), 2)),
  ]) {
    phrases.add(phrase);
  }
  if (input.brand && head.length >= 2) {
    phrases.add(`${input.brand.toLocaleLowerCase()} ${head.slice(0, 2).join(" ")}`);
  }

  // Most specific first: a two-word seed like "stainless steel" pulls in
  // unrelated high-volume searches, so it is only a fallback.
  const seeds: string[] = [];
  if (head.length >= 3) seeds.push(head.slice(0, 3).join(" "));
  if (head.length >= 2) seeds.push(head.slice(0, 2).join(" "));
  if (head.length === 1) seeds.push(head[0]!);
  // Later segments usually hold the generic terms buyers search for
  // ("probióticos astaxantina", "piel acné rosácea"), while the head can be
  // little more than the product's own name.
  for (const tokens of rest.slice(0, MAX_EXTRA_SEGMENT_SEEDS)) {
    if (tokens.length >= 2) seeds.push(tokens.slice(0, 2).join(" "));
  }

  return {
    seeds: [...new Set(seeds)],
    titlePhrases: [...phrases].slice(0, MAX_TITLE_PHRASES),
  };
}

/**
 * Google suggestions first (highest volume first), then title phrases not
 * already covered. Keywords are trimmed, lower-cased and de-duplicated.
 */
export function mergeCandidates(input: {
  google: ReadonlyArray<{ keyword: string; googleVolume: number | null }>;
  titlePhrases: readonly string[];
}): ReverseAsinCandidate[] {
  const seen = new Set<string>();
  const out: ReverseAsinCandidate[] = [];
  const push = (candidate: ReverseAsinCandidate) => {
    const keyword = candidate.keyword.trim().toLocaleLowerCase();
    if (!keyword || seen.has(keyword)) return;
    seen.add(keyword);
    out.push({ ...candidate, keyword });
  };

  [...input.google]
    .sort((a, b) => (b.googleVolume ?? -1) - (a.googleVolume ?? -1))
    .forEach((item) => push({ ...item, amazonVolume: null, source: "google" }));
  input.titlePhrases.forEach((keyword) =>
    push({ keyword, amazonVolume: null, googleVolume: null, source: "title" }),
  );
  return out.slice(0, MAX_REVERSE_ASIN_CANDIDATES);
}

/**
 * Adds Amazon search volume and re-orders: most searched on Amazon first,
 * then by Google volume. Keywords the volume lookup didn't return keep null.
 */
export function withAmazonVolumes(
  candidates: readonly ReverseAsinCandidate[],
  volumes: ReadonlyMap<string, number | null>,
): ReverseAsinCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      amazonVolume: volumes.get(candidate.keyword) ?? candidate.amazonVolume,
    }))
    .sort(
      (a, b) =>
        (b.amazonVolume ?? -1) - (a.amazonVolume ?? -1) ||
        (b.googleVolume ?? -1) - (a.googleVolume ?? -1),
    );
}

/**
 * Pre-selects what people search for on Amazon; when Amazon volume is
 * unavailable, falls back to Google volume and then the title phrases.
 */
export function defaultSelection(
  candidates: readonly ReverseAsinCandidate[],
): string[] {
  const onAmazon = candidates.filter((c) => (c.amazonVolume ?? 0) > 0);
  const picked = onAmazon.length > 0
    ? onAmazon
    : [
        ...candidates.filter((c) => c.source === "google" && (c.googleVolume ?? 0) > 0).slice(0, 20),
        ...candidates.filter((c) => c.source === "title"),
      ];
  return picked.slice(0, DEFAULT_SELECTED).map((candidate) => candidate.keyword);
}
