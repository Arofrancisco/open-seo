import { useState } from "react";
import { useForm } from "@tanstack/react-form";
import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getAgentSetupPrompt } from "@/client/features/ai-mcp/agentSetupPrompt";
import {
  AgentSetupPanel,
  AGENT_SETUP_DESCRIPTION,
} from "@/client/features/ai-mcp/AgentSetupPanel";
import { CopyButton } from "@/client/features/ai-mcp/SetupControls";
import { SearchConsoleConnectionCard } from "@/client/features/gsc/SearchConsoleConnectionCard";
import { CreateProjectModal } from "@/client/features/projects/CreateProjectModal";
import { ProjectMarketFields } from "@/client/features/projects/ProjectMarketFields";
import type { ProjectSummary } from "@/client/features/projects/types";
import { InviteTeammateModal } from "@/client/features/team/InviteTeammateModal";
import { organizationContextQueryOptions } from "@/client/features/team/organizationQueries";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { captureClientEvent } from "@/client/lib/posthog";
import { hasOrgPermission } from "@/lib/org-permissions";
import { getProjects, setProjectWebsite } from "@/serverFunctions/projects";
import { markDashboardCompetitorClicked } from "@/serverFunctions/dashboard";
import type { DashboardSetupStep } from "@/types/schemas/dashboard";
import { parseResearchTarget } from "@/shared/researchScope";

const projectPrompt = `Usa OpenSEO para configurar un proyecto separado para cada web de abajo. Lista primero mis proyectos existentes y reutiliza las coincidencias para no crear duplicados. Configura el país y el idioma de cada web, y pregúntame por cualquier dato que falte.

Sustituye esta lista por mis webs:
- Nombre del proyecto — web — país — idioma`;

export function DashboardSetupAction({
  step,
  projectId,
  onComplete,
}: {
  step: DashboardSetupStep;
  projectId: string;
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const org = useQuery(organizationContextQueryOptions());
  const projects = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
    enabled: step === "domain",
  });
  const project = projects.data?.find((item) => item.id === projectId);
  const competitor = useMutation({
    mutationFn: () => markDashboardCompetitorClicked({ data: { projectId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["dashboardActivation", projectId],
      });
      onComplete();
      void navigate({ to: "/p/$projectId/domain", params: { projectId } });
    },
    onError: (error) => toast.error(getStandardErrorMessage(error)),
  });
  if (step === "domain")
    return project ? (
      <WebsiteForm project={project} onComplete={onComplete} />
    ) : projects.isError ? (
      <p role="alert" className="text-sm text-error">
        {getStandardErrorMessage(projects.error)}
      </p>
    ) : (
      <div className="skeleton h-36" aria-busy />
    );
  if (step === "mcp")
    return (
      <div className="max-w-2xl space-y-4">
        <p className="text-sm leading-relaxed text-base-content/65">
          {AGENT_SETUP_DESCRIPTION}
        </p>
        <AgentSetupPanel
          prompt={getAgentSetupPrompt(
            typeof window === "undefined"
              ? "https://app.openseo.so"
              : window.location.origin,
          )}
          onCopy={() =>
            captureClientEvent("onboarding:setup_prompt_copy", {
              source: "dashboard",
            })
          }
        />
      </div>
    );
  if (step === "competitor")
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-base-content/65">
          Explora el dominio de un competidor para descubrir los temas por los
          que posiciona y las webs que le enlazan.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={competitor.isPending}
          onClick={() => competitor.mutate()}
        >
          Abrir búsqueda de dominio
        </button>
      </div>
    );

  const canManage =
    org.data &&
    hasOrgPermission(
      org.data.role,
      step === "project"
        ? { project: ["create"] }
        : step === "team"
          ? { invitation: ["create"] }
          : { integration: ["manage"] },
    );
  if (!canManage)
    return (
      <p className="text-sm text-base-content/65">
        {org.isPending
          ? "Comprobando permisos del espacio de trabajo…"
          : org.isError
            ? getStandardErrorMessage(org.error)
            : "Pide a un propietario o admin del espacio de trabajo que te ayude con este paso."}
      </p>
    );
  if (step === "gsc")
    return (
      <SearchConsoleConnectionCard
        projectId={projectId}
        returnTo={
          typeof window === "undefined"
            ? undefined
            : `${window.location.href.split("#")[0]}#connect-gsc`
        }
      />
    );
  if (step === "project")
    return (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-base-content/65">
          Mantén la investigación, el ranking y las conexiones de cada web en
          su propio proyecto. Usa el selector de proyecto en la barra lateral
          → Nuevo proyecto cuando quieras.
        </p>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setShowModal(true)}
        >
          Crear otro proyecto
        </button>
        <details className="rounded-lg border border-base-300 p-4">
          <summary className="cursor-pointer text-sm font-medium">
            ¿Tienes una lista de webs? Deja que tu agente las configure.
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-sm text-base-content/65">
              <Link to="/ai" className="link">
                Conecta tu agente
              </Link>
              , y luego pega este prompt con tu lista de webs.
            </p>
            <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-relaxed text-base-content/65">
              {projectPrompt}
            </pre>
            <CopyButton
              value={projectPrompt}
              label="Copiar prompt de proyecto"
              successMessage="Prompt de proyecto copiado"
            />
          </div>
        </details>
        {showModal && (
          <CreateProjectModal onClose={() => setShowModal(false)} />
        )}
      </div>
    );
  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-base-content/65">
        Trae a un compañero a tu espacio de trabajo para compartir proyectos,
        investigación y resultados.
      </p>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => setShowModal(true)}
      >
        Invitar a un compañero
      </button>
      {showModal && (
        <InviteTeammateModal
          onClose={() => setShowModal(false)}
          onInvited={() => {
            void queryClient.invalidateQueries({
              queryKey: ["organization-team"],
            });
            void queryClient.invalidateQueries({
              queryKey: ["dashboardActivation"],
            });
          }}
        />
      )}
    </div>
  );
}

function WebsiteForm({
  project,
  onComplete,
}: {
  project: ProjectSummary;
  onComplete: () => void;
}) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (value: {
      domain: string;
      locationCode: number;
      languageCode: string;
    }) => setProjectWebsite({ data: { projectId: project.id, ...value } }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({
          queryKey: ["dashboardActivation", project.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["dashboardOverview", project.id],
        }),
        queryClient.invalidateQueries({
          queryKey: ["projectAccess", project.id],
        }),
      ]);
      toast.success("Web guardada");
      onComplete();
    },
    onError: (error) =>
      toast.error(
        getStandardErrorMessage(
          error,
          "No hemos podido guardar tu web. Inténtalo de nuevo.",
        ),
      ),
  });
  const form = useForm({
    defaultValues: {
      domain: project.domain ?? "",
      market: {
        locationCode: project.locationCode,
        languageCode: project.languageCode,
      },
    },
    onSubmit: ({ value }) =>
      save.mutate({ domain: value.domain.trim(), ...value.market }),
  });
  return (
    <form
      className="max-w-lg space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <p className="text-sm leading-relaxed text-base-content/65">
        Añade la web de este proyecto y elige el país desde el que buscan tus
        clientes. Puedes cambiar esto cuando quieras en los ajustes del
        proyecto.
      </p>
      <form.Field
        name="domain"
        validators={{
          onChange: ({ value }) => {
            const parsed = parseResearchTarget(value);
            return parsed.ok ? undefined : parsed.message;
          },
        }}
      >
        {(field) => (
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">Web</span>
            <input
              type="text"
              required
              maxLength={255}
              placeholder="example.com"
              className="input input-bordered w-full"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
              aria-invalid={field.state.meta.errors.length > 0}
            />
            {field.state.meta.errors.length > 0 && (
              <span className="text-xs text-error">
                {field.state.meta.errors.join(", ")}
              </span>
            )}
          </label>
        )}
      </form.Field>
      <form.Field name="market">
        {(field) => (
          <ProjectMarketFields
            value={field.state.value}
            onChange={field.handleChange}
          />
        )}
      </form.Field>
      <form.Subscribe
        selector={(state) => [state.canSubmit, state.isSubmitting]}
      >
        {([canSubmit, isSubmitting]) => (
          <button
            type="submit"
            className="btn btn-primary btn-sm"
            disabled={!canSubmit || isSubmitting || save.isPending}
          >
            {save.isPending ? "Guardando…" : "Guardar web"}
          </button>
        )}
      </form.Subscribe>
    </form>
  );
}
