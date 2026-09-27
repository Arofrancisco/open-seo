import { describe, expect, it } from "vitest";
import {
  defaultSelection,
  mergeCandidates,
  planTitleKeywords,
} from "@/shared/reverse-asin-candidates";

describe("planTitleKeywords", () => {
  it("drops brand, stopwords, numbers and units from a Spanish title", () => {
    const plan = planTitleKeywords({
      title:
        "Lavanix Bolsa de Lavado para Ropa Delicada, Pack de 6 Bolsas de Malla, 40 x 50 cm, Lencería y Sujetadores",
      brand: "Lavanix",
      labsLanguageCode: "es",
    });
    expect(plan.seeds).toEqual(["bolsa lavado ropa", "bolsa lavado"]);
    expect(plan.titlePhrases).toContain("bolsa lavado");
    expect(plan.titlePhrases).toContain("ropa delicada");
    expect(plan.titlePhrases).toContain("bolsas malla");
    expect(plan.titlePhrases).toContain("lavanix bolsa lavado");
    expect(plan.titlePhrases.join(" ")).not.toMatch(/\b(de|para|cm|40|50)\b/);
  });

  it("handles an English title with a pipe separator", () => {
    const plan = planTitleKeywords({
      title: "Acme Stainless Steel Water Bottle | 750 ml Insulated Flask for Sports",
      brand: "Acme",
      labsLanguageCode: "en",
    });
    expect(plan.seeds[0]).toBe("stainless steel water");
    expect(plan.titlePhrases).toContain("water bottle");
    expect(plan.titlePhrases).toContain("insulated flask");
  });

  it("returns a single-word seed when the title has one content word", () => {
    const plan = planTitleKeywords({
      title: "Acme Termómetro",
      brand: "Acme",
      labsLanguageCode: "es",
    });
    expect(plan.seeds).toEqual(["termómetro"]);
  });
});

describe("mergeCandidates", () => {
  it("orders Google by volume, de-duplicates and appends title phrases", () => {
    const merged = mergeCandidates({
      google: [
        { keyword: "Bolsa Lavado Ropa", googleVolume: 90 },
        { keyword: "bolsa lavadora", googleVolume: 2400 },
        { keyword: "bolsa lavado", googleVolume: null },
      ],
      titlePhrases: ["bolsa lavado", "ropa delicada"],
    });
    expect(merged.map((c) => c.keyword)).toEqual([
      "bolsa lavadora",
      "bolsa lavado ropa",
      "bolsa lavado",
      "ropa delicada",
    ]);
    expect(merged[2]!.source).toBe("google");
    expect(merged[3]!.source).toBe("title");
  });

  it("pre-selects Google keywords with volume and the title phrases", () => {
    const selection = defaultSelection([
      { keyword: "a", googleVolume: 10, source: "google" },
      { keyword: "b", googleVolume: 0, source: "google" },
      { keyword: "c", googleVolume: null, source: "title" },
    ]);
    expect(selection).toEqual(["a", "c"]);
  });
});
