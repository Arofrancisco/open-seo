import { describe, expect, it } from "vitest";
import {
  cleanMarketProducts,
  markOffNiche,
  normalizeBoughtPastMonth,
  summarizeMarket,
  type MarketProductInput,
} from "@/shared/product-opportunity";

const item = (overrides: Partial<MarketProductInput>): MarketProductInput => ({
  asin: "B000000001",
  title: null,
  price: 20,
  currency: "EUR",
  rating: 4.5,
  votes: 300,
  boughtPastMonth: 100,
  sponsored: false,
  hasFormatLabels: false,
  isAmazonChoice: false,
  isBestSeller: false,
  ...overrides,
});

describe("normalizeBoughtPastMonth", () => {
  it("never turns a small figure into thousands, only flags it", () => {
    // "3 mil+" and a title's "Para 10 Meses" both arrive as single digits.
    expect(normalizeBoughtPastMonth(10)).toEqual({ monthlySales: null, salesUnconfirmed: true });
    expect(normalizeBoughtPastMonth(600)).toEqual({ monthlySales: 600, salesUnconfirmed: false });
    expect(normalizeBoughtPastMonth(18)).toEqual({ monthlySales: null, salesUnconfirmed: false });
  });
});

describe("cleanMarketProducts", () => {
  it("drops books and merges an ASIN seen as ad and organic result", () => {
    const products = cleanMarketProducts([
      item({ asin: "A", sponsored: true }),
      item({ asin: "BOOK", hasFormatLabels: true }),
      item({ asin: "A" }),
      item({ asin: "B" }),
    ]);
    expect(products.map((p) => p.asin)).toEqual(["A", "B"]);
    expect(products[0]).toMatchObject({ advertised: true, organicPosition: 1 });
    expect(products[1].organicPosition).toBe(2);
  });
});

describe("summarizeMarket", () => {
  it("leaves off-niche and unconfirmed products out of every figure", () => {
    const products = markOffNiche(
      cleanMarketProducts([
        item({ asin: "TURMERIC", boughtPastMonth: 6000 }),
        item({ asin: "MAYBE", boughtPastMonth: 3 }),
        item({ asin: "NEW", boughtPastMonth: 900, votes: 20 }),
        item({ asin: "SMALL", boughtPastMonth: 100, votes: 40 }),
      ]),
      ["turmeric"],
    );
    const summary = summarizeMarket(products);
    expect(summary).toMatchObject({ products: 3, withSalesData: 2, monthlySalesFloor: 1000 });
    expect(summary.newcomers.map((p) => p.asin)).toEqual(["NEW"]);
    expect(summary.unconfirmed.map((p) => p.asin)).toEqual(["MAYBE"]);
    expect(summary.offNiche.map((p) => p.asin)).toEqual(["TURMERIC"]);
  });
});
