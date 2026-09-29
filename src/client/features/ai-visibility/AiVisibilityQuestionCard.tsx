import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, Trash2 } from "lucide-react";
import {
  removeAiVisibilityQuestion,
  type AiVisibilityBatchView,
  type AiVisibilityQuestionView,
} from "@/serverFunctions/aiVisibility";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  AUTUMN_SEO_DATA_CREDITS_PER_USD,
  SEO_DATA_COST_MARKUP,
} from "@/shared/billing";
import { getAmazonMarketplace } from "@/shared/amazon-marketplaces";

// DataForSEO ChatGPT LLM Scraper, priority queue (verified 29/09/2026). Only
// used for the estimate shown before launching.
const SCRAPER_TASK_COST_USD = 0.0024;
export function estimateCredits(answers: number) {
  return Math.ceil(
    answers *
      SCRAPER_TASK_COST_USD *
      SEO_DATA_COST_MARKUP *
      AUTUMN_SEO_DATA_CREDITS_PER_USD,
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

export function QuestionCard({
  projectId,
  question,
  runs,
  busy,
  onLaunch,
  onChanged,
}: {
  projectId: string;
  question: AiVisibilityQuestionView;
  runs: number;
  busy: boolean;
  onLaunch: () => void;
  onChanged: () => unknown;
}) {
  const remove = useMutation({
    mutationFn: () =>
      removeAiVisibilityQuestion({
        data: { projectId, questionId: question.id },
      }),
    onSuccess: () => void onChanged(),
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "No se pudo borrar")),
  });
  const latest = question.latest;
  const waiting = (latest?.pending ?? 0) > 0;

  return (
    <div className="space-y-3 rounded-xl border border-base-300 bg-base-100 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-medium">{question.question}</p>
          <p className="text-xs text-base-content/60">
            {getAmazonMarketplace(question.marketplace).label}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="btn btn-outline btn-sm"
            disabled={busy || waiting}
            onClick={onLaunch}
            title={`≈ ${estimateCredits(runs)} créditos`}
          >
            <Play className="size-4" />
            {latest ? "Repetir" : "Comprobar"}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            aria-label="Borrar pregunta"
            disabled={remove.isPending}
            onClick={() => {
              if (window.confirm("¿Borrar esta pregunta y todo su historial?")) {
                remove.mutate();
              }
            }}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {!latest ? (
        <p className="text-sm text-base-content/60">
          Aún no comprobada (≈ {estimateCredits(runs)} créditos).
        </p>
      ) : (
        <BatchResult batch={latest} history={question.history} />
      )}
    </div>
  );
}

function BatchResult({
  batch,
  history,
}: {
  batch: AiVisibilityBatchView;
  history: AiVisibilityQuestionView["history"];
}) {
  const answered = batch.total - batch.pending - batch.failed;

  if (batch.pending > 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-base-content/70">
        <span className="loading loading-spinner loading-xs" />
        Esperando a ChatGPT: {answered} de {batch.total} respuestas. Puedes
        cerrar la página; los resultados se guardan.
      </div>
    );
  }
  if (answered === 0) {
    return (
      <p className="text-sm text-error">
        No se pudo obtener ninguna respuesta. Vuelve a intentarlo.
      </p>
    );
  }

  const tone =
    batch.appeared === 0
      ? "text-error"
      : batch.appeared === answered
        ? "text-success"
        : "text-warning";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <p className={`text-2xl font-semibold ${tone}`}>
          {batch.appeared} de {answered}
          <span className="ml-2 text-sm font-normal text-base-content/70">
            respuestas te mencionan
          </span>
        </p>
        <p className="text-sm text-base-content/70">
          En las tarjetas de producto: {batch.inProducts} de {answered}
          {batch.bestProductPosition
            ? ` · mejor posición ${batch.bestProductPosition}`
            : ""}
        </p>
        <p className="text-xs text-base-content/50">
          {formatDate(batch.createdAt)}
        </p>
      </div>

      {batch.competitors.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-base-content/60">
            Quién aparece en tu lugar
          </p>
          <div className="flex flex-wrap gap-2">
            {batch.competitors.map((competitor) => (
              <span key={competitor.name} className="badge badge-outline gap-1">
                {competitor.name}
                <span className="text-base-content/50">
                  {competitor.answers}/{answered}
                </span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {batch.fanOutQueries.length > 0 ? (
        <div>
          <p className="mb-1 text-xs font-medium uppercase tracking-wide text-base-content/60">
            Lo que buscó ChatGPT para responder
          </p>
          <div className="flex flex-wrap gap-2">
            {batch.fanOutQueries.map((query) => (
              <span key={query} className="badge badge-ghost">
                {query}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {history.length > 0 ? (
        <p className="text-xs text-base-content/60">
          Anteriores:{" "}
          {history
            .map((point) => `${formatDate(point.createdAt)} ${point.appeared}/${point.total}`)
            .join(" · ")}
        </p>
      ) : null}
    </div>
  );
}
