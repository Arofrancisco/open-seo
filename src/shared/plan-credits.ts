// Credits each plan includes per month. The real values live in Autumn (the
// billing provider); these copies only feed user-facing explanations, so keep
// them in sync when the plans change.
export const FREE_PLAN_CREDITS = 800;
export const PAID_PLAN_MONTHLY_CREDITS = 8000;

/** "1090" -> "1.090": Spanish grouping, which toLocaleString skips under 10,000. */
export function formatCredits(credits: number): string {
  return String(credits).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
