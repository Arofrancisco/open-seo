import { describe, expect, it } from "vitest";
import { claudeCostUsd } from "@/shared/product-opportunity";

describe("claudeCostUsd", () => {
  it("bills an unknown model at the highest rate so a swap never undercharges", () => {
    const usage = { input_tokens: 3000, output_tokens: 1500 };
    expect(claudeCostUsd("claude-sonnet-5-5", usage)).toBeCloseTo(0.021);
    expect(claudeCostUsd("some-new-model", usage)).toBeCloseTo(0.042);
  });
});
