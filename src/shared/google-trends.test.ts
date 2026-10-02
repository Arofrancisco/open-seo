import { describe, expect, it } from "vitest";
import {
  bestMonths,
  dropIncompletePeriod,
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

describe("dropIncompletePeriod", () => {
  const p = (from: string, to?: string): TrendsPoint => ({ from, to, values: [50] });

  it("drops the last point while its period has not ended", () => {
    const result = dropIncompletePeriod(
      [p("2026-09-20", "2026-09-26"), p("2026-09-27", "2026-10-03")],
      "2026-10-02",
    );
    expect(result.points).toHaveLength(1);
    expect(result.dropped?.from).toBe("2026-09-27");
  });

  it("keeps everything when the last period is over or has no end date", () => {
    expect(dropIncompletePeriod([p("2026-09-20", "2026-09-26")], "2026-10-02").dropped).toBeNull();
    expect(dropIncompletePeriod([p("2026-09-27")], "2026-10-02").dropped).toBeNull();
  });
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
