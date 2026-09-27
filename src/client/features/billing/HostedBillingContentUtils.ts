// Top-ups are billed in packs of 1,000 credits at 2 € each, so only even
// amounts map to whole packs. An odd amount would be rounded up by Stripe.
export const TOP_UP_MIN_EUR = 10;
export const TOP_UP_MAX_EUR = 98;
export const TOP_UP_STEP_EUR = 2;

export function parseTopUpAmount(value: string) {
  const trimmed = value.trim();

  if (!/^\d+$/.test(trimmed)) {
    return {
      isValid: false,
      parsed: 20,
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
    parsed: isValid ? parsed : 20,
  };
}
