import { describe, expect, it } from "vitest";
import {
  defaultSelection,
  mergeCandidates,
  planTitleKeywords,
  stripAccents,
  volumeLookupKeywords,
  withAmazonVolumes,
} from "@/shared/reverse-asin-candidates";

describe("planTitleKeywords", () => {
  it("drops brand, stopwords, numbers and units from a Spanish title", () => {
    const plan = planTitleKeywords({
      title:
        "Lavanix Bolsa de Lavado para Ropa Delicada, Pack de 6 Bolsas de Malla, 40 x 50 cm, Lencería y Sujetadores",
      brand: "Lavanix",
      labsLanguageCode: "es",
    });
    expect(plan.seeds).toEqual([
      "bolsa lavado ropa",
      "bolsa lavado",
      "bolsas malla",
      "lencería sujetadores",
    ]);
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

  it("adds a seed per later segment, where the generic searches usually are", () => {
    const plan = planTitleKeywords({
      title: "Nutrix RADIANTE Piel con Acné y Rosácea | Probióticos Astaxantina Zinc",
      brand: "Nutrix",
      labsLanguageCode: "es",
    });
    expect(plan.seeds).toContain("probióticos astaxantina");
    expect(plan.seeds[0]).toBe("radiante piel acné");
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
    expect(merged.every((c) => c.amazonVolume === null)).toBe(true);
  });

  it("orders by Amazon volume, then Google volume", () => {
    const ordered = withAmazonVolumes(
      [
        { keyword: "a", amazonVolume: null, googleVolume: 5000, source: "google" },
        { keyword: "b", amazonVolume: null, googleVolume: 10, source: "google" },
        { keyword: "c", amazonVolume: null, googleVolume: null, source: "title" },
      ],
      new Map([
        ["b", 900],
        ["c", 1200],
      ]),
    );
    expect(ordered.map((c) => c.keyword)).toEqual(["c", "b", "a"]);
    expect(ordered[0]!.amazonVolume).toBe(1200);
  });

  it("pre-selects what is searched on Amazon when volumes are known", () => {
    const selection = defaultSelection([
      { keyword: "a", amazonVolume: 800, googleVolume: 10, source: "google" },
      { keyword: "b", amazonVolume: 0, googleVolume: 5000, source: "google" },
      { keyword: "c", amazonVolume: 50, googleVolume: null, source: "title" },
    ]);
    expect(selection).toEqual(["a", "c"]);
  });

  it("falls back to Google volume and title phrases without Amazon volume", () => {
    const selection = defaultSelection([
      { keyword: "a", amazonVolume: null, googleVolume: 10, source: "google" },
      { keyword: "b", amazonVolume: null, googleVolume: 0, source: "google" },
      { keyword: "c", amazonVolume: null, googleVolume: null, source: "title" },
    ]);
    expect(selection).toEqual(["a", "c"]);
  });
});

describe("Amazon volume coverage", () => {
  it("adds single title terms, where Amazon volume data usually exists", () => {
    const plan = planTitleKeywords({
      title: "Nutrix RADIANTE Piel con Acné y Rosácea | Probióticos Astaxantina Zinc",
      brand: "Nutrix",
      labsLanguageCode: "es",
    });
    expect(plan.titlePhrases).toContain("probióticos");
    expect(plan.titlePhrases).toContain("astaxantina");
    expect(plan.titlePhrases).toContain("zinc");
    expect(plan.headWords).toEqual(["radiante", "piel", "acne", "rosacea"]);
  });

  it("looks up each keyword with and without accents", () => {
    expect(stripAccents("probióticos rosácea")).toBe("probioticos rosacea");
    expect(volumeLookupKeywords(["colágeno", "zinc"])).toEqual(["colágeno", "colageno", "zinc"]);
  });

  it("switches to the accent-free spelling when only that one has Amazon data", () => {
    const [first] = withAmazonVolumes(
      [{ keyword: "colágeno", amazonVolume: null, googleVolume: null, source: "title" }],
      new Map([
        ["colágeno", null],
        ["colageno", 3964],
      ]),
    );
    expect(first).toMatchObject({ keyword: "colageno", amazonVolume: 3964 });
  });

  it("drops unrelated Google suggestions without Amazon searches", () => {
    const kept = withAmazonVolumes(
      [
        { keyword: "limonada con menta y jengibre", amazonVolume: null, googleVolume: 50, source: "google" },
        { keyword: "pastillas gases", amazonVolume: null, googleVolume: 260, source: "google" },
        { keyword: "jengibre en polvo", amazonVolume: 900, googleVolume: 10, source: "google" },
        { keyword: "menta jengibre", amazonVolume: null, googleVolume: null, source: "title" },
      ],
      new Map(),
      ["deshinchada", "hinchazon", "gases", "digestion"],
    );
    expect(kept.map((c) => c.keyword)).toEqual([
      "jengibre en polvo",
      "pastillas gases",
      "menta jengibre",
    ]);
  });
});

