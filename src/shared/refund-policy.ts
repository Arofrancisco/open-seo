// Refund guarantee and withdrawal-waiver wording. One source for the subscribe
// page, the Stripe checkout message and the assistant fact sheet — keep them
// aligned with the "Condiciones de contratación" page.
//
// Policy: 14 days from the FIRST charge of a subscription. Full refund if the
// customer used up to 20 % of the plan's credits; beyond that, a refund
// proportional to the credits not used. Renewals and top-ups are not covered
// by the guarantee (top-up credits can be refunded in full only while none of
// them has been spent, within 14 days).
export const CONDITIONS_URL = "https://planetaprime.com/planetaseo-condiciones/";
export const GUARANTEE_DAYS = 14;
export const GUARANTEE_FULL_REFUND_MAX_USAGE_PERCENT = 20;

export const GUARANTEE_TITLE = `Garantía de devolución de ${GUARANTEE_DAYS} días`;

export function buildGuaranteeTooltip(supportEmail: string): string {
  return `¿No es para ti? Escribe a ${supportEmail} en los ${GUARANTEE_DAYS} días siguientes al primer cobro. Reembolso íntegro si has usado hasta el ${GUARANTEE_FULL_REFUND_MAX_USAGE_PERCENT} % de los créditos del plan; si has usado más, te devolvemos la parte proporcional no usada.`;
}

// Explicit prior consent to start the service immediately (TRLGDCU art. 103
// a/m). Shown as a required checkbox on /subscribe.
export const SUBSCRIBE_WAIVER_LABEL =
  "Quiero empezar a usar el servicio ahora y entiendo que, una vez usado (por ejemplo, al gastar créditos), pierdo el derecho de desistimiento. La garantía de devolución de arriba sigue vigente.";

// Shown by Stripe right under the pay button, on every checkout (subscription,
// upgrade and top-up).
export const CHECKOUT_CONSENT_MESSAGE =
  `Precio final con IVA incluido. Al pagar, solicitas acceso inmediato al servicio y reconoces que, una vez prestado o consumido (por ejemplo, créditos gastados), pierdes el derecho de desistimiento. ` +
  `Garantía de ${GUARANTEE_DAYS} días en el primer cobro de la suscripción: reembolso íntegro si has usado hasta el ${GUARANTEE_FULL_REFUND_MAX_USAGE_PERCENT} % de los créditos del plan y proporcional si has usado más. ` +
  `Condiciones: ${CONDITIONS_URL}`;
