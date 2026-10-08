import { CHECKOUT_CONSENT_MESSAGE } from "@/shared/refund-policy";
export const BILLING_ROUTE = "/billing";
export const SUBSCRIBE_ROUTE = "/subscribe";

export const AUTUMN_PAID_PLAN_ID = "base-plan";
export const AUTUMN_SEO_DATA_TOP_UP_PLAN_ID = "credit-top-up";
export const AUTUMN_PAID_PLAN_FEATURE_ID = "paid_plan";
// Granted by both the free plan (now the Autumn Default, so every non-paid
// user gets it) and the paid base plan. It's the floor for using the managed
// service at all — paid-only features gate on AUTUMN_PAID_PLAN_FEATURE_ID.
export const AUTUMN_MANAGED_ACCESS_FEATURE_ID = "managed_service_access";
// The shared usage-credit pool. Both DataForSEO and agent-LLM spend deduct
// from these (monthly usage_credits first, then rolled-over topup_credits).
export const AUTUMN_SEO_DATA_BALANCE_FEATURE_ID = "usage_credits";
export const AUTUMN_SEO_DATA_TOPUP_BALANCE_FEATURE_ID = "topup_credits";
export const AUTUMN_SEO_DATA_CREDITS_PER_USD = 1000;
// Top-ups are sold in packs. Must match the credit-top-up price in Autumn
// (TOPUP_PACK_PRICE_EUR per TOPUP_PACK_CREDITS topup credits).
export const TOPUP_PACK_CREDITS = 1000;
export const TOPUP_PACK_PRICE_EUR = 3;

/** Credits received for a top-up of `eur` euros (a whole number of packs). */
export function topUpCreditsForEur(eur: number): number {
  return Math.round((eur / TOPUP_PACK_PRICE_EUR) * TOPUP_PACK_CREDITS);
}
export const SEO_DATA_COST_MARKUP = 1.28;
export const LOW_CREDITS_THRESHOLD_USD = 0.25;

// Passed through to Stripe's checkout.sessions.create so checkout collects the
// legal business name, tax ID (EU VAT etc.), and full billing address — makes
// invoices valid for business customers. Display only, no Stripe Tax. Stripe
// requires customer_update.name "auto" to collect tax IDs for an existing customer.
export const AUTUMN_CHECKOUT_SESSION_PARAMS = {
  tax_id_collection: { enabled: true },
  billing_address_collection: "required",
  customer_update: { name: "auto", address: "auto" },
  // Withdrawal-waiver notice under the pay button (see refund-policy.ts).
  custom_text: { submit: { message: CHECKOUT_CONSENT_MESSAGE } },
} as const;

export function roundUsdForBilling(value: number) {
  return Math.round(value * 100000) / 100000;
}

export function autumnSeoDataCreditsToUsd(credits: number) {
  return credits / AUTUMN_SEO_DATA_CREDITS_PER_USD;
}

/**
 * Convert a raw DataForSEO USD cost into the USD amount a hosted customer is
 * actually billed, applying the platform markup. Use this when displaying
 * cost estimates so the number matches what the user will be charged.
 *
 * Self-hosted deployments pay DataForSEO directly at the raw rate and should
 * show the raw number — gate at the call site with `isHostedClientAuthMode`.
 */
export function applyBillingMarkupUsd(rawUsd: number): number {
  return roundUsdForBilling(rawUsd * SEO_DATA_COST_MARKUP);
}
