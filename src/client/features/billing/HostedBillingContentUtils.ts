import { TOPUP_PACK_PRICE_EUR } from "@/shared/billing";

// Top-ups are billed in packs of 1,000 credits at TOPUP_PACK_PRICE_EUR each, so
// only multiples of that price map to whole packs. Any other amount would be
// rounded up by Stripe.
export const TOP_UP_STEP_EUR = TOPUP_PACK_PRICE_EUR;
export const TOP_UP_MIN_EUR = 3 * TOP_UP_STEP_EUR;
export const TOP_UP_MAX_EUR = 33 * TOP_UP_STEP_EUR;
// Default suggestion: 6 packs = 6,000 credits, the size of the monthly plan.
export const TOP_UP_DEFAULT_EUR = 6 * TOP_UP_STEP_EUR;

export function parseTopUpAmount(value: string) {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return {
      isValid: false,
      parsed: TOP_UP_DEFAULT_EUR,
    };
  }

  const parsed = Number(trimmed);
  const isValid =
    Number.isInteger(parsed) &&
    parsed >= TOP_UP_MIN_EUR &&
    parsed <= TOP_UP_MAX_EUR &&
    parsed % TOP_UP_STEP_EUR === 0;

  return {
    isValid,
    parsed: isValid ? parsed : TOP_UP_DEFAULT_EUR,
  };
}
