import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowUpRight, ShieldAlert } from "lucide-react";
import { getAuthMode } from "@/lib/auth-mode";
import { captureClientEvent } from "@/client/lib/posthog";
import {
  agentUpdatePrompt,
  getAgentSetupPrompt,
} from "@/client/features/ai-mcp/agentSetupPrompt";
import { CopyButton } from "@/client/features/ai-mcp/SetupControls";
import { AgentList } from "@/client/features/ai-mcp/AgentList";

const DOCS_URL = "https://openseo.so/docs/agent-setup";
const COACH_DOCS_URL = "https://openseo.so/docs/skills/seo-coach";
// Type 1 skills call OpenSEO's MCP tools for live project data; type 2 skills
// are methodology only (no tool calls), so they also work as a downloadable
// guide. Our own skills have no page on the upstream docs site, so they link
// to their source file on the fork instead.
type SkillEntry = {
  name: string;
  blurb: string;
  type: 1 | 2;
  href?: string;
};

const FORK_SKILLS_URL =
  "https://github.com/Arofrancisco/open-seo/blob/main/.agents/skills";

const SKILLS: SkillEntry[] = [
  {
    name: "seo-coach",
    blurb: "Te dice dónde estás y cuál es tu siguiente paso.",
    type: 1,
  },
  {
    name: "seo-project-setup",
    blurb:
      "Guarda tus objetivos, competidores y páginas clave como contexto compartido.",
    type: 1,
  },
  {
    name: "seo-audit",
    blurb: "Auditoría de una página centrada en una sola acción para esta semana.",
    type: 1,
  },
  {
    name: "keyword-research",
    blurb: "Encuentra oportunidades de keywords a partir de unos pocos temas.",
    type: 1,
  },
  {
    name: "keyword-clustering",
    blurb: "Agrupa keywords por intención y las asigna a páginas.",
    type: 1,
  },
  {
    name: "competitive-landscape",
    blurb: "Muestra quién gana en tu mercado y por qué.",
    type: 1,
  },
  {
    name: "competitor-analysis",
    blurb: "Estudia las keywords, el contenido y los backlinks de un competidor.",
    type: 1,
  },
  {
    name: "link-prospecting",
    blurb: "Encuentra dónde conseguir enlaces y redacta el contacto.",
    type: 1,
  },
  {
    name: "local-seo",
    blurb: "Audita un perfil de Google Business y la visibilidad en Maps.",
    type: 1,
  },
  {
    name: "seo-report",
    blurb: "Guarda cualquiera de las anteriores como informe en tu página de Informes.",
    type: 1,
  },
  {
    name: "amazon-ai-search-readiness",
    blurb:
      "Revisa una ficha de Amazon para que Rufus y Alexa la entiendan y la recomienden.",
    type: 2,
    href: `${FORK_SKILLS_URL}/amazon-ai-search-readiness/SKILL.md`,
  },
];

const SKILL_TYPES = [
  {
    type: 1,
    title: "Tipo 1 · Con datos en vivo",
    description:
      "Tu agente consulta datos reales de tu proyecto en OpenSEO (keywords, backlinks, auditorías…) y te entrega un informe con cifras. Necesitan el agente conectado por MCP y gastan créditos cuando piden datos.",
  },
  {
    type: 2,
    title: "Tipo 2 · De conocimiento",
    description:
      "Metodología y checklists de experto: tu agente sigue los pasos con su propio razonamiento. No necesitan conexión MCP ni gastan créditos, y puedes abrirlas y descargarlas para usarlas como guía.",
  },
] as const;

export const Route = createFileRoute("/_app/ai")({
  component: AiPage,
});

function AiPage() {
  const origin =
    typeof window === "undefined"
      ? "https://app.openseo.so"
      : window.location.origin;
  const mcpUrl = `${origin}/mcp`;
  const prompt = getAgentSetupPrompt(origin);
  const [tab, setTab] = useState<"setup" | "skills">("setup");

  return (
    <div className="h-full overflow-auto bg-base-100 px-4 py-12 md:px-6 md:py-16 pb-24 md:pb-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Agent setup</h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-base-content/70">
          The most powerful way to use OpenSEO is through the AI agent you
          already use. Set it up once, then ask it anything.
        </p>

        <div role="tablist" className="tabs tabs-border mt-8 w-fit">
          {(
            [
              ["setup", "Set up your agent"],
              ["skills", "Skills"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`tab ${tab === id ? "tab-active" : ""}`}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "setup" ? (
          <>
            <div className="mt-6 space-y-5">
              <section className="rounded-xl border border-base-300 p-5 sm:p-6">
                <h2 className="text-base font-semibold">Set up your agent</h2>
                <p className="mt-2 text-sm leading-relaxed text-base-content/60">
                  Paste the setup prompt into your agent to connect OpenSEO and
                  install its SEO skills. It will guide you through any manual
                  steps.
                </p>
                <AgentList />
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 [&>button]:h-11 [&>button]:gap-2 [&>button]:text-sm">
                  <CopyButton
                    primary
                    value={prompt}
                    label="Copy setup prompt"
                    successMessage="Setup prompt copied"
                    onCopy={() => captureClientEvent("mcp:setup_prompt_copy")}
                  />
                  <a
                    href={`${DOCS_URL}#set-up-your-agent`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-base-content/60 underline decoration-base-content/25 underline-offset-4 hover:text-base-content"
                  >
                    Setup instructions
                    <ArrowUpRight className="size-3.5" />
                  </a>
                </div>
                <p className="mt-5 border-t border-base-300 pt-4 text-sm leading-relaxed text-base-content/60">
                  Once connected, ask your agent to use{" "}
                  <a
                    href={COACH_DOCS_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-base-content underline decoration-base-content/25 underline-offset-4 hover:decoration-base-content"
                  >
                    SEO Coach
                  </a>{" "}
                  to help you choose what to do next.
                </p>
              </section>

              <section className="rounded-xl border border-base-300 p-5 sm:p-6">
                <h2 className="text-base font-semibold">Update your skills</h2>
                <p className="mt-2 text-sm leading-relaxed text-base-content/60">
                  Already connected? Paste the update prompt into your agent to
                  get the latest OpenSEO skills while preserving your connection
                  settings and personal edits.
                </p>
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3 [&>button]:h-11 [&>button]:gap-2 [&>button]:text-sm">
                  <CopyButton
                    primary
                    value={agentUpdatePrompt}
                    label="Copy update prompt"
                    successMessage="Update prompt copied"
                    onCopy={() => captureClientEvent("mcp:update_prompt_copy")}
                  />
                  <a
                    href={`${DOCS_URL}#update-your-skills`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-base-content/60 underline decoration-base-content/25 underline-offset-4 hover:text-base-content"
                  >
                    Update instructions
                    <ArrowUpRight className="size-3.5" />
                  </a>
                </div>
              </section>
            </div>

            {getAuthMode(import.meta.env.AUTH_MODE) === "cloudflare_access" ? (
              <div className="alert alert-warning mt-8 text-sm" role="alert">
                <ShieldAlert className="size-4 shrink-0" />
                <span>
                  This instance is behind Cloudflare Access. MCP clients cannot
                  connect until Managed OAuth is enabled on your Access
                  application.{" "}
                  <a
                    href="https://openseo.so/docs/self-hosting/cloudflare#connect-the-mcp-server-through-cloudflare-access"
                    target="_blank"
                    rel="noreferrer"
                    className="link font-medium"
                  >
                    Setup guide
                  </a>
                </span>
              </div>
            ) : null}

            <div className="mt-10 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-base-300 pt-5 text-xs text-base-content/55">
              <span>
                MCP server URL for this instance:{" "}
                <code className="font-mono text-base-content/80">{mcpUrl}</code>
              </span>
              <CopyButton
                value={mcpUrl}
                successMessage="MCP URL copied"
                onCopy={() => captureClientEvent("mcp:setup_url_copy")}
              />
            </div>
          </>
        ) : (
          <section className="mt-6">
            <p className="text-sm text-base-content/60">
              Una skill es una receta de instrucciones que sigue tu agente de IA
              (Claude, ChatGPT…). Escribe su nombre, por ejemplo /seo-audit,
              cuando quieras un informe completo en vez de una respuesta
              rápida. Hay dos tipos:
            </p>
            {SKILL_TYPES.map((group) => {
              const skills = SKILLS.filter((skill) => skill.type === group.type);
              if (skills.length === 0) return null;
              return (
                <div key={group.type} className="mt-6">
                  <h3 className="text-sm font-semibold">{group.title}</h3>
                  <p className="mt-1 text-sm text-base-content/60">
                    {group.description}
                  </p>
                  <ul className="mt-3 space-y-3 text-sm sm:space-y-2">
                    {skills.map((skill) => (
                      <li
                        key={skill.name}
                        className="flex flex-col gap-0.5 sm:flex-row sm:gap-3"
                      >
                        <a
                          href={
                            skill.href ??
                            `https://openseo.so/docs/skills/${skill.name}`
                          }
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 font-mono text-[13px] text-base-content underline decoration-base-content/25 underline-offset-4 hover:decoration-base-content sm:w-56"
                        >
                          /{skill.name}
                        </a>
                        <span className="text-base-content/60">
                          {skill.blurb}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>
        )}
      </div>
    </div>
  );
}
