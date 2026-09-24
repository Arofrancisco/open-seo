import { useEffect, useId, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import {
  getGoogleAccountRemovalImpact,
  removeGoogleAccount,
} from "@/serverFunctions/googleAccounts";

export function GoogleAccountRemovalDialog({
  provider,
  accountId,
  label,
  onClose,
  onRemoved,
}: {
  provider: "gsc" | "ga4";
  accountId: string;
  label: string;
  onClose: () => void;
  onRemoved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const queryClient = useQueryClient();
  const impact = useQuery({
    queryKey: ["googleAccountRemovalImpact", provider, accountId],
    queryFn: () =>
      getGoogleAccountRemovalImpact({ data: { provider, accountId } }),
    staleTime: 0,
    gcTime: 0,
  });
  const removal = useMutation({
    mutationFn: () =>
      removeGoogleAccount({ data: { provider, accountId, confirmed: true } }),
    onSuccess: async () => {
      const keys =
        provider === "gsc"
          ? [
              "gscConnection",
              "gscSites",
              "gscGrantStatus",
              "searchPerformance",
              "searchPerformanceTable",
              "dashboardGscReport",
              "dashboardActivation",
            ]
          : [
              "ga4Connection",
              "ga4Properties",
              "dashboardGa4Report",
              "dashboardActivation",
            ];
      await Promise.all(
        keys.map((key) => queryClient.invalidateQueries({ queryKey: [key] })),
      );
      onRemoved();
    },
  });
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);
  const name = provider === "gsc" ? "Search Console" : "Google Analytics";
  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      className="modal"
      onCancel={(event) => {
        event.preventDefault();
        if (!removal.isPending) onClose();
      }}
    >
      <div className="modal-box max-w-md space-y-4">
        <h3 id={titleId} className="text-lg font-semibold">
          ¿Quitar cuenta de Google?
        </h3>
        <p className="break-all text-sm font-medium">{label}</p>
        <p className="text-sm text-base-content/70">
          Esto elimina la conexión de {name} de esta cuenta en PlanetaSEO. Puedes
          reconectarla cuando quieras.
        </p>
        {impact.isPending ? (
          <p role="status" className="text-sm text-base-content/60">
            Comprobando proyectos conectados…
          </p>
        ) : impact.isError ? (
          <div role="alert" className="text-sm">
            <p className="text-error">No hemos podido comprobar los proyectos conectados.</p>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => void impact.refetch()}
            >
              Reintentar
            </button>
          </div>
        ) : impact.data.projectCount > 0 ? (
          <p className="text-sm font-medium">
            Esto también desconectará {name} de {impact.data.projectCount}{" "}
            proyecto{impact.data.projectCount === 1 ? "" : "s"}.
          </p>
        ) : (
          <p className="text-sm text-base-content/60">
            No se verá afectado ningún proyecto.
          </p>
        )}
        {removal.isError ? (
          <p role="alert" className="text-sm text-error">
            {getStandardErrorMessage(removal.error)}
          </p>
        ) : null}
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled={removal.isPending}
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-error btn-sm"
            disabled={
              !impact.isSuccess || impact.isFetching || removal.isPending
            }
            onClick={() => removal.mutate()}
          >
            {removal.isPending ? "Quitando…" : "Quitar cuenta"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
