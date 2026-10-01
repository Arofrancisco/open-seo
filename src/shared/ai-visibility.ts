/**
 * "¿Te recomienda la IA?": pure logic for turning what ChatGPT answered into
 * "does it mention my brand" and "who does it recommend instead".
 */

export type LlmScraperProduct = {
  title: string | null;
  merchant: string | null;
  domain: string | null;
  url: string | null;
};

export type LlmScraperAnswer = {
  text: string;
  /** Product cards, in the order ChatGPT shows them. */
  products: LlmScraperProduct[];
  brandEntities: string[];
  sources: { title: string | null; domain: string | null; url: string | null }[];
  fanOutQueries: string[];
};

export type BrandAnalysis = {
  /** The brand is named in the answer text or listed as a brand entity. */
  brandInText: boolean;
  /** 1-based position among the product cards, or null if none is the brand's. */
  brandProductPosition: number | null;
  /** One of the cited sources is the brand's own site. */
  brandCited: boolean;
};

// Only the countries where the ChatGPT scraper has been verified.
export const AI_VISIBILITY_MARKETPLACES = ["ES", "US"] as const;
export type AiVisibilityMarketplace = (typeof AI_VISIBILITY_MARKETPLACES)[number];

export function toAiVisibilityMarketplace(value: string): AiVisibilityMarketplace {
  return AI_VISIBILITY_MARKETPLACES.find((code) => code === value) ?? "ES";
}

export const MAX_BRAND_TERMS = 5;
export const MAX_QUESTIONS_PER_PROJECT = 20;
export const RUNS_PER_QUESTION = 3;

/** Lowercase, no accents: "Ñ" and "é" must not make a brand invisible. */
function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-word match, so a brand called "Sao" does not match "Saori". Terms
 * that start or end with a symbol skip the boundary on that side.
 */
export function mentions(text: string | null | undefined, term: string): boolean {
  const needle = fold(term.trim());
  if (!text || !needle) return false;
  const leading = /^\w/.test(needle) ? "\\b" : "";
  const trailing = /\w$/.test(needle) ? "\\b" : "";
  return new RegExp(`${leading}${escapeRegExp(needle)}${trailing}`).test(
    fold(text),
  );
}

export function mentionsAny(
  text: string | null | undefined,
  terms: readonly string[],
): boolean {
  return terms.some((term) => mentions(text, term));
}

/** A term like "acme.es" or "acme" also matches the domain "www.acme.es". */
function domainMatches(domain: string | null, terms: readonly string[]): boolean {
  if (!domain) return false;
  const host = fold(domain);
  return terms.some((term) => {
    const needle = fold(term.trim()).replace(/\s+/g, "");
    return needle.length > 0 && host.includes(needle);
  });
}

export function productIsBrand(
  product: LlmScraperProduct,
  terms: readonly string[],
): boolean {
  return (
    mentionsAny(product.title, terms) ||
    mentionsAny(product.merchant, terms) ||
    domainMatches(product.domain, terms)
  );
}

export function analyzeAnswer(
  answer: LlmScraperAnswer,
  terms: readonly string[],
): BrandAnalysis {
  const index = answer.products.findIndex((product) =>
    productIsBrand(product, terms),
  );
  return {
    brandInText:
      mentionsAny(answer.text, terms) ||
      answer.brandEntities.some((entity) => mentionsAny(entity, terms)),
    brandProductPosition: index === -1 ? null : index + 1,
    brandCited: answer.sources.some(
      (source) =>
        domainMatches(source.domain, terms) || mentionsAny(source.title, terms),
    ),
  };
}

/** True when the answer names the brand anywhere a shopper could see it. */
export function appears(analysis: BrandAnalysis): boolean {
  return (
    analysis.brandInText ||
    analysis.brandProductPosition !== null ||
    analysis.brandCited
  );
}

export type CompetitorCount = { name: string; answers: number };

/** Names ChatGPT put forward in one answer: card sellers plus brand entities. */
export function competitorNames(answer: LlmScraperAnswer): string[] {
  return [
    ...answer.products.map((product) => product.merchant ?? product.domain),
    ...answer.brandEntities,
  ].flatMap((name) => (name?.trim() ? [name.trim()] : []));
}

/**
 * Who ChatGPT recommends instead, counted by how many of the answers name
 * them. Takes one list of names per answer; the brand's own names are left out.
 */
export function countCompetitors(
  namesPerAnswer: string[][],
  terms: readonly string[],
  limit = 8,
): CompetitorCount[] {
  const counts = new Map<string, CompetitorCount>();
  for (const names of namesPerAnswer) {
    const seen = new Set<string>();
    for (const name of names) {
      if (mentionsAny(name, terms) || domainMatches(name, terms)) continue;
      const key = fold(name);
      if (seen.has(key)) continue;
      seen.add(key);
      const entry = counts.get(key);
      if (entry) entry.answers += 1;
      else counts.set(key, { name, answers: 1 });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.answers - a.answers || a.name.localeCompare(b.name))
    .slice(0, limit);
}
