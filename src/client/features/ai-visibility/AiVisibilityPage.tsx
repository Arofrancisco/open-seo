import { useEffect, useState, type FormEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertCircle, Info, Play, Radar } from "lucide-react";
import {
  addAiVisibilityQuestion,
  getAiVisibility,
  launchAiVisibility,
  saveAiVisibilityBrandTerms,
} from "@/serverFunctions/aiVisibility";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  AI_VISIBILITY_MARKETPLACES,
  MAX_BRAND_TERMS,
  toAiVisibilityMarketplace,
  type AiVisibilityMarketplace,
} from "@/shared/ai-visibility";
import { getAmazonMarketplace } from "@/shared/amazon-marketplaces";
import {
  estimateCredits,
  QuestionCard,
} from "@/client/features/ai-visibility/AiVisibilityQuestionCard";

type Props = { projectId: string };

const POLL_MS = 8000;

const overviewKey = (projectId: string) => ["aiVisibility", projectId];

export function AiVisibilityPage({ projectId }: Props) {
  const queryClient = useQueryClient();
  const overview = useQuery({
    queryKey: overviewKey(projectId),
    queryFn: () => getAiVisibility({ data: { projectId } }),
    refetchInterval: (query) =>
      query.state.data?.questions.some((q) => (q.latest?.pending ?? 0) > 0)
        ? POLL_MS
        : false,
  });
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: overviewKey(projectId) });

  const launch = useMutation({
    mutationFn: (questionIds: string[]) =>
      launchAiVisibility({ data: { projectId, questionIds } }),
    onSuccess: (result) => {
      if (result.problem) {
        toast.error(result.problem);
      } else if (result.stoppedEarly) {
        toast.warning(
          "No se pudieron lanzar todas las preguntas (¿sin créditos?). Las ya lanzadas se conservan.",
        );
      } else if (result.posted === 0) {
        toast.info("Esas preguntas ya se están comprobando.");
      }
      void refresh();
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "No se pudo lanzar la comprobación")),
  });

  const data = overview.data;
  const idle = data?.questions.filter((q) => (q.latest?.pending ?? 0) === 0) ?? [];
  const hasBrand = (data?.brandTerms.length ?? 0) > 0;

  return (
    <div className="px-4 py-4 pb-24 overflow-auto md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Radar className="size-6" />
            ¿Te recomienda la IA?
            <span className="badge badge-sm badge-outline">Beta</span>
          </h1>
          <p className="text-sm text-base-content/70">
            Hace a ChatGPT las preguntas que haría un comprador y comprueba si
            te menciona, en qué posición te enseña entre los productos y quién
            aparece en tu lugar.
          </p>
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-info/30 bg-info/10 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-info" />
          <div className="space-y-1">
            <p>
              <strong>Qué se mide:</strong> la respuesta real de ChatGPT con
              búsqueda web, tal como la ve un comprador, incluidas las tarjetas
              de producto. Cada pregunta se lanza {data?.runsPerQuestion ?? 3}{" "}
              veces porque ChatGPT no responde igual dos veces: el resultado es
              «en cuántas de esas respuestas apareces».
            </p>
            <p className="text-base-content/70">
              Rufus (Amazon) y Alexa+ no tienen datos públicos y no se pueden
              medir. Para ellos, lo que sí se puede hacer es preparar la ficha;
              consulta la guía «Amazon AI search readiness» en Agent setup.
            </p>
          </div>
        </div>

        {overview.isError ? (
          <ErrorAlert
            message={getStandardErrorMessage(overview.error, "No se pudo cargar")}
          />
        ) : null}

        {data ? (
          <>
            <BrandCard
              projectId={projectId}
              terms={data.brandTerms}
              onSaved={refresh}
            />
            {!hasBrand ? (
              <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm">
                Primero escribe el nombre de tu marca y pulsa <strong>Guardar</strong>.
                Sin él no podemos saber si ChatGPT te menciona.
              </p>
            ) : null}
            <QuestionForm projectId={projectId} onAdded={refresh} />
            <p className="text-xs text-base-content/60">
              <strong>¿Cuántas preguntas?</strong> Empieza con 5 a 8, cada una distinta:
              la búsqueda genérica («zapatillas de running»), una con la necesidad
              («para correr en asfalto»), una con un atributo («de calidad»,
              «envío rápido») y una comparativa. Cada pregunta cuesta unos{" "}
              {estimateCredits(data.runsPerQuestion)} créditos por comprobación; con 8
              preguntas, unos {estimateCredits(8 * data.runsPerQuestion)} créditos.
              Máximo {data.maxQuestions}.
            </p>

            {data.questions.length > 0 ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-base-content/70">
                  {data.questions.length} de {data.maxQuestions} preguntas
                </span>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={launch.isPending || idle.length === 0 || !hasBrand}
                  onClick={() => launch.mutate(idle.map((q) => q.id))}
                >
                  <Play className="size-4" />
                  Comprobar todas (≈{" "}
                  {estimateCredits(idle.length * data.runsPerQuestion)} créditos)
                </button>
              </div>
            ) : (
              <p className="rounded-xl border border-dashed border-base-300 p-6 text-center text-sm text-base-content/70">
                Añade una pregunta de comprador, por ejemplo «¿qué zapatillas
                de running me recomiendas?», y comprueba si ChatGPT te nombra.
              </p>
            )}

            {data.questions.map((question) => (
              <QuestionCard
                key={question.id}
                projectId={projectId}
                question={question}
                runs={data.runsPerQuestion}
                busy={launch.isPending || !hasBrand}
                onLaunch={() => launch.mutate([question.id])}
                onChanged={refresh}
              />
            ))}
          </>
        ) : overview.isLoading ? (
          <LoadingCard text="Cargando…" />
        ) : null}
      </div>
    </div>
  );
}

function BrandCard({
  projectId,
  terms,
  onSaved,
}: {
  projectId: string;
  terms: string[];
  onSaved: () => unknown;
}) {
  const [value, setValue] = useState(terms.join(", "));
  useEffect(() => setValue(terms.join(", ")), [terms]);

  const save = useMutation({
    mutationFn: (list: string[]) =>
      saveAiVisibilityBrandTerms({ data: { projectId, terms: list } }),
    onSuccess: () => {
      toast.success("Marca guardada");
      void onSaved();
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "No se pudo guardar")),
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const list = value
      .split(",")
      .map((term) => term.trim())
      .filter(Boolean);
    if (list.length === 0) {
      toast.error("Escribe al menos el nombre de tu marca");
      return;
    }
    save.mutate(list);
  };

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label className="label" htmlFor="ai-visibility-brand">
          <span className="label-text">
            Tu marca (nombres o dominio, separados por comas; máx.{" "}
            {MAX_BRAND_TERMS})
          </span>
        </label>
        <input
          id="ai-visibility-brand"
          className="input input-bordered w-full"
          placeholder="Tu marca, tumarca.es"
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <button type="submit" className="btn btn-outline" disabled={save.isPending}>
        Guardar
      </button>
    </form>
  );
}

function QuestionForm({
  projectId,
  onAdded,
}: {
  projectId: string;
  onAdded: () => unknown;
}) {
  const [question, setQuestion] = useState("");
  const [marketplace, setMarketplace] = useState<AiVisibilityMarketplace>("ES");
  const add = useMutation({
    mutationFn: () =>
      addAiVisibilityQuestion({ data: { projectId, question, marketplace } }),
    onSuccess: (result) => {
      if (result.problem) {
        toast.error(result.problem);
        return;
      }
      setQuestion("");
      void onAdded();
    },
    onError: (error) =>
      toast.error(getStandardErrorMessage(error, "No se pudo añadir la pregunta")),
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        add.mutate();
      }}
      className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4 sm:flex-row sm:items-end"
    >
      <div className="flex-1">
        <label className="label" htmlFor="ai-visibility-question">
          <span className="label-text">Pregunta de comprador</span>
        </label>
        <input
          id="ai-visibility-question"
          className="input input-bordered w-full"
          placeholder="¿Qué zapatillas de running de calidad me recomiendas?"
          maxLength={300}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
        />
      </div>
      <div>
        <label className="label" htmlFor="ai-visibility-country">
          <span className="label-text">País</span>
        </label>
        <select
          id="ai-visibility-country"
          className="select select-bordered"
          value={marketplace}
          onChange={(event) => setMarketplace(toAiVisibilityMarketplace(event.target.value))}
        >
          {AI_VISIBILITY_MARKETPLACES.map((code) => (
            <option key={code} value={code}>
              {getAmazonMarketplace(code).label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        className="btn btn-primary"
        disabled={add.isPending || question.trim().length < 5}
      >
        Añadir
      </button>
    </form>
  );
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
