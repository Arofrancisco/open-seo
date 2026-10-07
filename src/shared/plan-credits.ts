// Credits each plan includes. The real values live in Autumn (the billing
// provider); these copies only feed user-facing explanations, so keep them in
// sync when the plans change.
// Free plan: one-off grant on signup, not monthly.
export const FREE_PLAN_CREDITS = 150;
export const PAID_PLAN_MONTHLY_CREDITS = 6000;

/** "1090" -> "1.090": Spanish grouping, which toLocaleString skips under 10,000. */
export function formatCredits(credits: number): string {
  return String(credits).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}
