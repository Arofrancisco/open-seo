import { Fragment, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  Award,
  ChevronDown,
  ChevronRight,
  Download,
  ListOrdered,
  Minus,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import {
  addAmazonRankKeyword,
  deleteAmazonRankKeyword,
  exportAmazonRankHistory,
  listAmazonRankKeywords,
  startAllAmazonRankChecks,
  startAmazonRankCheck,
  type AmazonRankCheckView,
  type AmazonRankKeywordView,
} from "@/serverFunctions/amazonRank";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  AMAZON_MARKETPLACES,
  DEFAULT_AMAZON_MARKETPLACE_CODE,
  type AmazonMarketplaceCode,
} from "@/shared/amazon-marketplaces";
import {
  buildAmazonRankCsv,
  buildAmazonRankJson,
  downloadFile,
} from "@/client/features/amazon-rank/amazonRankExport";

type Props = { projectId: string };

const ASIN_RE = /^[A-Z0-9]{10}$/;

const listKey = (projectId: string) => ["amazonRankKeywords", projectId];

function marketFor(code: string) {
  return AMAZON_MARKETPLACES.find((m) => m.code === code);
}

export function AmazonRankTrackingPage({ projectId }: Props) {
  const queryClient = useQueryClient();
  const keywordsQuery = useQuery({
    queryKey: listKey(projectId),
    queryFn: () => listAmazonRankKeywords({ data: { projectId } }),
    // Each load also collects finished checks server-side.
    refetchInterval: (query) =>
      query.state.data?.some((keyword) => keyword.pending) ? 5000 : false,
  });

  const checkAll = useMutation({
    mutationFn: () => startAllAmazonRankChecks({ data: { projectId } }),
    onSuccess: ({ started, skipped }) => {
      void queryClient.invalidateQueries({ queryKey: listKey(projectId) });
      toast.success(
        started === 0
          ? "Todas las palabras clave ya se están comprobando"
          : `Comprobando ${started} palabra${started === 1 ? "" : "s"} clave${
              skipped ? ` (${skipped} ya estaban en curso)` : ""
            }`,
      );
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: listKey(projectId) });
      toast.error(
        getStandardErrorMessage(error, "No se pudieron lanzar las comprobaciones"),
      );
    },
  });

  const exportData = useMutation({
    mutationFn: (format: "csv" | "json") =>
      exportAmazonRankHistory({ data: { projectId } }).then((keywords) => ({
        format,
        keywords,
      })),
    onSuccess: ({ format, keywords }) => {
      const date = new Date().toISOString().slice(0, 10);
      if (format === "csv") {
        downloadFile(
          `amazon-posiciones-${date}.csv`,
          buildAmazonRankCsv(keywords),
          "text/csv;charset=utf-8",
        );
      } else {
        downloadFile(
          `amazon-posiciones-${date}.json`,
          buildAmazonRankJson(keywords),
          "application/json",
        );
      }
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "No se pudo exportar")),
  });

  const keywords = keywordsQuery.data ?? [];
  const hasKeywords = keywords.length > 0;
  const hasHistory = keywords.some((keyword) => keyword.history.length > 0);

  return (
    <div className="px-4 py-4 pb-24 overflow-auto md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-6xl space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold">
              <ListOrdered className="size-6" />
              Posiciones en Amazon
            </h1>
            <p className="text-sm text-base-content/70">
              En qué posición aparece cada producto cuando alguien busca una
              palabra clave en Amazon, y quién va por delante. Cada
              comprobación queda guardada en este proyecto.
            </p>
          </div>
          {hasKeywords ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-primary btn-sm gap-1"
                disabled={checkAll.isPending}
                onClick={() => checkAll.mutate()}
              >
                <RefreshCw
                  className={`size-4 ${checkAll.isPending ? "animate-spin" : ""}`}
                />
                Comprobar todas
              </button>
              <button
                type="button"
                className="btn btn-sm gap-1"
                disabled={!hasHistory || exportData.isPending}
                onClick={() => exportData.mutate("csv")}
              >
                <Download className="size-4" />
                CSV
              </button>
              <button
                type="button"
                className="btn btn-sm gap-1"
                disabled={!hasHistory || exportData.isPending}
                onClick={() => exportData.mutate("json")}
              >
                <Download className="size-4" />
                JSON
              </button>
            </div>
          ) : null}
        </div>

        <AddKeywordForm projectId={projectId} />

        {keywordsQuery.isError ? (
          <ErrorAlert message={getStandardErrorMessage(keywordsQuery.error)} />
        ) : keywordsQuery.isPending ? (
          <div className="flex justify-center p-6">
            <span className="loading loading-spinner" />
          </div>
        ) : !hasKeywords ? (
          <div className="rounded-xl border border-base-300 bg-base-100 p-6 text-center text-sm text-base-content/70">
            Aún no sigues ninguna palabra clave. Añade un ASIN y la búsqueda
            para la que quieres saber su posición.
          </div>
        ) : (
          <KeywordsTable projectId={projectId} keywords={keywords} />
        )}
      </div>
    </div>
  );
}

function AddKeywordForm({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [asin, setAsin] = useState("");
  const [keyword, setKeyword] = useState("");
  const [marketplace, setMarketplace] = useState<AmazonMarketplaceCode>(
    DEFAULT_AMAZON_MARKETPLACE_CODE,
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const addMutation = useMutation({
    mutationFn: (input: {
      asin: string;
      keyword: string;
      marketplace: AmazonMarketplaceCode;
    }) => addAmazonRankKeyword({ data: { projectId, ...input } }),
    onSuccess: ({ added }) => {
      void queryClient.invalidateQueries({ queryKey: listKey(projectId) });
      if (!added) {
        toast.info("Esa palabra clave ya estaba en la lista");
        return;
      }
      toast.success("Palabra clave añadida");
      setKeyword("");
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "No se pudo añadir")),
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const cleanAsin = asin.trim().toUpperCase();
    const cleanKeyword = keyword.trim();
    if (!ASIN_RE.test(cleanAsin)) {
      setValidationError("Introduce un ASIN válido de 10 caracteres");
      return;
    }
    if (!cleanKeyword) {
      setValidationError("Introduce la palabra clave que buscaría un cliente");
      return;
    }
    setValidationError(null);
    setAsin(cleanAsin);
    addMutation.mutate({ asin: cleanAsin, keyword: cleanKeyword, marketplace });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-base-300 bg-base-100 p-4"
    >
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
        <div className="md:w-40">
          <label className="label" htmlFor="rank-asin">
            <span className="label-text">ASIN</span>
          </label>
          <input
            id="rank-asin"
            className="input input-bordered w-full"
            placeholder="B08N5WRWNW"
            maxLength={10}
            value={asin}
            onChange={(event) => setAsin(event.target.value)}
          />
        </div>
        <div className="flex-1">
          <label className="label" htmlFor="rank-keyword">
            <span className="label-text">Palabra clave en Amazon</span>
          </label>
          <input
            id="rank-keyword"
            className="input input-bordered w-full"
            placeholder="probióticos para la piel"
            maxLength={200}
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="rank-marketplace">
            <span className="label-text">Marketplace</span>
          </label>
          <select
            id="rank-marketplace"
            className="select select-bordered"
            value={marketplace}
            onChange={(event) =>
              setMarketplace(event.target.value as AmazonMarketplaceCode)
            }
          >
            {AMAZON_MARKETPLACES.map((market) => (
              <option key={market.code} value={market.code}>
                {market.label}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="btn btn-primary"
          disabled={addMutation.isPending}
        >
          {addMutation.isPending ? "Añadiendo…" : "Añadir"}
        </button>
      </div>
      {validationError ? (
        <p className="mt-2 text-xs text-error">{validationError}</p>
      ) : null}
    </form>
  );
}

function KeywordsTable({
  projectId,
  keywords,
}: {
  projectId: string;
  keywords: AmazonRankKeywordView[];
}) {
  return (
    <div className="overflow-x-auto rounded-xl border border-base-300 bg-base-100">
      <table className="table">
        <thead>
          <tr>
            <th className="w-8" />
            <th>Palabra clave</th>
            <th>ASIN</th>
            <th>Orgánica</th>
            <th>Patrocinada</th>
            <th>Última comprobación</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {keywords.map((keyword) => (
            <KeywordRow key={keyword.id} projectId={projectId} row={keyword} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeywordRow({
  projectId,
  row,
}: {
  projectId: string;
  row: AmazonRankKeywordView;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const refreshList = () =>
    queryClient.invalidateQueries({ queryKey: listKey(projectId) });

  const startMutation = useMutation({
    mutationFn: () =>
      startAmazonRankCheck({ data: { projectId, keywordId: row.id } }),
    onSuccess: () => void refreshList(),
    onError: (error) =>
      toast.error(
        getStandardErrorMessage(error, "No se pudo lanzar la comprobación"),
      ),
  });

  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteAmazonRankKeyword({ data: { projectId, keywordId: row.id } }),
    onSuccess: () => void refreshList(),
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "No se pudo borrar")),
  });

  const [latest = null, previous = null] = row.history;
  const isChecking = startMutation.isPending || row.pending;
  const market = marketFor(row.marketplace);
  const domain = market?.seDomain ?? "amazon.es";

  return (
    <Fragment>
      <tr>
        <td>
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            aria-label={expanded ? "Ocultar detalle" : "Ver detalle"}
            disabled={!latest}
            onClick={() => setExpanded((value) => !value)}
          >
            {expanded ? (
              <ChevronDown className="size-4" />
            ) : (
              <ChevronRight className="size-4" />
            )}
          </button>
        </td>
        <td>
          <div className="font-medium">{row.keyword}</div>
          <div className="text-xs text-base-content/60">{domain}</div>
        </td>
        <td className="font-mono text-xs">
          <a
            href={`https://www.${domain}/dp/${row.asin}`}
            target="_blank"
            rel="noopener noreferrer"
            className="link link-hover"
          >
            {row.asin}
          </a>
        </td>
        <td>
          <div className="flex flex-col gap-1">
            <Position
              current={latest?.organicPosition ?? null}
              previous={previous?.organicPosition ?? null}
              checked={latest != null}
              scanned={latest?.organicResultsScanned ?? 0}
            />
            <Badges check={latest} />
          </div>
        </td>
        <td>
          <Position
            current={latest?.sponsoredPosition ?? null}
            previous={previous?.sponsoredPosition ?? null}
            checked={latest != null}
            scanned={null}
          />
        </td>
        <td className="text-xs text-base-content/70">
          {row.pending
            ? "Comprobando…"
            : latest
              ? formatDate(latest.checkedAt)
              : "Nunca"}
        </td>
        <td>
          <div className="flex justify-end gap-1">
            <button
              type="button"
              className="btn btn-sm gap-1"
              disabled={isChecking}
              onClick={() => startMutation.mutate()}
            >
              <RefreshCw
                className={`size-3.5 ${isChecking ? "animate-spin" : ""}`}
              />
              {isChecking ? "Comprobando…" : "Comprobar"}
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              aria-label="Dejar de seguir"
              disabled={isChecking || deleteMutation.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    `¿Dejar de seguir "${row.keyword}"? Se borra su historial.`,
                  )
                ) {
                  deleteMutation.mutate();
                }
              }}
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        </td>
      </tr>
      {expanded && latest ? (
        <tr>
          <td colSpan={7} className="bg-base-200/40">
            <KeywordDetail row={row} latest={latest} domain={domain} />
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
}

function KeywordDetail({
  row,
  latest,
  domain,
}: {
  row: AmazonRankKeywordView;
  latest: AmazonRankCheckView;
  domain: string;
}) {
  return (
    <div className="grid gap-4 p-2 lg:grid-cols-[2fr_1fr]">
      <div>
        <h3 className="mb-2 text-sm font-semibold">
          Top {latest.topResults.length} orgánico para “{row.keyword}”
        </h3>
        {latest.topResults.length === 0 ? (
          <p className="text-xs text-base-content/60">Sin datos del top.</p>
        ) : (
          <table className="table table-xs">
            <tbody>
              {latest.topResults.map((top) => {
                const isYou = top.asin?.toUpperCase() === row.asin;
                return (
                  <tr key={top.position} className={isYou ? "bg-primary/10" : ""}>
                    <td className="w-8 font-semibold">#{top.position}</td>
                    <td>
                      {top.asin ? (
                        <a
                          href={`https://www.${domain}/dp/${top.asin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="link link-hover"
                        >
                          {top.title ?? top.asin}
                        </a>
                      ) : (
                        (top.title ?? "—")
                      )}
                      {isYou ? (
                        <span className="badge badge-primary badge-xs ml-2">
                          Tu producto
                        </span>
                      ) : null}
                      {top.isAmazonChoice ? (
                        <span className="badge badge-xs ml-1">Amazon's Choice</span>
                      ) : null}
                      {top.isBestSeller ? (
                        <span className="badge badge-warning badge-xs ml-1">
                          Más vendido
                        </span>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap">
                      {top.price != null
                        ? `${top.price.toFixed(2)} ${top.currency ?? ""}`
                        : "—"}
                    </td>
                    <td className="whitespace-nowrap">
                      {top.rating != null ? (
                        <span className="inline-flex items-center gap-0.5">
                          <Star className="size-3" />
                          {top.rating}
                          {top.votes != null ? ` (${top.votes})` : ""}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <div>
        <h3 className="mb-2 text-sm font-semibold">Historial</h3>
        <table className="table table-xs">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Orgánica</th>
              <th>Patroc.</th>
            </tr>
          </thead>
          <tbody>
            {row.history.map((check) => (
              <tr key={check.checkedAt}>
                <td className="whitespace-nowrap">
                  {formatDate(check.checkedAt)}
                </td>
                <td>
                  {check.organicPosition != null
                    ? `#${check.organicPosition}`
                    : "—"}
                </td>
                <td>
                  {check.sponsoredPosition != null
                    ? `#${check.sponsoredPosition}`
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Badges({ check }: { check: AmazonRankCheckView | null }) {
  if (!check?.isAmazonChoice && !check?.isBestSeller) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {check.isAmazonChoice ? (
        <span className="badge badge-xs gap-0.5">
          <Award className="size-3" />
          Amazon's Choice
        </span>
      ) : null}
      {check.isBestSeller ? (
        <span className="badge badge-warning badge-xs">Más vendido</span>
      ) : null}
    </div>
  );
}

function Position({
  current,
  previous,
  checked,
  scanned,
}: {
  current: number | null;
  previous: number | null;
  checked: boolean;
  scanned: number | null;
}) {
  if (!checked) return <span className="text-base-content/40">—</span>;
  if (current == null) {
    return (
      <span className="text-xs text-base-content/60">
        {scanned ? `Fuera del top ${scanned}` : "No aparece"}
      </span>
    );
  }
  const delta = previous == null ? null : previous - current;
  return (
    <span className="inline-flex items-center gap-1 font-semibold">
      #{current}
      {delta == null ? null : delta > 0 ? (
        <span className="inline-flex items-center text-xs text-success">
          <ArrowUp className="size-3" />
          {delta}
        </span>
      ) : delta < 0 ? (
        <span className="inline-flex items-center text-xs text-error">
          <ArrowDown className="size-3" />
          {-delta}
        </span>
      ) : (
        <Minus className="size-3 text-base-content/40" />
      )}
    </span>
  );
}

function ErrorAlert({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" />
      <span>{message}</span>
    </div>
  );
}

function formatDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
