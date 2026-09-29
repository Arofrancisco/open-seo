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
    expect(mentions("Delantales de Rizo de SÁOTI", "saoti")).toBe(true);
    expect(mentions("Saori vende delantales", "Sao")).toBe(false);
  });
});

describe("analyzeAnswer", () => {
  it("finds the brand's position among the product cards by seller or domain", () => {
    const result = analyzeAnswer(
      answer({
        products: [
          { title: "Delantal", merchant: "Otra tienda", domain: "otra.es", url: null },
          { title: "Delantal rizo", merchant: null, domain: "www.vellora.es", url: null },
        ],
      }),
      ["vellora"],
    );
    expect(result.brandProductPosition).toBe(2);
    expect(appears(result)).toBe(true);
  });

  it("reports no appearance when the brand is nowhere in the answer", () => {
    const result = analyzeAnswer(answer({ text: "Compra en Amazon" }), ["vellora"]);
    expect(appears(result)).toBe(false);
  });
});

describe("countCompetitors", () => {
  it("counts each competitor once per answer and leaves the brand out", () => {
    const first = answer({
      products: [
        { title: null, merchant: "Rival", domain: null, url: null },
        { title: null, merchant: "Rival", domain: null, url: null },
        { title: null, merchant: "Vellora", domain: null, url: null },
      ],
    });
    const second = answer({ brandEntities: ["rival", "Otro"] });
    expect(
      countCompetitors([competitorNames(first), competitorNames(second)], ["vellora"]),
    ).toEqual([
      { name: "Rival", answers: 2 },
      { name: "Otro", answers: 1 },
    ]);
  });
});
