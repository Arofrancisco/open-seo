import { useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, History, Info, Lightbulb, Trash2 } from "lucide-react";
import {
  analyzeNiche,
  deleteNicheAnalysis,
  getNicheAnalysis,
  listNicheAnalyses,
  type ProductOpportunityResult,
} from "@/serverFunctions/productOpportunity";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  AUTUMN_SEO_DATA_CREDITS_PER_USD,
  SEO_DATA_COST_MARKUP,
} from "@/shared/billing";
import {
  AMAZON_MARKETPLACES,
  DEFAULT_AMAZON_MARKETPLACE_CODE,
  getAmazonMarketplace,
  type AmazonMarketplaceCode,
} from "@/shared/amazon-marketplaces";
import type { MarketProduct, NicheVerdict } from "@/shared/product-opportunity";

type Props = { projectId: string };

// DataForSEO Amazon products (live) ~$0.0033 + one Sonnet analysis ~$0.025,
// measured on 02/10/2026. Used only for the estimate shown on the button.
const ANALYSIS_COST_USD = 0.03;
const ANALYSIS_CREDITS = Math.ceil(
  ANALYSIS_COST_USD * SEO_DATA_COST_MARKUP * AUTUMN_SEO_DATA_CREDITS_PER_USD,
);

const VERDICT_STYLE: Record<NicheVerdict["verdict"], { label: string; className: string }> = {
  abierto: { label: "Nicho abierto", className: "badge-success" },
  competido: { label: "Nicho competido", className: "badge-warning" },
  cerrado: { label: "Nicho cerrado", className: "badge-error" },
};

const formatNumber = (value: number | null) =>
  value === null ? "—" : value.toLocaleString("es-ES");
const formatPrice = (value: number | null) =>
  value === null ? "—" : `${value.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

function ProductRow({ product, domain }: { product: MarketProduct; domain: string }) {
  return (
    <tr>
      <td className="max-w-md">
        <a
          className="link link-hover line-clamp-2"
          href={`https://www.${domain}/dp/${product.asin}`}
          target="_blank"
          rel="noreferrer"
        >
          {product.title ?? product.asin}
        </a>
      </td>
      <td>{formatNumber(product.monthlySales)}</td>
      <td>{formatPrice(product.price)}</td>
      <td>{formatNumber(product.votes)}</td>
      <td>{product.rating ?? "—"}</td>
    </tr>
  );
}

export function ProductOpportunityPage({ projectId }: Props) {
  const [keyword, setKeyword] = useState("");
  const [marketplace, setMarketplace] = useState<AmazonMarketplaceCode>(
    DEFAULT_AMAZON_MARKETPLACE_CODE,
  );
  const [context, setContext] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const historyKey = ["nicheAnalyses", projectId];
  const detailKey = (id: string) => ["nicheAnalysis", projectId, id];

  const history = useQuery({
    queryKey: historyKey,
    queryFn: () => listNicheAnalyses({ data: { projectId } }),
  });

  // A saved analysis never changes, so it is fetched once and kept.
  const detail = useQuery({
    queryKey: detailKey(selectedId ?? ""),
    queryFn: () => getNicheAnalysis({ data: { projectId, analysisId: selectedId! } }),
    enabled: selectedId !== null,
    staleTime: Infinity,
  });

  const analysis = useMutation({
    mutationFn: (data: { keyword: string; marketplace: AmazonMarketplaceCode; context: string }) =>
      analyzeNiche({ data: { projectId, ...data } }),
    onSuccess: (saved: ProductOpportunityResult) => {
      queryClient.setQueryData(detailKey(saved.id), saved);
      setSelectedId(saved.id);
      void queryClient.invalidateQueries({ queryKey: historyKey });
    },
  });

  const remove = useMutation({
    mutationFn: (analysisId: string) =>
      deleteNicheAnalysis({ data: { projectId, analysisId } }),
    onSuccess: (_, analysisId) => {
      if (analysisId === selectedId) setSelectedId(null);
      void queryClient.invalidateQueries({ queryKey: historyKey });
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = keyword.trim();
    if (trimmed.length < 2) return setError("Escribe el nicho o producto que quieres analizar.");
    setError(null);
    analysis.mutate({ keyword: trimmed, marketplace, context: context.trim() });
  };

  const result = selectedId ? detail.data : undefined;
  const verdict = result?.verdict;
  const summary = result?.summary;
  const domain = getAmazonMarketplace(result?.marketplace ?? marketplace).seDomain;

  return (
    <div className="px-4 py-4 pb-24 overflow-auto md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Lightbulb className="size-6" />
            ¿Qué producto lanzo?
            <span className="badge badge-sm badge-outline">Beta</span>
          </h1>
          <p className="text-sm text-base-content/70">
            Escribe un nicho y mira cuánto vende en Amazon, a qué precio, si entran marcas nuevas y si
            merece la pena lanzar ahí. Lee los productos que Amazon muestra hoy y un analista de IA te
            da el veredicto.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-info" />
          <div className="space-y-1">
            <p>
              <strong>De dónde salen las ventas:</strong> de la etiqueta pública de Amazon «X comprados
              el mes pasado». Son mínimos por tramos (50+, 100+, 1 mil+…), útiles para comparar, no para
              calcular stock.
            </p>
            <p className="text-base-content/70">
              Cada análisis cuesta unos {ANALYSIS_CREDITS} créditos y tarda alrededor de un minuto.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-xl border border-base-300 bg-base-100 p-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm sm:col-span-2">
              Nicho o producto
              <input
                className="input input-bordered w-full"
                placeholder="menopausia, cápsulas bronceadoras, colágeno…"
                value={keyword}
                onChange={(event) => setKeyword(event.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Mercado
              <select
                className="select select-bordered"
                value={marketplace}
                onChange={(event) =>
                  setMarketplace(
                    AMAZON_MARKETPLACES.find((m) => m.code === event.target.value)?.code ??
                      DEFAULT_AMAZON_MARKETPLACE_CODE,
                  )
                }
              >
                {AMAZON_MARKETPLACES.map((option) => (
                  <option key={option.code} value={option.code}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            Tu marca, en una frase (opcional)
            <textarea
              className="textarea textarea-bordered w-full"
              rows={2}
              placeholder="Marca de nutricosmética femenina, precio medio 26 €, ya fabrica con probióticos y ashwagandha."
              value={context}
              onChange={(event) => setContext(event.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary" disabled={analysis.isPending}>
            {analysis.isPending ? "Analizando el nicho (≈ 1 minuto)…" : `Analizar (≈ ${ANALYSIS_CREDITS} créditos)`}
          </button>
          {error ? <p className="text-sm text-error">{error}</p> : null}
        </form>

        {(history.data ?? []).length > 0 ? (
          <div className="rounded-xl border border-base-300 bg-base-100 p-4">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <History className="size-4" />
              Análisis anteriores
            </h3>
            <ul className="divide-y divide-base-300">
              {(history.data ?? []).map((item) => (
                <li key={item.id} className="flex items-center gap-2 py-2">
                  <button
                    type="button"
                    className={`flex flex-1 flex-wrap items-center gap-2 text-left text-sm hover:underline ${item.id === selectedId ? "font-semibold" : ""}`}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className={`badge badge-sm ${VERDICT_STYLE[item.verdict].className}`}>
                      {item.verdict}
                    </span>
                    <span>{item.keyword}</span>
                    <span className="text-base-content/50">
                      {item.marketplace} ·{" "}
                      {new Date(item.createdAt).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "2-digit" })}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    aria-label={`Borrar el análisis de ${item.keyword}`}
                    disabled={remove.isPending}
                    onClick={() => {
                      if (window.confirm(`¿Borrar el análisis de «${item.keyword}»? No se puede deshacer.`)) {
                        remove.mutate(item.id);
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-1 text-xs text-base-content/50">
              Se guardan solos. Abrir uno anterior no cuesta créditos.
            </p>
          </div>
        ) : null}

        {detail.isPending && selectedId ? (
          <p className="text-sm text-base-content/60">Cargando el análisis…</p>
        ) : null}

        {analysis.isError ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{getStandardErrorMessage(analysis.error, "No se pudo analizar el nicho")}</span>
          </div>
        ) : null}

        {verdict && summary && result ? (
          <div className="space-y-4">
            <div className="space-y-3 rounded-xl border border-base-300 bg-base-100 p-4">
              <p className="text-sm text-base-content/60">
                «{result.keyword}» en {getAmazonMarketplace(result.marketplace).label} ·{" "}
                {new Date(result.createdAt).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" })}
              </p>
              <span className={`badge ${VERDICT_STYLE[verdict.verdict].className}`}>
                {VERDICT_STYLE[verdict.verdict].label}
              </span>
              <p className="text-lg font-semibold">{verdict.headline}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ["Demanda", verdict.demand],
                  ["Competencia", verdict.competition],
                  ["Precio", verdict.pricing],
                  ["Marcas nuevas", verdict.newcomers],
                ].map(([title, text]) => (
                  <div key={title}>
                    <h3 className="text-sm font-semibold">{title}</h3>
                    <p className="text-sm text-base-content/80">{text}</p>
                  </div>
                ))}
              </div>
              {verdict.risks.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold">Riesgos</h3>
                  <ul className="list-disc pl-5 text-sm text-base-content/80">
                    {verdict.risks.map((risk) => <li key={risk}>{risk}</li>)}
                  </ul>
                </div>
              ) : null}
              {verdict.nextSteps.length > 0 ? (
                <div>
                  <h3 className="text-sm font-semibold">Qué hacer esta semana</h3>
                  <ul className="list-disc pl-5 text-sm text-base-content/80">
                    {verdict.nextSteps.map((step) => <li key={step}>{step}</li>)}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              {[
                ["Ventas/mes (mínimo)", formatNumber(summary.monthlySalesFloor)],
                ["Precio mediano", formatPrice(summary.price?.median ?? null)],
                ["Reseñas medianas", formatNumber(summary.medianVotes)],
                ["Top 3 se lleva", summary.top3Share === null ? "—" : `${Math.round(summary.top3Share * 100)} %`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-base-300 bg-base-100 p-3">
                  <p className="text-xs text-base-content/60">{label}</p>
                  <p className="text-xl font-semibold">{value}</p>
                </div>
              ))}
            </div>

            {summary.newcomers.length > 0 ? (
              <div className="rounded-xl border border-base-300 bg-base-100 p-4">
                <h3 className="mb-1 text-sm font-semibold">
                  Recién llegados: venden 200+ al mes con menos de 100 reseñas
                </h3>
                <div className="overflow-x-auto">
                  <table className="table table-sm">
                    <thead><tr><th>Producto</th><th>Ventas/mes</th><th>Precio</th><th>Reseñas</th><th>★</th></tr></thead>
                    <tbody>{summary.newcomers.map((p) => <ProductRow key={p.asin} product={p} domain={domain} />)}</tbody>
                  </table>
                </div>
              </div>
            ) : null}

            <div className="rounded-xl border border-base-300 bg-base-100 p-4">
              <h3 className="mb-1 text-sm font-semibold">Los que más venden</h3>
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead><tr><th>Producto</th><th>Ventas/mes</th><th>Precio</th><th>Reseñas</th><th>★</th></tr></thead>
                  <tbody>{summary.topSellers.map((p) => <ProductRow key={p.asin} product={p} domain={domain} />)}</tbody>
                </table>
              </div>
              <p className="mt-2 text-xs text-base-content/50">
                {summary.products} productos analizados, {summary.withSalesData} con dato de ventas.
                Sin libros ni ebooks.
              </p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
