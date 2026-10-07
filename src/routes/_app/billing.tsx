import { createFileRoute, notFound } from "@tanstack/react-router";
import { useCustomer } from "autumn-js/react";
import { useState } from "react";
import { useSession } from "@/lib/auth-client";
import { isHostedClientAuthMode } from "@/lib/auth-mode";
import { useCanManageBilling } from "@/client/features/team/organizationQueries";
import { captureClientEvent } from "@/client/lib/posthog";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { buildCheckoutSuccessUrl } from "@/client/features/billing/checkout-url";
import { BillingUsageChart } from "@/client/features/billing/BillingUsageChart";
import { BillingFeatureBreakdown } from "@/client/features/billing/BillingFeatureBreakdown";
import {
  parseTopUpAmount,
  TOP_UP_MAX_EUR,
  TOP_UP_MIN_EUR,
  TOP_UP_STEP_EUR,
} from "@/client/features/billing/HostedBillingContentUtils";
import { getBillingRouteState } from "@/client/features/billing/route-state";
import { formatCredits, PAID_PLAN_MONTHLY_CREDITS } from "@/shared/plan-credits";
import { getCustomerPlanStatus } from "@/client/features/billing/plan-detection";
import {
  AUTUMN_CHECKOUT_SESSION_PARAMS,
  AUTUMN_PAID_PLAN_ID,
  BILLING_ROUTE,
  AUTUMN_SEO_DATA_BALANCE_FEATURE_ID,
  LOW_CREDITS_THRESHOLD_USD,
  AUTUMN_SEO_DATA_CREDITS_PER_USD,
  TOPUP_CREDITS_PER_EUR,
  AUTUMN_SEO_DATA_TOP_UP_PLAN_ID,
  AUTUMN_SEO_DATA_TOPUP_BALANCE_FEATURE_ID,
  autumnSeoDataCreditsToUsd,
} from "@/shared/billing";

export const Route = createFileRoute("/_app/billing")({
  beforeLoad: () => {
    if (!isHostedClientAuthMode()) {
      throw notFound();
    }
  },
  component: BillingPage,
});

function BillingPage() {
  const { data: session, isPending: isSessionPending } = useSession();
  const [topUpAmount, setTopUpAmount] = useState("20");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const customerQuery = useCustomer({
    queryOptions: {
      enabled: Boolean(session?.user?.id),
    },
  });

  // Subscription changes are owner-only; other members see balances but are
  // pointed at the owner instead of checkout (the server enforces this too).
  const canManageBilling = useCanManageBilling();

  const planStatus = getCustomerPlanStatus(customerQuery.data);
  const isFreePlan = planStatus === "free";
  const billingRouteState = getBillingRouteState({
    hasSession: Boolean(session?.user?.id),
    isSessionPending,
    isCustomerLoading: customerQuery.isLoading,
    isCustomerError: customerQuery.isError,
  });

  const monthlyRemaining = autumnSeoDataCreditsToUsd(
    customerQuery.data?.balances?.[AUTUMN_SEO_DATA_BALANCE_FEATURE_ID]
      ?.remaining ?? 0,
  );
  const topUpRemaining = autumnSeoDataCreditsToUsd(
    customerQuery.data?.balances?.[AUTUMN_SEO_DATA_TOPUP_BALANCE_FEATURE_ID]
      ?.remaining ?? 0,
  );
  const totalRemaining = monthlyRemaining + topUpRemaining;
  const formatCredits = (usd: number) =>
    Math.round(usd * AUTUMN_SEO_DATA_CREDITS_PER_USD).toLocaleString("es-ES");

  const { isValid: isValidTopUp, parsed: parsedTopUpAmount } =
    parseTopUpAmount(topUpAmount);

  if (billingRouteState === "loading") {
    return null;
  }

  if (billingRouteState === "error") {
    return (
      <div className="mx-auto w-full max-w-2xl space-y-4 p-4 py-10 md:p-6 md:py-12">
        <h1 className="text-xl font-semibold">Facturación no disponible</h1>
        <p className="text-sm text-base-content/70">
          {getStandardErrorMessage(
            customerQuery.error,
            "No hemos podido cargar tus datos de facturación. Inténtalo de nuevo.",
          )}
        </p>
        <button
          type="button"
          className="btn btn-soft btn-sm"
          onClick={() => {
            void customerQuery.refetch();
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  function startUpgradeCheckout() {
    captureClientEvent("billing:checkout_start");
    return customerQuery.attach({
      planId: AUTUMN_PAID_PLAN_ID,
      redirectMode: "always",
      successUrl: buildCheckoutSuccessUrl(BILLING_ROUTE),
      checkoutSessionParams: AUTUMN_CHECKOUT_SESSION_PARAMS,
    });
  }

  async function runAction(
    callback: () => Promise<unknown>,
    fallbackMessage: string,
  ) {
    setError(null);
    setIsPending(true);
    try {
      await callback();
      await customerQuery.refetch();
    } catch (err) {
      setError(getStandardErrorMessage(err, fallbackMessage));
    } finally {
      setIsPending(false);
    }
  }

  if (isPending) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-base-content/50">Redirigiendo a Stripe...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 p-4 py-10 md:p-6 md:py-12">
      <h1 className="text-xl font-semibold">Facturación</h1>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Subscription card */}
        <div className="flex flex-col justify-between rounded-lg border border-base-300 bg-base-100 p-4 gap-4">
          <div>
            <div className="text-2xl font-semibold tabular-nums">
              {formatCredits(totalRemaining)}{" "}
              <span className="text-sm font-normal text-base-content/50">
                créditos restantes
              </span>
            </div>
            {!isFreePlan ? (
              <div className="mt-1 flex gap-3 text-xs text-base-content/50">
                <span className="tabular-nums">
                  Mensuales {formatCredits(monthlyRemaining)}
                </span>
                <span>&middot;</span>
                <span className="tabular-nums">
                  Recargas {formatCredits(topUpRemaining)}
                </span>
              </div>
            ) : null}
            {totalRemaining <= 0 ? (
              <p className="mt-2 text-xs text-error">
                Has agotado tus créditos.{" "}
                {isFreePlan
                  ? "Mejora tu plan para continuar."
                  : "Compra más créditos abajo para continuar."}
              </p>
            ) : totalRemaining < LOW_CREDITS_THRESHOLD_USD ? (
              <p className="mt-2 text-xs text-amber-600">
                Te quedan pocos créditos.{" "}
                {isFreePlan
                  ? `Mejora tu plan y recibe ${formatCredits(PAID_PLAN_MONTHLY_CREDITS)} al mes.`
                  : "Compra más créditos abajo."}
              </p>
            ) : null}
          </div>

          <div className="text-sm">
            <span className="font-medium">Plan</span>{" "}
            <span className="text-base-content/50">
              {isFreePlan ? "Plan gratuito" : "Plan Base"}
            </span>
          </div>

          {!canManageBilling ? (
            <p className="border-t border-base-300 pt-3 text-sm text-base-content/60">
              Solo el propietario de la organización puede cambiar el plan o
              comprar créditos. Pídeselo si necesitas más.
            </p>
          ) : isFreePlan ? (
            <div className="space-y-3 border-t border-base-300 pt-3">
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-medium">Plan Base</span>
                {/* Precio fijado a mano — actualizar aquí si cambia el precio en Autumn (base-plan). */}
                <span className="text-sm font-medium tabular-nums">
                  39,99 €/mes
                </span>
              </div>
              <ul className="space-y-1.5">
                {[
                  "Acceso a todas las funciones",
                  `Incluye ${formatCredits(PAID_PLAN_MONTHLY_CREDITS)} créditos de uso cada mes`,
                ].map((item) => (
                  <li
                    key={item}
                    className="flex gap-2 text-xs text-base-content/60"
                  >
                    <span className="text-base-content/30 mt-[1px] shrink-0">
                      &mdash;
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <button
                className="btn btn-soft btn-sm w-full"
                disabled={isPending}
                onClick={() =>
                  void runAction(
                    startUpgradeCheckout,
                    "No hemos podido iniciar el pago. Inténtalo de nuevo.",
                  )
                }
              >
                Mejorar plan
              </button>
            </div>
          ) : (
            <button
              className="btn btn-soft btn-sm w-full"
              disabled={isPending}
              onClick={() =>
                void runAction(
                  () =>
                    customerQuery.openCustomerPortal({
                      returnUrl: window.location.href,
                    }),
                  "No hemos podido abrir el portal de facturación. Inténtalo de nuevo.",
                )
              }
            >
              Gestionar suscripción
            </button>
          )}
        </div>

        {/* Buy credits card — paid plan only, owner-only */}
        {!isFreePlan && canManageBilling ? (
          <div className="rounded-lg border border-base-300 bg-base-100 p-4 space-y-3">
            <div>
              <span className="font-semibold">Comprar créditos</span>
              <p className="mt-1 text-sm text-base-content/60">
                2 € por cada 1.000 créditos. Mínimo {TOP_UP_MIN_EUR} € (
                {(TOP_UP_MIN_EUR * TOPUP_CREDITS_PER_EUR).toLocaleString("es-ES")}{" "}
                créditos). Los créditos de recarga no caducan y se usan después
                de los mensuales.
              </p>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-base-content/60">€</span>
                <input
                  type="number"
                  min={TOP_UP_MIN_EUR}
                  max={TOP_UP_MAX_EUR}
                  step={TOP_UP_STEP_EUR}
                  inputMode="numeric"
                  className="input input-bordered input-sm w-full"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                />
              </div>
              {topUpAmount.trim() !== "" && !isValidTopUp ? (
                <p className="mt-1 text-xs text-error">
                  Introduce un importe par entre {TOP_UP_MIN_EUR} y{" "}
                  {TOP_UP_MAX_EUR} € (paquetes de 1.000 créditos a 2 €).
                </p>
              ) : isValidTopUp ? (
                <p className="mt-1 text-xs text-base-content/60">
                  Recibirás{" "}
                  {(parsedTopUpAmount * TOPUP_CREDITS_PER_EUR).toLocaleString(
                    "es-ES",
                  )}{" "}
                  créditos. En el pago verás {parsedTopUpAmount / TOP_UP_STEP_EUR}{" "}
                  paquetes de 1.000 créditos.
                </p>
              ) : null}
            </div>

            <button
              className="btn btn-soft btn-sm w-full"
              disabled={isPending || !isValidTopUp}
              onClick={() =>
                void runAction(
                  () =>
                    customerQuery.attach({
                      planId: AUTUMN_SEO_DATA_TOP_UP_PLAN_ID,
                      redirectMode: "always",
                      successUrl: window.location.href,
                      checkoutSessionParams: AUTUMN_CHECKOUT_SESSION_PARAMS,
                      featureQuantities: [
                        {
                          featureId: AUTUMN_SEO_DATA_TOPUP_BALANCE_FEATURE_ID,
                          quantity: Math.round(
                            parsedTopUpAmount * TOPUP_CREDITS_PER_EUR,
                          ),
                        },
                      ],
                    }),
                  "No hemos podido iniciar el pago. Inténtalo de nuevo.",
                )
              }
            >
              Comprar créditos
            </button>
          </div>
        ) : null}
      </div>

      {/* Usage chart */}
      <BillingUsageChart />

      {/* Per-feature usage breakdown */}
      <BillingFeatureBreakdown />

      {error ? <p className="text-sm text-error">{error}</p> : null}

      <p className="text-xs text-base-content/40">
        Pago seguro gestionado por Stripe.
      </p>
    </div>
  );
}
