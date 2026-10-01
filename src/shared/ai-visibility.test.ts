import { describe, expect, it } from "vitest";
import {
  analyzeAnswer,
  appears,
  competitorNames,
  countCompetitors,
  mentions,
  type LlmScraperAnswer,
} from "@/shared/ai-visibility";

const answer = (overrides: Partial<LlmScraperAnswer> = {}): LlmScraperAnswer => ({
  text: "",
  products: [],
  brandEntities: [],
  sources: [],
  fanOutQueries: [],
  ...overrides,
});

describe("mentions", () => {
  it("ignores accents and case but not word boundaries", () => {
    expect(mentions("Zapatillas de running de ÁCME", "acme")).toBe(true);
    expect(mentions("Acmeria vende zapatillas", "Acme")).toBe(false);
  });
});

describe("analyzeAnswer", () => {
  it("finds the brand's position among the product cards by seller or domain", () => {
    const result = analyzeAnswer(
      answer({
        products: [
          { title: "Zapatilla", merchant: "Otra tienda", domain: "otra.es", url: null },
          { title: "Zapatilla running", merchant: null, domain: "www.acme.es", url: null },
        ],
      }),
      ["acme"],
    );
    expect(result.brandProductPosition).toBe(2);
    expect(appears(result)).toBe(true);
  });

  it("reports no appearance when the brand is nowhere in the answer", () => {
    const result = analyzeAnswer(answer({ text: "Compra en Amazon" }), ["acme"]);
    expect(appears(result)).toBe(false);
  });
});

describe("countCompetitors", () => {
  it("counts each competitor once per answer and leaves the brand out", () => {
    const first = answer({
      products: [
        { title: null, merchant: "Rival", domain: null, url: null },
        { title: null, merchant: "Rival", domain: null, url: null },
        { title: null, merchant: "Acme", domain: null, url: null },
      ],
    });
    const second = answer({ brandEntities: ["rival", "Otro"] });
    expect(
      countCompetitors([competitorNames(first), competitorNames(second)], ["acme"]),
    ).toEqual([
      { name: "Rival", answers: 2 },
      { name: "Otro", answers: 1 },
    ]);
  });
});
