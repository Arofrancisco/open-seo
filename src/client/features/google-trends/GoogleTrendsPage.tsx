import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Info, TrendingUp } from "lucide-react";
import { exploreGoogleTrends } from "@/serverFunctions/googleTrends";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  AUTUMN_SEO_DATA_CREDITS_PER_USD,
  SEO_DATA_COST_MARKUP,
} from "@/shared/billing";
import {
  bestMonths,
  dropIncompletePeriod,
  isValidTrendsKeyword,
  monthlySeasonality,
  summarizeKeywords,
  TRENDS_LOCATIONS,
  TRENDS_MAX_KEYWORDS,
  TRENDS_RANGES,
  TRENDS_SOURCES,
  type TrendsItem,
  type TrendsRange,
  type TrendsSource,
} from "@/shared/google-trends";
import {
  formatTrendDate,
  TREND_COLORS,
  TrendsChart,
} from "@/client/features/google-trends/TrendsChart";

type Props = { projectId: string };

type Params = {
  keywords: string[];
  locationCode: number;
  source: TrendsSource;
  range: TrendsRange;
};

// DataForSEO Google Trends Explore, live: $0.011 per request, whatever the
// number of keywords (verified 01/10/2026). Used only for the estimate shown.
const TRENDS_REQUEST_COST_USD = 0.011;
const MIN_RELIABLE_POINTS = 24;
const REQUEST_CREDITS = Math.ceil(
  TRENDS_REQUEST_COST_USD * SEO_DATA_COST_MARKUP * AUTUMN_SEO_DATA_CREDITS_PER_USD,
);

const monthName = (month: number) =>
  new Date(Date.UTC(2026, month, 1)).toLocaleDateString("es-ES", {
    timeZone: "UTC",
    month: "long",
  });

function useTrends(projectId: string, params: Params | null, item: TrendsItem, enabled: boolean) {
  return useQuery({
    queryKey: ["googleTrends", projectId, item, params],
    queryFn: () => exploreGoogleTrends({ data: { projectId, ...params!, item } }),
    enabled: enabled && params != null,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
}

export function GoogleTrendsPage({ projectId }: Props) {
  const [text, setText] = useState("");
  const [locationCode, setLocationCode] = useState<number>(TRENDS_LOCATIONS[0].code);
  const [source, setSource] = useState<TrendsSource>("web");
  const [range, setRange] = useState<TrendsRange>("past_5_years");
  const [params, setParams] = useState<Params | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRegions, setShowRegions] = useState(false);
  const [showQueries, setShowQueries] = useState(false);

  const graph = useTrends(projectId, params, "graph", true);
  const regions = useTrends(projectId, params, "map", showRegions);
  const queries = useTrends(projectId, params, "queries", showQueries && params?.keywords.length === 1);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const keywords = [...new Set(text.split(",").map((word) => word.trim()).filter(Boolean))];
    if (keywords.length === 0) return setError("Escribe al menos una palabra.");
    if (keywords.length > TRENDS_MAX_KEYWORDS) return setError(`Máximo ${TRENDS_MAX_KEYWORDS} palabras, separadas por comas.`);
    const bad = keywords.find((word) => !isValidTrendsKeyword(word));
    if (bad) return setError(`«${bad}»: de 2 a 100 caracteres y sin símbolos como - + : ( ) |`);
    setError(null);
    setShowRegions(false);
    setShowQueries(false);
    setParams({ keywords, locationCode, source, range });
  };

  const { points, dropped: inProgress } = dropIncompletePeriod(graph.data?.points ?? []);
  const summary = params ? summarizeKeywords(params.keywords, points) : [];
  const firstDate = points[0]?.from;
  const lastDate = points[points.length - 1]?.from;
  const monthsSinceLast = lastDate
    ? (Date.now() - Date.parse(`${lastDate}T00:00:00Z`)) / (30 * 24 * 3600 * 1000)
    : 0;
  // Few points, or a series that stops long ago, means Google has little data
  // for this search in this source: the average and the months are unreliable.
  const sparse = points.length > 0 && (points.length < MIN_RELIABLE_POINTS || monthsSinceLast > 4);

  return (
    <div className="px-4 py-4 pb-24 overflow-auto md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <TrendingUp className="size-6" />
            ¿Cuándo se busca?
            <span className="badge badge-sm badge-outline">Beta</span>
          </h1>
          <p className="text-sm text-base-content/70">
            Mira cómo evoluciona el interés por una búsqueda en Google (hasta 5 a la vez), en qué
            meses sube y en qué regiones. Útil para planificar contenido, stock y publicidad.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-info" />
          <div className="space-y-1">
            <p>
              <strong>Qué mide:</strong> un índice de 0 a 100 donde 100 es el momento de máximo
              interés <em>de esa búsqueda</em> en el periodo. Sirve para comparar y ver estacionalidad,
              no da el número de búsquedas.
            </p>
            <p className="text-base-content/70">
              Es de Google, no de Amazon: para productos, la fuente «Google Shopping» es la más
              cercana a la intención de compra. Cada consulta cuesta unos {REQUEST_CREDITS} créditos
              (el plan gratuito incluye para muchas pruebas). Con los cinco años se ve mejor qué meses
              repiten.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-3 rounded-xl border border-base-300 bg-base-100 p-4">
          <div>
            <label className="label" htmlFor="trends-keywords">
              <span className="label-text">Palabras (separadas por comas; máx. {TRENDS_MAX_KEYWORDS})</span>
            </label>
            <input
              id="trends-keywords"
              className="input input-bordered w-full"
              placeholder="zapatillas running, zapatillas trail"
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="flex flex-col gap-1 text-sm">
              Dónde
              <select className="select select-bordered" value={locationCode} onChange={(event) => setLocationCode(Number(event.target.value))}>
                {TRENDS_LOCATIONS.map((location) => (
                  <option key={location.code} value={location.code}>{location.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Fuente
              <select className="select select-bordered" value={source} onChange={(event) => setSource(TRENDS_SOURCES.find((s) => s.value === event.target.value)?.value ?? "web")}>
                {TRENDS_SOURCES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Periodo
              <select className="select select-bordered" value={range} onChange={(event) => setRange(TRENDS_RANGES.find((r) => r.value === event.target.value)?.value ?? "past_5_years")}>
                {TRENDS_RANGES.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={graph.isFetching}>
            {graph.isFetching ? "Consultando…" : `Ver tendencia (≈ ${REQUEST_CREDITS} créditos)`}
          </button>
          {error ? <p className="text-sm text-error">{error}</p> : null}
        </form>

        {graph.isError ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{getStandardErrorMessage(graph.error, "No se pudo consultar Google Trends")}</span>
          </div>
        ) : null}

        {params && graph.isSuccess ? (
          points.length === 0 ? (
            <p className="rounded-xl border border-dashed border-base-300 p-6 text-center text-sm text-base-content/70">
              Google no tiene datos suficientes para esas palabras en esa zona. Prueba con una búsqueda
              más habitual o con España entera.
            </p>
          ) : (
            <div className="space-y-4 rounded-xl border border-base-300 bg-base-100 p-4">
              {sparse ? (
                <div role="alert" className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                  <AlertCircle className="mt-0.5 size-4 shrink-0 text-warning" />
                  <span>
                    <strong>Google tiene pocos datos para esta búsqueda en esta fuente</strong>
                    : solo {points.length} puntos
                    {firstDate && lastDate ? `, de ${formatTrendDate(firstDate)} a ${formatTrendDate(lastDate)}` : ""}.
                    El gráfico y los meses con más interés no son fiables. Prueba con la fuente «Búsqueda de
                    Google» o con una palabra más habitual.
                  </span>
                </div>
              ) : null}
              <TrendsChart keywords={params.keywords} points={points} />
              {firstDate && lastDate ? (
                <p className="text-xs text-base-content/50">
                  {points.length} puntos de datos, de {formatTrendDate(firstDate)} a {formatTrendDate(lastDate)}.
                  {inProgress ? ` Se omite el periodo en curso (desde el ${formatTrendDate(inProgress.from, true)}): aún no ha terminado y Google lo muestra incompleto, como una caída que no es real.` : ""}
                </p>
              ) : null}
              <div className="overflow-x-auto">
                <table className="table table-sm">
                  <thead>
                    <tr><th>Palabra</th><th>Interés medio</th><th>Pico</th><th>Meses con más interés</th></tr>
                  </thead>
                  <tbody>
                    {summary.map((row, index) => {
                      const seasonality = points.length >= MIN_RELIABLE_POINTS ? monthlySeasonality(points, index) : null;
                      return (
                        <tr key={row.keyword}>
                          <td>
                            <span className="mr-2 inline-block size-2 rounded-full" style={{ background: TREND_COLORS[index % TREND_COLORS.length] }} />
                            {row.keyword}
                          </td>
                          <td>{row.average}</td>
                          <td>{row.peakFrom ? formatTrendDate(row.peakFrom) : "—"}</td>
                          <td className="capitalize">
                            {seasonality ? bestMonths(seasonality).map(monthName).join(", ") : points.length < MIN_RELIABLE_POINTS ? "Pocos datos" : "Elige 5 años para verlo"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn btn-outline btn-sm" disabled={showRegions} onClick={() => setShowRegions(true)}>
                  Ver por regiones (≈ {REQUEST_CREDITS} créditos)
                </button>
                {params.keywords.length === 1 ? (
                  <button type="button" className="btn btn-outline btn-sm" disabled={showQueries} onClick={() => setShowQueries(true)}>
                    Búsquedas relacionadas (≈ {REQUEST_CREDITS} créditos)
                  </button>
                ) : (
                  <span className="text-xs text-base-content/60">Las búsquedas relacionadas necesitan una sola palabra.</span>
                )}
              </div>

              {showRegions ? (
                regions.isPending ? <p className="text-sm text-base-content/60">Cargando regiones…</p> : (
                  <div>
                    <h3 className="mb-1 text-sm font-semibold">Dónde hay más interés</h3>
                    {(regions.data?.regions ?? []).length === 0 ? (
                      <p className="text-sm text-base-content/60">
                        Google no devuelve regiones para esta búsqueda en esta fuente. Prueba con «Búsqueda de Google».
                      </p>
                    ) : null}
                    <table className="table table-sm">
                      <thead><tr><th>Región</th>{params.keywords.map((word) => <th key={word}>{word}</th>)}</tr></thead>
                      <tbody>
                        {[...(regions.data?.regions ?? [])]
                          .sort((a, b) => (b.values[0] ?? 0) - (a.values[0] ?? 0))
                          .slice(0, 10)
                          .map((region) => (
                            <tr key={region.geoName}>
                              <td>{region.geoName}</td>
                              {params.keywords.map((word, index) => <td key={word}>{region.values[index] ?? "—"}</td>)}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : null}

              {showQueries ? (
                queries.isPending ? <p className="text-sm text-base-content/60">Cargando búsquedas relacionadas…</p> : (
                  (queries.data?.topQueries ?? []).length === 0 && (queries.data?.risingQueries ?? []).length === 0 ? (
                    <p className="text-sm text-base-content/60">
                      Google no devuelve búsquedas relacionadas para esta palabra en esta fuente. Prueba con
                      «Búsqueda de Google» o con una palabra más habitual.
                    </p>
                  ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <h3 className="mb-1 text-sm font-semibold">Más buscadas</h3>
                      <ul className="space-y-1 text-sm">
                        {(queries.data?.topQueries ?? []).slice(0, 10).map((row) => (
                          <li key={row.query} className="flex justify-between gap-2"><span>{row.query}</span><span className="text-base-content/50">{row.value}</span></li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="mb-1 text-sm font-semibold">En alza (% de subida)</h3>
                      <ul className="space-y-1 text-sm">
                        {(queries.data?.risingQueries ?? []).slice(0, 10).map((row) => (
                          <li key={row.query} className="flex justify-between gap-2"><span>{row.query}</span><span className="text-base-content/50">+{row.value}%</span></li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  )
                )
              ) : null}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
