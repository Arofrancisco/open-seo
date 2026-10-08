import { describe, expect, it } from "vitest";
import { parseTopUpAmount } from "./HostedBillingContentUtils";

describe("parseTopUpAmount", () => {
  it("accepts multiples of the pack price within range", () => {
    expect(parseTopUpAmount("18")).toEqual({ isValid: true, parsed: 18 });
    expect(parseTopUpAmount("9")).toEqual({ isValid: true, parsed: 9 });
    expect(parseTopUpAmount("99")).toEqual({ isValid: true, parsed: 99 });
  });

  it("rejects amounts that are not whole packs", () => {
    expect(parseTopUpAmount("10")).toEqual({ isValid: false, parsed: 18 });
    expect(parseTopUpAmount("20")).toEqual({ isValid: false, parsed: 18 });
  });

  it("rejects amounts below minimum", () => {
    expect(parseTopUpAmount("6")).toEqual({ isValid: false, parsed: 18 });
  });

  it("rejects amounts above maximum", () => {
    expect(parseTopUpAmount("102")).toEqual({ isValid: false, parsed: 18 });
  });

  it("rejects non-numeric input", () => {
    expect(parseTopUpAmount("abc")).toEqual({ isValid: false, parsed: 18 });
  });
});
