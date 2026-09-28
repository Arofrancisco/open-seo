import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Download, Plus, ScanSearch } from "lucide-react";
import {
  confirmReverseAsinKeywords,
  getReverseAsinRun,
  listReverseAsinRuns,
  startReverseAsin,
  type ReverseAsinResultView,
  type ReverseAsinRunView,
} from "@/serverFunctions/amazonReverseAsin";
import { addAmazonRankKeyword } from "@/serverFunctions/amazonRank";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { downloadFile } from "@/client/features/amazon-rank/amazonRankExport";
import {
  AMAZON_MARKETPLACES,
  DEFAULT_AMAZON_MARKETPLACE_CODE,
  getAmazonMarketplace,
  type AmazonMarketplaceCode,
} from "@/shared/amazon-marketplaces";
import {
  AUTUMN_SEO_DATA_CREDITS_PER_USD,
  SEO_DATA_COST_MARKUP,
} from "@/shared/billing";
import {
  defaultSelection,
  MAX_REVERSE_ASIN_KEYWORDS,
} from "@/shared/reverse-asin-candidates";

type Props = { projectId: string };

const ASIN_RE = /^[A-Z0-9]{10}$/;
// DataForSEO Merchant API, Amazon products search, priority queue (verified
// 28/09/2026). Only used for the estimate shown before launching.
const AMAZON_SEARCH_COST_USD = 0.003;
const ACTIVE_STATUSES = new Set(["fetching_product", "generating", "checking"]);

const runsKey = (projectId: string) => ["amazonReverseAsinRuns", projectId];
const runKey = (projectId: string, runId: string | null) => [
  "amazonReverseAsinRun",
  projectId,
  runId,
];

function estimateCredits(keywordCount: number) {
  return Math.ceil(
    keywordCount *
      AMAZON_SEARCH_COST_USD *
      SEO_DATA_COST_MARKUP *
      AUTUMN_SEO_DATA_CREDITS_PER_USD,
  );
}

export function AmazonReverseAsinPage({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [asin, setAsin] = useState("");
  const [marketplace, setMarketplace] = useState<AmazonMarketplaceCode>(
    DEFAULT_AMAZON_MARKETPLACE_CODE,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);

  const runs = useQuery({
    queryKey: runsKey(projectId),
    queryFn: () => listReverseAsinRuns({ data: { projectId } }),
  });

  const run = useQuery({
    queryKey: runKey(projectId, runId),
    queryFn: () => getReverseAsinRun({ data: { projectId, runId: runId! } }),
    enabled: runId != null,
    refetchInterval: (query) =>
      query.state.data && ACTIVE_STATUSES.has(query.state.data.status)
        ? 5000
        : false,
  });

  const status = run.data?.status;
  useEffect(() => {
    if (status) void queryClient.invalidateQueries({ queryKey: runsKey(projectId) });
  }, [status, projectId, queryClient]);

  const start = useMutation({
    mutationFn: (input: { asin: string; marketplace: AmazonMarketplaceCode }) =>
      startReverseAsin({ data: { projectId, ...input } }),
    onSuccess: ({ runId: newRunId }) => {
      setRunId(newRunId);
      void queryClient.invalidateQueries({ queryKey: runsKey(projectId) });
    },
  });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = asin.trim().toUpperCase();
    if (!ASIN_RE.test(trimmed)) {
      setValidationError(
        "Introduce un ASIN válido de 10 caracteres (ej. B08N5WRWNW)",
      );
      return;
    }
    setValidationError(null);
    setAsin(trimmed);
    start.mutate({ asin: trimmed, marketplace });
  };

  return (
    <div className="px-4 py-4 pb-24 overflow-auto md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ScanSearch className="size-6" />
            Reverse ASIN
          </h1>
          <p className="text-sm text-base-content/70">
            Descubre por qué búsquedas de Amazon aparece un producto y en qué
            posición. La herramienta propone palabras clave a partir del título
            y de las búsquedas de Google del país, y comprueba cada una en
            Amazon.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="label" htmlFor="reverse-asin-input">
              <span className="label-text">ASIN</span>
            </label>
            <input
              id="reverse-asin-input"
              type="text"
              className={`input input-bordered w-full ${validationError ? "input-error" : ""}`}
              placeholder="B08N5WRWNW"
              value={asin}
              maxLength={10}
              onChange={(event) => {
                setAsin(event.target.value);
                if (validationError) setValidationError(null);
              }}
            />
            {validationError ? (
              <span className="mt-1 block text-xs text-error">
                {validationError}
              </span>
            ) : null}
          </div>
          <div>
            <label className="label" htmlFor="reverse-asin-marketplace">
              <span className="label-text">Marketplace</span>
            </label>
            <select
              id="reverse-asin-marketplace"
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
            disabled={start.isPending}
          >
            {start.isPending ? "Iniciando…" : "Analizar"}
          </button>
        </form>

        <ErrorAlert
          message={
            start.isError
              ? getStandardErrorMessage(start.error, "No se pudo iniciar el análisis")
              : null
          }
        />

        {runs.data && runs.data.length > 0 ? (
          <div className="rounded-xl border border-base-300 bg-base-100 p-4">
            <h2 className="mb-2 text-sm font-medium text-base-content/70">
              Análisis recientes
            </h2>
            <div className="flex flex-wrap gap-2">
              {runs.data.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`btn btn-sm ${item.id === runId ? "btn-primary" : "btn-ghost border border-base-300"}`}
                  onClick={() => setRunId(item.id)}
                  title={item.title ?? item.asin}
                >
                  {item.asin} · {item.marketplace}
                  <span className="text-xs opacity-70">
                    {STATUS_LABELS[item.status]}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {runId ? (
          <RunPanel
            projectId={projectId}
            run={run.data}
            loadError={
              run.isError
                ? getStandardErrorMessage(run.error, "No se pudo cargar el análisis")
                : null
            }
          />
        ) : null}
      </div>
    </div>
  );
}

const STATUS_LABELS: Record<ReverseAsinRunView["status"], string> = {
  fetching_product: "leyendo ficha",
  generating: "preparando",
  choosing_keywords: "elegir palabras",
  checking: "buscando en Amazon",
  done: "terminado",
  not_found: "no encontrado",
};

function RunPanel({
  projectId,
  run,
  loadError,
}: {
  projectId: string;
  run: ReverseAsinRunView | undefined;
  loadError: string | null;
}) {
  if (loadError) return <ErrorAlert message={loadError} />;
  if (!run) return <LoadingCard text="Cargando análisis…" />;

  const market = getAmazonMarketplace(run.marketplace);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-base-300 bg-base-100 p-4">
        <div className="text-xs text-base-content/60">
          {run.asin} · {market.label}
          {run.brand ? ` · ${run.brand}` : ""}
        </div>
        <h2 className="font-medium">{run.title ?? "Leyendo la ficha del producto…"}</h2>
      </div>

      {run.status === "fetching_product" || run.status === "generating" ? (
        <LoadingCard text="Leyendo la ficha y preparando palabras clave… suele tardar uno o dos minutos." />
      ) : null}
      {run.status === "not_found" ? (
        <InfoCard text="No se encontró ese ASIN en este marketplace." />
      ) : null}
      {run.status === "choosing_keywords" ? (
        <CandidatePicker key={run.id} projectId={projectId} run={run} />
      ) : null}
      {run.status === "checking" || run.status === "done" ? (
        <ResultsTable projectId={projectId} run={run} />
      ) : null}
    </div>
  );
}

function CandidatePicker({
  projectId,
  run,
}: {
  projectId: string;
  run: ReverseAsinRunView;
}) {
  const queryClient = useQueryClient();
  const [extra, setExtra] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(defaultSelection(run.candidates)),
  );

  const rows = useMemo(
    () => [
      ...extra.map((keyword) => ({
        keyword,
        googleVolume: null,
        source: "manual" as const,
      })),
      ...run.candidates,
    ],
    [extra, run.candidates],
  );

  const confirm = useMutation({
    mutationFn: (keywords: string[]) =>
      confirmReverseAsinKeywords({
        data: { projectId, runId: run.id, keywords },
      }),
    onSuccess: ({ posted, stoppedEarly }) => {
      if (stoppedEarly) {
        toast.warning(
          `Solo se pudieron lanzar ${posted} búsquedas (¿sin créditos suficientes?). Se analizan esas.`,
        );
      }
      void queryClient.invalidateQueries({ queryKey: runKey(projectId, run.id) });
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "No se pudo lanzar la búsqueda")),
  });

  const toggle = (keyword: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(keyword)) next.delete(keyword);
      else next.add(keyword);
      return next;
    });

  const addCustom = (event: FormEvent) => {
    event.preventDefault();
    const keyword = custom.trim().toLocaleLowerCase();
    if (!keyword) return;
    if (!rows.some((row) => row.keyword === keyword)) {
      setExtra((current) => [keyword, ...current]);
    }
    setSelected((current) => new Set(current).add(keyword));
    setCustom("");
  };

  const count = selected.size;
  const tooMany = count > MAX_REVERSE_ASIN_KEYWORDS;

  return (
    <div className="space-y-3 rounded-xl border border-base-300 bg-base-100 p-4">
      <div>
        <h3 className="font-medium">Elige las palabras clave que quieres comprobar</h3>
        <p className="text-sm text-base-content/70">
          Cada palabra se busca en Amazon para ver si aparece este producto. El
          volumen es de Google en el país del marketplace: sirve para comparar
          qué búsqueda pesa más, no es el volumen de Amazon.
        </p>
      </div>

      <form onSubmit={addCustom} className="flex gap-2">
        <input
          type="text"
          className="input input-bordered input-sm flex-1"
          placeholder="Añadir otra palabra clave"
          value={custom}
          maxLength={200}
          onChange={(event) => setCustom(event.target.value)}
        />
        <button type="submit" className="btn btn-sm gap-1">
          <Plus className="size-4" />
          Añadir
        </button>
      </form>

      <div className="flex gap-2 text-xs">
        <button
          type="button"
          className="link"
          onClick={() =>
            setSelected(
              new Set(rows.slice(0, MAX_REVERSE_ASIN_KEYWORDS).map((row) => row.keyword)),
            )
          }
        >
          Seleccionar todas
        </button>
        <button type="button" className="link" onClick={() => setSelected(new Set())}>
          Ninguna
        </button>
      </div>

      <div className="max-h-96 overflow-auto rounded-lg border border-base-300">
        <table className="table table-sm">
          <thead>
            <tr>
              <th />
              <th>Palabra clave</th>
              <th className="text-right">Volumen Google</th>
              <th>Origen</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.keyword}>
                <td>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={selected.has(row.keyword)}
                    onChange={() => toggle(row.keyword)}
                    aria-label={`Seleccionar ${row.keyword}`}
                  />
                </td>
                <td>{row.keyword}</td>
                <td className="text-right tabular-nums">
                  {row.googleVolume == null
                    ? "—"
                    : row.googleVolume.toLocaleString("es-ES")}
                </td>
                <td className="text-xs text-base-content/60">
                  {row.source === "google"
                    ? "Google"
                    : row.source === "title"
                      ? "Título"
                      : "Manual"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm text-base-content/70">
          {count} seleccionadas · coste aproximado {estimateCredits(count)} créditos
          {tooMany ? (
            <span className="text-error">
              {" "}
              · máximo {MAX_REVERSE_ASIN_KEYWORDS}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-primary"
          disabled={count === 0 || tooMany || confirm.isPending}
          onClick={() => confirm.mutate([...selected])}
        >
          {confirm.isPending ? "Lanzando…" : `Buscar en Amazon (${count})`}
        </button>
      </div>
    </div>
  );
}

function sortResults(results: ReverseAsinResultView[]) {
  const rank = (row: ReverseAsinResultView) =>
    row.pending
      ? 3
      : row.organicPosition != null
        ? 0
        : row.sponsoredPosition != null
          ? 1
          : 2;
  return [...results].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.organicPosition ?? 999) - (b.organicPosition ?? 999) ||
      (b.googleVolume ?? -1) - (a.googleVolume ?? -1),
  );
}

function ResultsTable({
  projectId,
  run,
}: {
  projectId: string;
  run: ReverseAsinRunView;
}) {
  const rows = useMemo(() => sortResults(run.results), [run.results]);
  const pending = rows.filter((row) => row.pending).length;
  const found = rows.filter((row) => row.organicPosition != null).length;

  const track = useMutation({
    mutationFn: (keyword: string) =>
      addAmazonRankKeyword({
        data: { projectId, asin: run.asin, keyword, marketplace: run.marketplace },
      }),
    onSuccess: ({ added }) =>
      added
        ? toast.success("Añadida al Amazon Rank Tracking")
        : toast.info("Esa palabra clave ya estaba en el Rank Tracking"),
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "No se pudo añadir")),
  });

  const exportCsv = () =>
    downloadFile(
      `reverse-asin-${run.asin}-${run.marketplace}.csv`,
      buildReverseAsinCsv(run, rows),
      "text/csv;charset=utf-8",
    );

  return (
    <div className="space-y-3 rounded-xl border border-base-300 bg-base-100 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-sm">
          Aparece en orgánico en <strong>{found}</strong> de {rows.length} búsquedas
          {pending > 0 ? (
            <span className="text-base-content/60">
              {" "}
              · {pending} en curso (suele tardar un par de minutos; puedes cerrar
              la página)
            </span>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-sm btn-outline gap-1"
          onClick={exportCsv}
          disabled={pending === rows.length}
        >
          <Download className="size-4" />
          Exportar CSV
        </button>
      </div>

      <div className="overflow-auto rounded-lg border border-base-300">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>Palabra clave</th>
              <th className="text-right">Orgánica</th>
              <th className="text-right">Patrocinada</th>
              <th className="text-right">Volumen Google</th>
              <th>Etiquetas</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.keyword}>
                <td>{row.keyword}</td>
                <td className="text-right tabular-nums">
                  {row.pending ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : row.organicPosition != null ? (
                    `#${row.organicPosition}`
                  ) : (
                    <span className="text-base-content/50">
                      no aparece
                      {row.organicResultsScanned
                        ? ` (top ${row.organicResultsScanned})`
                        : ""}
                    </span>
                  )}
                </td>
                <td className="text-right tabular-nums">
                  {row.sponsoredPosition != null ? `#${row.sponsoredPosition}` : "—"}
                </td>
                <td className="text-right tabular-nums">
                  {row.googleVolume == null
                    ? "—"
                    : row.googleVolume.toLocaleString("es-ES")}
                </td>
                <td className="space-x-1 text-xs">
                  {row.isAmazonChoice ? (
                    <span className="badge badge-sm">Amazon&apos;s Choice</span>
                  ) : null}
                  {row.isBestSeller ? (
                    <span className="badge badge-sm">Más vendido</span>
                  ) : null}
                </td>
                <td className="text-right">
                  <button
                    type="button"
                    className="btn btn-ghost btn-xs"
                    disabled={track.isPending}
                    onClick={() => track.mutate(row.keyword)}
                  >
                    Seguir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const text = typeof value === "boolean" ? (value ? "sí" : "no") : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function buildReverseAsinCsv(
  run: ReverseAsinRunView,
  rows: ReverseAsinResultView[],
): string {
  const header = [
    "asin",
    "marketplace",
    "palabra_clave",
    "posicion_organica",
    "posicion_patrocinada",
    "resultados_analizados",
    "volumen_google",
    "amazons_choice",
    "mas_vendido",
  ];
  const lines = rows
    .filter((row) => !row.pending)
    .map((row) => [
      run.asin,
      run.marketplace,
      row.keyword,
      row.organicPosition,
      row.sponsoredPosition,
      row.organicResultsScanned,
      row.googleVolume,
      row.isAmazonChoice,
      row.isBestSeller,
    ]);
  return `﻿${[header, ...lines].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

function ErrorAlert({ message }: { message: string | null }) {
  if (!message) return null;
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

function LoadingCard({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-xl border border-base-300 bg-base-100 p-6 text-sm text-base-content/70">
      <span className="loading loading-spinner loading-sm" />
      {text}
    </div>
  );
}

function InfoCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-6 text-center text-sm text-base-content/70">
      {text}
    </div>
  );
}
