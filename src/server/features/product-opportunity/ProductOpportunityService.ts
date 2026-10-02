import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import {
  assertUsageCreditsAvailable,
  getOrCreateOrganizationCustomer,
  trackUsageCreditSpend,
  type BillingCustomerContext,
} from "@/server/billing/subscription";
import { createDataforseoClient } from "@/server/lib/dataforseo";
import { AppError } from "@/server/lib/errors";
import {
  getOptionalEnvValue,
  getRequiredEnvValue,
  isHostedServerAuthMode,
} from "@/server/lib/runtime-env";
import type { AmazonMarketplace } from "@/shared/amazon-marketplaces";
import {
  claudeCostUsd,
  cleanMarketProducts,
  nicheVerdictSchema,
  summarizeMarket,
  type MarketProduct,
  type MarketSummary,
  type NicheVerdict,
} from "@/shared/product-opportunity";

// Sonnet balances judgment and cost for a ~3k-token market summary; override
// with ANTHROPIC_MODEL without a code change.
const DEFAULT_MODEL = "claude-sonnet-5-5";

// Only what the model needs to judge the niche; the full list stays on the page.
const PRODUCTS_FOR_MODEL = 40;

const SYSTEM_PROMPT = `Eres un analista de producto de Amazon que asesora a marcas pequeñas y medianas de Europa sobre qué lanzar.

Recibes los productos que Amazon muestra para una búsqueda en un mercado concreto, con las ventas del último mes según la etiqueta pública de Amazon ("X comprados el mes pasado"), precio y reseñas, más un resumen calculado. Decide si el nicho está abierto, competido o cerrado para una marca nueva.

Cómo leer los datos:
- Las ventas son mínimos por tramos (Amazon muestra 50+, 100+, 1 mil+...), no cifras exactas. Úsalas para comparar, no para planificar stock. Un producto sin dato puede vender menos de 50 o simplemente no mostrarlo.
- La señal más útil de que un nicho está abierto son los "recién llegados": productos con pocas reseñas que ya venden bien. Si los líderes tienen miles de reseñas y nadie nuevo vende, el nicho está cerrado.
- Un precio mediano bajo con muchos productos casi idénticos indica guerra de precios.
- Ignora productos que no encajen con la búsqueda (libros, accesorios ajenos) al razonar.

Riesgos que debes considerar cuando apliquen: normativa de complementos alimenticios y cosmética en la UE (declaraciones de salud no autorizadas), estacionalidad, dependencia de marcas de farmacia o del propio Amazon como vendedor.

Escribe en español claro, para alguien que no es analista. Sé concreto: cita productos, cifras y precios del resumen. No inventes datos que no estén en la entrada. "nextSteps" son acciones que la marca puede hacer esta semana.`;

function modelInput(
  keyword: string,
  marketplace: AmazonMarketplace,
  summary: MarketSummary,
  products: MarketProduct[],
  context: string | undefined,
): string {
  const ranked = products
    .filter((product) => product.monthlySales !== null)
    .slice(0, PRODUCTS_FOR_MODEL)
    .map((product) => ({
      titulo: product.title,
      precio: product.price,
      ventasMes: product.monthlySales,
      reseñas: product.votes,
      valoracion: product.rating,
      posicionOrganica: product.organicPosition,
      anunciado: product.advertised,
      amazonsChoice: product.isAmazonChoice,
    }));
  return JSON.stringify({
    busqueda: keyword,
    mercado: marketplace.label,
    contextoDeLaMarca: context ?? null,
    resumen: {
      productos: summary.products,
      conDatoDeVentas: summary.withSalesData,
      ventasMesMinimas: summary.monthlySalesFloor,
      precio: summary.price,
      reseñasMedianas: summary.medianVotes,
      cuotaTop3: summary.top3Share,
      reciénLlegados: summary.newcomers.map((p) => ({
        titulo: p.title,
        ventasMes: p.monthlySales,
        reseñas: p.votes,
        precio: p.price,
      })),
    },
    productosConVentas: ranked,
  });
}

async function askClaude(input: string): Promise<{
  verdict: NicheVerdict;
  costUsd: number;
}> {
  const client = new Anthropic({
    apiKey: await getRequiredEnvValue("ANTHROPIC_API_KEY"),
  });
  const model = (await getOptionalEnvValue("ANTHROPIC_MODEL")) ?? DEFAULT_MODEL;

  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: input }],
    output_config: {
      effort: "medium",
      format: betaZodOutputFormat(nicheVerdictSchema),
    },
    // On a policy decline the API reruns the request on a fallback model it
    // picks by refusal category, inside the same call.
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
  });

  const costUsd = claudeCostUsd(response.model, response.usage);
  if (response.stop_reason === "refusal" || !response.parsed_output) {
    throw new AppError(
      "INTERNAL_ERROR",
      `El análisis no se pudo completar (${response.stop_reason ?? "sin respuesta"}).`,
    );
  }
  return { verdict: response.parsed_output, costUsd };
}

/**
 * Charges the model's real cost to the organization's usage credits, the same
 * pool and markup as DataForSEO spend. Self-hosted installs run unmetered.
 */
async function meterClaude<T>(
  customer: BillingCustomerContext,
  execute: () => Promise<T & { costUsd: number }>,
): Promise<T> {
  if (!(await isHostedServerAuthMode())) return execute();

  const billingCustomer = await getOrCreateOrganizationCustomer(customer);
  const { monthlyRemaining } = await assertUsageCreditsAvailable(
    billingCustomer.id,
  );
  const result = await execute();
  await trackUsageCreditSpend({
    customer,
    customerId: billingCustomer.id,
    creditFeature: "amazon",
    costUsd: result.costUsd,
    monthlyRemaining,
    properties: { provider: "anthropic", feature: "product_opportunity" },
  });
  return result;
}

export type ProductOpportunityResult = {
  keyword: string;
  marketplace: AmazonMarketplace["code"];
  summary: MarketSummary;
  products: MarketProduct[];
  verdict: NicheVerdict;
};

export async function analyzeProductOpportunity(input: {
  customer: BillingCustomerContext;
  keyword: string;
  marketplace: AmazonMarketplace;
  context?: string;
}): Promise<ProductOpportunityResult> {
  const items = await createDataforseoClient(input.customer).merchant.productsLive(
    {
      keyword: input.keyword,
      locationCode: input.marketplace.locationCode,
      languageCode: input.marketplace.languageCode,
      seDomain: input.marketplace.seDomain,
    },
  );
  const products = cleanMarketProducts(items);
  if (products.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Amazon no muestra productos para esa búsqueda en este mercado.",
    );
  }
  const summary = summarizeMarket(products);

  const { verdict } = await meterClaude(input.customer, () =>
    askClaude(
      modelInput(input.keyword, input.marketplace, summary, products, input.context),
    ),
  );

  return {
    keyword: input.keyword,
    marketplace: input.marketplace.code,
    summary,
    products,
    verdict,
  };
}
