import { describe, expect, it } from "vitest";
import { isEmailSignupAllowed } from "./email-signup-access";

describe("isEmailSignupAllowed", () => {
  it("accepts the configured code, ignoring surrounding spaces", () => {
    expect(isEmailSignupAllowed("abc123", "abc123")).toBe(true);
    expect(isEmailSignupAllowed("  abc123 ", "abc123")).toBe(true);
  });

  it("rejects a wrong, partial or longer code", () => {
    expect(isEmailSignupAllowed("abc124", "abc123")).toBe(false);
    expect(isEmailSignupAllowed("abc12", "abc123")).toBe(false);
    expect(isEmailSignupAllowed("abc1234", "abc123")).toBe(false);
  });

  it("rejects a missing code", () => {
    expect(isEmailSignupAllowed(undefined, "abc123")).toBe(false);
    expect(isEmailSignupAllowed(null, "abc123")).toBe(false);
    expect(isEmailSignupAllowed("", "abc123")).toBe(false);
  });

  it("fails closed when no code is configured", () => {
    expect(isEmailSignupAllowed("anything", undefined)).toBe(false);
    expect(isEmailSignupAllowed("", "")).toBe(false);
    expect(isEmailSignupAllowed("   ", "   ")).toBe(false);
  });
});
