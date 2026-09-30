import type { FormEvent } from "react";
import { Search } from "lucide-react";
import { isHostedClientAuthMode } from "@/lib/auth-mode";
import {
  BRAND_LOOKUP_COMPETITOR_DISPLAYED_COST_USD,
  BRAND_LOOKUP_DISPLAYED_COST_USD,
  estimatedCredits,
} from "@/client/features/ai-search/brandLookupCost";
import { formatCredits } from "@/shared/plan-credits";
import { ResearchScopeSelect } from "@/client/components/ResearchScopeSelect";
import type { ResearchScope } from "@/shared/researchScope";
import { BRAND_LOOKUP_MAX_INPUT_LENGTH } from "@/types/schemas/ai-search";

type Props = {
  query: string;
  onQueryChange: (next: string) => void;
  scope: ResearchScope;
  onScopeChange: (next: ResearchScope) => void;
  scopeDisabledReason: string | undefined;
  competitors: string;
  onCompetitorsChange: (next: string) => void;
  onSubmit: (event: FormEvent) => void;
  isLoading: boolean;
  validationError: { field: "query" | "competitors"; message: string } | null;
};

export function BrandLookupSearchCard({
  query,
  onQueryChange,
  scope,
  onScopeChange,
  scopeDisabledReason,
  competitors,
  onCompetitorsChange,
  onSubmit,
  isLoading,
  validationError,
}: Props) {
  const hasCompetitors = competitors.trim().length > 0;
  const isHosted = isHostedClientAuthMode();
  const queryError = validationError?.field === "query";
  const competitorsError = validationError?.field === "competitors";

  return (
    <div className="card border border-base-300 bg-base-100">
      <div className="card-body gap-4">
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <label
              className={`input input-bordered flex flex-1 items-center gap-2 ${
                queryError ? "input-error" : ""
              }`}
            >
              <Search className="size-4 text-base-content/60" />
              <input
                type="text"
                placeholder="Escribe una marca o un dominio"
                value={query}
                maxLength={BRAND_LOOKUP_MAX_INPUT_LENGTH}
                onChange={(event) => onQueryChange(event.target.value)}
                aria-invalid={queryError || undefined}
                aria-describedby={
                  queryError ? "brand-lookup-input-error" : undefined
                }
                autoComplete="off"
                spellCheck={false}
                className="grow"
              />
            </label>

            <ResearchScopeSelect
              value={scope}
              onChange={onScopeChange}
              disabledReason={scopeDisabledReason}
            />

            <button
              type="submit"
              className="btn btn-primary shrink-0 px-6"
              disabled={isLoading}
            >
              {isLoading ? "Buscando…" : "Buscar"}
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <input
              type="text"
              placeholder="Añade competidores (separados por comas)"
              value={competitors}
              onChange={(event) => onCompetitorsChange(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              className={`input input-bordered w-full ${
                competitorsError ? "input-error" : ""
              }`}
              aria-label="Competidores"
              aria-invalid={competitorsError || undefined}
              aria-describedby={
                competitorsError ? "brand-lookup-input-error" : undefined
              }
            />
            <p className="text-xs text-base-content/60">
              Añade hasta 5 marcas o dominios competidores para ver tu cuota de
              voz: qué parte de las menciones en IA es tuya y cuál de ellos.
            </p>
          </div>
        </form>

        {validationError ? (
          <p id="brand-lookup-input-error" className="text-sm text-error">
            {validationError.message}
          </p>
        ) : null}

        <div className="space-y-2 text-xs text-base-content/70">
          <p className="tabular-nums">
            <span className="font-semibold text-base-content/80">Coste por búsqueda:</span>{" "}
            {isHosted ? (
              <>
                unos{" "}
                <span className="font-medium text-base-content/90">
                  {formatCredits(estimatedCredits(BRAND_LOOKUP_DISPLAYED_COST_USD))}{" "}
                  créditos
                </span>
                {hasCompetitors ? (
                  <span>
                    , más unos{" "}
                    {formatCredits(
                      estimatedCredits(BRAND_LOOKUP_COMPETITOR_DISPLAYED_COST_USD),
                    )}{" "}
                    por comparar con competidores
                  </span>
                ) : null}
                . Es la función que más créditos consume de la herramienta.
              </>
            ) : (
              <>
                aprox. ${BRAND_LOOKUP_DISPLAYED_COST_USD.toFixed(2)}
                {hasCompetitors
                  ? ` más ~$${BRAND_LOOKUP_COMPETITOR_DISPLAYED_COST_USD.toFixed(2)} por comparar con competidores`
                  : ""}
                , facturados por DataForSEO.
              </>
            )}
          </p>
          <ul className="list-disc space-y-1 pl-4 text-base-content/60">
            <li>
              No lanza preguntas nuevas: consulta las menciones que ya constan
              en respuestas de ChatGPT y en los resúmenes con IA de Google.
            </li>
            <li>
              Los datos son de <strong>Estados Unidos y en inglés</strong>, que
              es lo que ofrece hoy el proveedor para ChatGPT. Sirve sobre todo a
              marcas y webs con presencia internacional.
            </li>
            <li>
              Si vendes en Amazon España y quieres saber si ChatGPT recomienda tus
              productos, usa <strong>¿Te recomienda la IA?</strong>: cuesta unos
              10 créditos por pregunta.
            </li>
            <li>
              Prueba primero con tu dominio completo. Usa Subcarpeta para medir
              solo una sección, como ejemplo.com/blog.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
