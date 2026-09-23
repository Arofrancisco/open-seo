import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ListOrdered,
  Minus,
  RefreshCw,
  Trash2,
} from "lucide-react";
import {
  addAmazonRankKeyword,
  deleteAmazonRankKeyword,
  getAmazonRankCheckStatus,
  listAmazonRankKeywords,
  startAmazonRankCheck,
  type AmazonRankKeywordView,
} from "@/serverFunctions/amazonRank";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  AMAZON_MARKETPLACES,
  DEFAULT_AMAZON_MARKETPLACE_CODE,
  type AmazonMarketplaceCode,
} from "@/shared/amazon-marketplaces";

type Props = { projectId: string };

const ASIN_RE = /^[A-Z0-9]{10}$/;

const listKey = (projectId: string) => ["amazonRankKeywords", projectId];

export function AmazonRankTrackingPage({ projectId }: Props) {
  const keywordsQuery = useQuery({
    queryKey: listKey(projectId),
    queryFn: () => listAmazonRankKeywords({ data: { projectId } }),
  });

  return (
    <div className="px-4 py-4 pb-24 overflow-auto md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-5xl space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <ListOrdered className="size-6" />
            Posiciones en Amazon
          </h1>
          <p className="text-sm text-base-content/70">
            En qué posición aparece cada producto cuando alguien busca una
            palabra clave en Amazon. Cada comprobación queda guardada en este
            proyecto.
          </p>
        </div>

        <AddKeywordForm projectId={projectId} />

        {keywordsQuery.isError ? (
          <ErrorAlert message={getStandardErrorMessage(keywordsQuery.error)} />
        ) : keywordsQuery.isPending ? (
          <div className="flex justify-center p-6">
            <span className="loading loading-spinner" />
          </div>
        ) : keywordsQuery.data.length === 0 ? (
          <div className="rounded-xl border border-base-300 bg-base-100 p-6 text-center text-sm text-base-content/70">
            Aún no sigues ninguna palabra clave. Añade un ASIN y la búsqueda
            para la que quieres saber su posición.
          </div>
        ) : (
          <KeywordsTable projectId={projectId} keywords={keywordsQuery.data} />
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
  const [taskId, setTaskId] = useState<string | null>(null);

  const refreshList = () =>
    queryClient.invalidateQueries({ queryKey: listKey(projectId) });

  const startMutation = useMutation({
    mutationFn: () =>
      startAmazonRankCheck({ data: { projectId, keywordId: row.id } }),
    onSuccess: ({ taskId: id }) => setTaskId(id),
    onError: (error) =>
      toast.error(
        getStandardErrorMessage(error, "No se pudo lanzar la comprobación"),
      ),
  });

  const statusQuery = useQuery({
    queryKey: ["amazonRankCheck", projectId, row.id, taskId],
    queryFn: () =>
      getAmazonRankCheckStatus({
        data: { projectId, keywordId: row.id, taskId: taskId! },
      }),
    enabled: taskId != null,
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 4000 : false,
    retry: false,
  });

  const checkStatus = statusQuery.data?.status;
  const checkFailed = statusQuery.isError;
  useEffect(() => {
    if (taskId == null) return;
    if (checkFailed) {
      setTaskId(null);
      toast.error("La comprobación falló. Inténtalo de nuevo en un momento.");
    } else if (checkStatus && checkStatus !== "pending") {
      setTaskId(null);
      void queryClient.invalidateQueries({ queryKey: listKey(projectId) });
    }
  }, [taskId, checkStatus, checkFailed, queryClient, projectId]);

  const deleteMutation = useMutation({
    mutationFn: () =>
      deleteAmazonRankKeyword({ data: { projectId, keywordId: row.id } }),
    onSuccess: () => void refreshList(),
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "No se pudo borrar")),
  });

  const isChecking = startMutation.isPending || taskId != null;
  const market = AMAZON_MARKETPLACES.find((m) => m.code === row.marketplace);

  return (
    <tr>
      <td>
        <div className="font-medium">{row.keyword}</div>
        <div className="text-xs text-base-content/60">
          {market?.seDomain ?? row.marketplace}
        </div>
      </td>
      <td className="font-mono text-xs">
        <a
          href={`https://www.${market?.seDomain ?? "amazon.es"}/dp/${row.asin}`}
          target="_blank"
          rel="noopener noreferrer"
          className="link link-hover"
        >
          {row.asin}
        </a>
      </td>
      <td>
        <Position
          current={row.latest?.organicPosition ?? null}
          previous={row.previous?.organicPosition ?? null}
          checked={row.latest != null}
          scanned={row.latest?.organicResultsScanned ?? 0}
        />
      </td>
      <td>
        <Position
          current={row.latest?.sponsoredPosition ?? null}
          previous={row.previous?.sponsoredPosition ?? null}
          checked={row.latest != null}
          scanned={null}
        />
      </td>
      <td className="text-xs text-base-content/70">
        {row.latest ? formatDate(row.latest.checkedAt) : "Nunca"}
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
              if (window.confirm(`¿Dejar de seguir "${row.keyword}"? Se borra su historial.`)) {
                deleteMutation.mutate();
              }
            }}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </td>
    </tr>
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
