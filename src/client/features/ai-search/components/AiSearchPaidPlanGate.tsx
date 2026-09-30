import { Link } from "@tanstack/react-router";
import { Sparkles, type LucideIcon } from "lucide-react";
import { SUBSCRIBE_ROUTE } from "@/shared/billing";

type Props = {
  feature: string;
  description: string;
  bullets: Array<{ icon: LucideIcon; title: string; body: string }>;
  /** Optional highlighted note, e.g. what the feature costs in credits. */
  costNote?: string;
};

export function AiSearchPaidPlanGate({
  feature,
  description,
  bullets,
  costNote,
}: Props) {
  return (
    <div className="mx-auto max-w-3xl overflow-hidden rounded-xl border border-base-300 bg-base-100 shadow-sm">
      <div className="flex flex-col gap-5 px-6 py-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-xl space-y-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
            <Sparkles className="size-3.5" />
            Plan de pago
          </span>
          <h2 className="text-xl font-semibold tracking-tight">
            Desbloquea {feature}
          </h2>
          <p className="text-sm text-base-content/70">{description}</p>
          {costNote ? (
            <p className="rounded-lg border border-warning/40 bg-warning/10 p-3 text-sm text-base-content/80">
              {costNote}
            </p>
          ) : null}
        </div>
        <Link
          to={SUBSCRIBE_ROUTE}
          search={{ upgrade: true }}
          className="btn btn-primary shrink-0"
        >
          Pasar al plan de pago
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-5 border-t border-base-300 px-6 py-6 sm:grid-cols-3">
        {bullets.map(({ icon: Icon, title, body }) => (
          <div key={title} className="space-y-2">
            <div className="inline-flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4" />
            </div>
            <h3 className="text-sm font-semibold">{title}</h3>
            <p className="text-xs leading-relaxed text-base-content/65">
              {body}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
