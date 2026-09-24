import { Bot, FolderPlus, Globe, Search, Users } from "lucide-react";
import type { DashboardActivation } from "@/server/features/dashboard/services/DashboardService";
import type { DashboardSetupStep } from "@/types/schemas/dashboard";

export const setupSteps: {
  id: DashboardSetupStep;
  label: string;
  detail: string;
  icon: typeof Globe;
}[] = [
  {
    id: "domain",
    label: "Añade tu web",
    detail: "Configura la web y el país de este proyecto.",
    icon: Globe,
  },
  {
    id: "project",
    label: "¿Trabajas con varias webs?",
    detail:
      "Crea otro proyecto, o deja que tu agente de IA configure una lista de sitios.",
    icon: FolderPlus,
  },
  {
    id: "competitor",
    label: "Explora a un competidor",
    detail: "Encuentra temas y enlaces de los que aprender.",
    icon: Search,
  },
  {
    id: "mcp",
    label: "Conecta tu agente de IA",
    detail: "Usa PlanetaSEO desde Claude o tu agente favorito.",
    icon: Bot,
  },
  {
    id: "gsc",
    label: "Conecta Search Console",
    detail: "Trae tus clics y búsquedas reales a la vista.",
    icon: Search,
  },
  {
    id: "team",
    label: "Invita a un compañero",
    detail: "Comparte el trabajo, o sigue en solitario por ahora.",
    icon: Users,
  },
];

export function getStepStatus(
  activation: DashboardActivation,
  step: DashboardSetupStep,
): "done" | "skipped" | "todo" {
  const completed: Record<DashboardSetupStep, boolean> = {
    domain: activation.domain !== null,
    project: activation.hasMultipleProjects,
    competitor: activation.competitorClickedAt !== null,
    mcp:
      activation.mcp.authorizedAt !== null ||
      activation.mcp.firstToolCallAt !== null,
    gsc: activation.gsc.connected,
    team: activation.hasTeammate,
  };
  if (completed[step]) return "done";
  // Preserve previous MCP dismissals without treating them as authorization.
  if (
    activation.dismissedSteps.includes(step) ||
    (step === "mcp" && activation.mcp.cardDismissedAt !== null)
  )
    return "skipped";
  return "todo";
}
