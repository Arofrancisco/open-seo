/**
 * "¿Cuándo se busca?": options and pure helpers for Google Trends data.
 * Google Trends gives a relative index (0-100, 100 = the term's own peak in the
 * period), never a number of searches.
 */

export const TRENDS_MAX_KEYWORDS = 5;

/** DataForSEO Google Trends locations; codes checked against its official list (2026-09-01). */
export const TRENDS_LOCATIONS = [
  { code: 2724, label: "España", languageCode: "es" },
  { code: 20269, label: "Andalucía", languageCode: "es" },
  { code: 21386, label: "Aragón", languageCode: "es" },
  { code: 20286, label: "Asturias", languageCode: "es" },
  { code: 21387, label: "Islas Baleares", languageCode: "es" },
  { code: 20277, label: "Canarias", languageCode: "es" },
  { code: 20290, label: "Cantabria", languageCode: "es" },
  { code: 20276, label: "Castilla-La Mancha", languageCode: "es" },
  { code: 20278, label: "Cataluña", languageCode: "es" },
  { code: 20279, label: "Extremadura", languageCode: "es" },
  { code: 20280, label: "Galicia", languageCode: "es" },
  { code: 20281, label: "La Rioja", languageCode: "es" },
  { code: 20282, label: "Comunidad de Madrid", languageCode: "es" },
  { code: 20284, label: "Región de Murcia", languageCode: "es" },
  { code: 20285, label: "Navarra", languageCode: "es" },
  { code: 20289, label: "País Vasco", languageCode: "es" },
  { code: 21388, label: "Comunidad Valenciana", languageCode: "es" },
  { code: 2840, label: "Estados Unidos", languageCode: "en" },
] as const;

export type TrendsLocationCode = (typeof TRENDS_LOCATIONS)[number]["code"];
export const TRENDS_LOCATION_CODES = TRENDS_LOCATIONS.map(
  (location) => location.code,
);

export function trendsLocation(code: number) {
  return (
    TRENDS_LOCATIONS.find((location) => location.code === code) ??
    TRENDS_LOCATIONS[0]
  );
}

/** `froogle` is how the API names Google Shopping. */
export const TRENDS_SOURCES = [
  { value: "web", label: "Búsqueda de Google" },
  { value: "froogle", label: "Google Shopping" },
  { value: "youtube", label: "YouTube" },
  { value: "news", label: "Noticias" },
  { value: "images", label: "Imágenes" },
] as const;
export type TrendsSource = (typeof TRENDS_SOURCES)[number]["value"];
export const TRENDS_SOURCE_VALUES = ["web", "froogle", "youtube", "news", "images"] as const;

export const TRENDS_RANGES = [
  { value: "past_5_years", label: "Últimos 5 años (estacionalidad)" },
  { value: "past_12_months", label: "Últimos 12 meses" },
  { value: "past_90_days", label: "Últimos 90 días" },
] as const;
export type TrendsRange = (typeof TRENDS_RANGES)[number]["value"];
export const TRENDS_RANGE_VALUES = ["past_5_years", "past_12_months", "past_90_days"] as const;

export const TRENDS_ITEMS = ["graph", "map", "queries"] as const;
export type TrendsItem = (typeof TRENDS_ITEMS)[number];

/** Characters the API rejects inside a keyword. */
const FORBIDDEN_KEYWORD_CHARS = /[|"\-+=~!:*()[\]{},]/;

export function isValidTrendsKeyword(keyword: string): boolean {
  const trimmed = keyword.trim();
  return (
    trimmed.length >= 2 &&
    trimmed.length <= 100 &&
    !FORBIDDEN_KEYWORD_CHARS.test(trimmed)
  );
}

export type TrendsPoint = {
  /** ISO date of the start of the period. */
  from: string;
  /** One value per keyword, in request order; null when Google has no data. */
  values: (number | null)[];
};

export type KeywordSummary = {
  keyword: string;
  average: number;
  peakFrom: string | null;
  peakValue: number | null;
};

export function summarizeKeywords(
  keywords: string[],
  points: TrendsPoint[],
): KeywordSummary[] {
  return keywords.map((keyword, index) => {
    let sum = 0;
    let count = 0;
    let peakValue: number | null = null;
    let peakFrom: string | null = null;
    for (const point of points) {
      const value = point.values[index];
      if (value == null) continue;
      sum += value;
      count += 1;
      if (peakValue === null || value > peakValue) {
        peakValue = value;
        peakFrom = point.from;
      }
    }
    return {
      keyword,
      average: count > 0 ? Math.round(sum / count) : 0,
      peakFrom,
      peakValue,
    };
  });
}

/**
 * Average interest per calendar month (index 0 = January) over several years,
 * so the yearly pattern stands out. Needs at least two years of data to mean
 * anything; returns null otherwise.
 */
export function monthlySeasonality(
  points: TrendsPoint[],
  keywordIndex: number,
): number[] | null {
  const sums = new Array<number>(12).fill(0);
  const counts = new Array<number>(12).fill(0);
  const years = new Set<number>();
  for (const point of points) {
    const value = point.values[keywordIndex];
    if (value == null) continue;
    const date = new Date(`${point.from}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) continue;
    sums[date.getUTCMonth()] += value;
    counts[date.getUTCMonth()] += 1;
    years.add(date.getUTCFullYear());
  }
  if (years.size < 2) return null;
  return sums.map((sum, month) =>
    counts[month] > 0 ? Math.round(sum / counts[month]) : 0,
  );
}

export function bestMonths(seasonality: number[], count = 3): number[] {
  return seasonality
    .map((value, month) => ({ value, month }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, count)
    .map((entry) => entry.month);
}
