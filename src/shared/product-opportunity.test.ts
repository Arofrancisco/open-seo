import { describe, expect, it } from "vitest";
import {
  cleanMarketProducts,
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
  it("reads a small round figure on a reviewed listing as thousands", () => {
    // Amazon shows "3 mil+ comprados" and DataForSEO returns 3.
    expect(normalizeBoughtPastMonth(3, 1200)).toBe(3000);
    expect(normalizeBoughtPastMonth(600, 694)).toBe(600);
  });

  it("leaves numbers lifted from the title unknown", () => {
    // "18 MLD probióticos" in the title, no sales badge on the listing.
    expect(normalizeBoughtPastMonth(18, 151)).toBeNull();
    expect(normalizeBoughtPastMonth(2, 1)).toBeNull();
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
  it("sizes the niche and flags low-review listings that already sell", () => {
    const summary = summarizeMarket(
      cleanMarketProducts([
        item({ asin: "LEADER", boughtPastMonth: 3, votes: 1200 }),
        item({ asin: "NEW", boughtPastMonth: 900, votes: 20 }),
        item({ asin: "SMALL", boughtPastMonth: 50, votes: 40 }),
        item({ asin: "UNKNOWN", boughtPastMonth: null }),
      ]),
    );
    expect(summary).toMatchObject({
      products: 4,
      withSalesData: 3,
      monthlySalesFloor: 3950,
    });
    expect(summary.newcomers.map((p) => p.asin)).toEqual(["NEW"]);
    expect(summary.top3Share).toBe(1);
  });
});
