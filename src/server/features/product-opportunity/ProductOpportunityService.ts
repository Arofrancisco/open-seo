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
import {
  AMAZON_MARKETPLACE_CODES,
  DEFAULT_AMAZON_MARKETPLACE_CODE,
  getAmazonMarketplace,
  type AmazonMarketplace,
} from "@/shared/amazon-marketplaces";
import {
  ProductOpportunityRepository,
  type AnalysisRow,
  type ProductRow,
} from "@/server/features/product-opportunity/ProductOpportunityRepository";
import {
  claudeCostUsd,
  cleanMarketProducts,
  markOffNiche,
  nicheAnalysisSchema,
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
const PRODUCTS_FOR_MODEL = 60;

const SYSTEM_PROMPT = `Eres un analista de producto de Amazon que asesora a marcas pequeñas y medianas de Europa sobre qué lanzar.

Recibes los productos que Amazon muestra para una búsqueda en un mercado concreto: título, precio, reseñas y las ventas del último mes según la etiqueta pública de Amazon ("X comprados el mes pasado"). Decide si el nicho está abierto, competido o cerrado para una marca nueva.

Primero, separa lo que no es del nicho. Amazon mezcla en los resultados productos que no responden a la búsqueda (otra categoría, otro uso, un ingrediente suelto que no es el producto buscado, accesorios). Devuelve sus ASIN en "offNicheAsins" y no los uses al razonar. La página calculará las cifras totales (ventas, precio mediano, cuota del top 3) solo con los que quedan, así que no sumes ni cites totales del nicho: interpreta.

Cómo leer los datos:
- Las ventas son mínimos por tramos (Amazon muestra 50+, 100+...), no cifras exactas. Úsalas para comparar, no para planificar stock. Sin dato puede significar menos de 50 o que Amazon no lo muestra.
- "ventasSinConfirmar: true" significa que la cifra recibida era de 1 a 10: puede ser "N mil" mal leído o un número del título. No la trates como un dato; como mucho menciona que podría ser un producto con ventas altas sin confirmar.
- La señal más útil de que un nicho está abierto son los recién llegados: productos con pocas reseñas que ya venden bien. Si los líderes tienen miles de reseñas y nadie nuevo vende, está cerrado.
- Un precio mediano bajo con muchos productos casi idénticos indica guerra de precios.

Riesgos que debes considerar cuando apliquen: normativa de complementos alimenticios y cosmética en la UE (declaraciones de salud no autorizadas), estacionalidad, peso de las marcas de farmacia o del propio Amazon como vendedor.

Usa solo lo que está en la entrada. No deduzcas quién es dueño de una marca, quién la fabrica, si es de Amazon, de dónde es o cuánto lleva a la venta: nada de eso viene en los datos. Si algo no se puede saber con los datos, dilo en vez de suponerlo.

Escribe en español claro, para alguien que no es analista. Sé concreto: cita productos, ventas y precios de la entrada. "nextSteps" son acciones que la marca puede hacer esta semana.`;

function modelInput(
  keyword: string,
  marketplace: AmazonMarketplace,
  products: MarketProduct[],
  context: string | undefined,
): string {
  const ranked = products
    .filter((product) => product.monthlySales !== null || product.salesUnconfirmed)
    .slice(0, PRODUCTS_FOR_MODEL)
    .map((product) => ({
      asin: product.asin,
      titulo: product.title,
      precio: product.price,
      ventasMes: product.monthlySales,
      ventasSinConfirmar: product.salesUnconfirmed,
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
    productos: ranked,
  });
}

async function askClaude(input: string): Promise<{
  verdict: NicheVerdict;
  offNicheAsins: string[];
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
      format: betaZodOutputFormat(nicheAnalysisSchema),
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
  const { offNicheAsins, ...verdict } = response.parsed_output;
  return { verdict, offNicheAsins, costUsd };
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
  id: string;
  createdAt: string;
  keyword: string;
  marketplace: AmazonMarketplace["code"];
  context: string | null;
  summary: MarketSummary;
  products: MarketProduct[];
  verdict: NicheVerdict;
};

export type SavedAnalysis = {
  id: string;
  createdAt: string;
  keyword: string;
  marketplace: string;
  verdict: NicheVerdict["verdict"];
  headline: string;
};

const lines = (values: string[]) => values.join("\n");
const fromLines = (value: string) => value.split("\n").filter(Boolean);

function toVerdict(row: AnalysisRow): NicheVerdict {
  const parsed = nicheVerdictSchema.shape.verdict.safeParse(row.verdict);
  return {
    verdict: parsed.success ? parsed.data : "competido",
    headline: row.headline,
    demand: row.demand,
    competition: row.competition,
    pricing: row.pricing,
    newcomers: row.newcomers,
    risks: fromLines(row.risks),
    nextSteps: fromLines(row.nextSteps),
  };
}

function toMarketProduct(row: ProductRow): MarketProduct {
  return {
    asin: row.asin,
    title: row.title,
    price: row.price,
    currency: row.currency,
    rating: row.rating,
    votes: row.votes,
    isAmazonChoice: row.isAmazonChoice,
    isBestSeller: row.isBestSeller,
    monthlySales: row.monthlySales,
    salesUnconfirmed: row.salesUnconfirmed,
    offNiche: row.offNiche,
    organicPosition: row.organicPosition,
    advertised: row.advertised,
  };
}

function toResult(
  analysis: AnalysisRow,
  products: MarketProduct[],
): ProductOpportunityResult {
  return {
    id: analysis.id,
    createdAt: analysis.createdAt,
    keyword: analysis.keyword,
    marketplace: getAmazonMarketplace(
      AMAZON_MARKETPLACE_CODES.find((code) => code === analysis.marketplace) ??
        DEFAULT_AMAZON_MARKETPLACE_CODE,
    ).code,
    context: analysis.context,
    summary: summarizeMarket(products),
    products,
    verdict: toVerdict(analysis),
  };
}

export async function listSavedAnalyses(
  projectId: string,
): Promise<SavedAnalysis[]> {
  const rows = await ProductOpportunityRepository.listAnalyses(projectId);
  return rows.map((row) => ({
    id: row.id,
    createdAt: row.createdAt,
    keyword: row.keyword,
    marketplace: row.marketplace,
    verdict: toVerdict(row).verdict,
    headline: row.headline,
  }));
}

export async function getSavedAnalysis(
  projectId: string,
  analysisId: string,
): Promise<ProductOpportunityResult> {
  const found = await ProductOpportunityRepository.getAnalysis(
    projectId,
    analysisId,
  );
  if (!found) throw new AppError("NOT_FOUND", "Ese análisis ya no existe.");
  return toResult(found.analysis, found.products.map(toMarketProduct));
}

export async function deleteSavedAnalysis(projectId: string, analysisId: string) {
  await ProductOpportunityRepository.deleteAnalysis(projectId, analysisId);
}

export async function analyzeProductOpportunity(input: {
  customer: BillingCustomerContext;
  projectId: string;
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
  const cleaned = cleanMarketProducts(items);
  if (cleaned.length === 0) {
    throw new AppError(
      "VALIDATION_ERROR",
      "Amazon no muestra productos para esa búsqueda en este mercado.",
    );
  }

  const { verdict, offNicheAsins } = await meterClaude(input.customer, () =>
    askClaude(modelInput(input.keyword, input.marketplace, cleaned, input.context)),
  );
  const products = markOffNiche(cleaned, offNicheAsins);

  // Saved before returning: the customer has paid for this result, so it must
  // survive a page change or a second analysis.
  const analysis: AnalysisRow = {
    id: crypto.randomUUID(),
    projectId: input.projectId,
    keyword: input.keyword,
    marketplace: input.marketplace.code,
    context: input.context ?? null,
    verdict: verdict.verdict,
    headline: verdict.headline,
    demand: verdict.demand,
    competition: verdict.competition,
    pricing: verdict.pricing,
    newcomers: verdict.newcomers,
    risks: lines(verdict.risks),
    nextSteps: lines(verdict.nextSteps),
    createdAt: new Date().toISOString(),
  };
  await ProductOpportunityRepository.insertAnalysis(
    analysis,
    products.map((product, index) => ({
      ...product,
      id: crypto.randomUUID(),
      analysisId: analysis.id,
      position: index + 1,
    })),
  );

  return toResult(analysis, products);
}
