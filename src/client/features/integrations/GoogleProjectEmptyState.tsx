import type { ReactNode } from "react";
import { GoogleGlyph } from "@/client/features/gsc/GoogleGlyph";

export function GoogleProjectEmptyState({
  name,
  hasGrant,
  disabled,
  canManage,
  onChoose,
  onLink,
  children,
}: {
  name: string;
  hasGrant: boolean;
  disabled: boolean;
  canManage: boolean;
  onChoose: () => void;
  onLink: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-base-content/70">
        {hasGrant
          ? `Elige una propiedad de ${name} para terminar de conectar este proyecto.`
          : `Conecta ${name} para ver los datos de este proyecto.`}
      </p>
      <div className="flex flex-wrap items-center gap-1">
        {canManage || hasGrant ? (
          <button
            type="button"
            onClick={hasGrant ? onChoose : onLink}
            disabled={disabled}
            aria-busy={disabled}
            className="inline-flex items-center gap-2.5 rounded-lg border border-base-300 bg-base-100 px-4 py-2.5 text-sm font-semibold shadow-sm transition hover:bg-base-200 disabled:opacity-50"
          >
            {disabled ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              !hasGrant && <GoogleGlyph className="size-[18px]" />
            )}
            {disabled
              ? "Abriendo Google…"
              : canManage
                ? hasGrant
                  ? "Elegir propiedad"
                  : "Conectar"
                : "Gestionar cuentas de Google"}
          </button>
        ) : null}
        {children}
      </div>
    </div>
  );
}
