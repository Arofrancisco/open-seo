import { describe, expect, it } from "vitest";
import {
  bestMonths,
  isValidTrendsKeyword,
  monthlySeasonality,
  summarizeKeywords,
  TRENDS_LOCATIONS,
  type TrendsPoint,
} from "@/shared/google-trends";

const point = (from: string, ...values: (number | null)[]): TrendsPoint => ({
  from,
  values,
});

describe("isValidTrendsKeyword", () => {
  it("rejects the characters the API refuses and too-short terms", () => {
    expect(isValidTrendsKeyword("zapatillas running")).toBe(true);
    expect(isValidTrendsKeyword("a")).toBe(false);
    expect(isValidTrendsKeyword("zapatillas-running")).toBe(false);
    expect(isValidTrendsKeyword("a,b")).toBe(false);
  });
});

describe("summarizeKeywords", () => {
  it("averages each keyword and finds its peak, ignoring missing data", () => {
    const summary = summarizeKeywords(
      ["a", "b"],
      [point("2026-01-01", 10, null), point("2026-02-01", 50, 40), point("2026-03-01", 30, 20)],
    );
    expect(summary[0]).toMatchObject({ average: 30, peakFrom: "2026-02-01", peakValue: 50 });
    expect(summary[1]).toMatchObject({ average: 30, peakFrom: "2026-02-01" });
  });
});

describe("monthlySeasonality", () => {
  it("needs at least two years of data", () => {
    expect(monthlySeasonality([point("2026-01-01", 10), point("2026-02-01", 20)], 0)).toBeNull();
  });

  it("averages by calendar month across years and ranks the best months", () => {
    const seasonality = monthlySeasonality(
      [
        point("2024-06-01", 80),
        point("2025-06-01", 100),
        point("2024-12-01", 20),
        point("2025-12-01", 40),
        point("2025-03-01", 50),
      ],
      0,
    );
    expect(seasonality?.[5]).toBe(90);
    expect(seasonality?.[11]).toBe(30);
    expect(bestMonths(seasonality ?? [], 2)).toEqual([5, 2]);
  });
});

describe("TRENDS_LOCATIONS", () => {
  it("lists Spain first, with Spanish as its language", () => {
    expect(TRENDS_LOCATIONS[0]).toMatchObject({ code: 2724, languageCode: "es" });
  });
});
