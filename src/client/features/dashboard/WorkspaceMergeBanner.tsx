import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import { isHostedClientAuthMode } from "@/lib/auth-mode";
import {
  getWorkspaceMergeStatus,
  mergeLegacyWorkspaces,
} from "@/serverFunctions/workspace";

// Shown on self-hosted Cloudflare Access deployments that still have per-user
// workspaces from before the shared workspace existed. The server decides
// visibility (AUTH_MODE is a runtime var there); hosted builds skip the query
// entirely since the mode is known at build time.
export function WorkspaceMergeBanner() {
  const queryClient = useQueryClient();

  const statusQuery = useQuery({
    queryKey: ["workspaceMergeStatus"],
    queryFn: () => getWorkspaceMergeStatus(),
    enabled: !isHostedClientAuthMode(),
  });

  const mergeMutation = useMutation({
    mutationFn: () => mergeLegacyWorkspaces(),
    onSuccess: ({ mergedWorkspaces }) => {
      toast.success(
        `Se ${mergedWorkspaces === 1 ? "ha" : "han"} migrado ${mergedWorkspaces} organización${mergedWorkspaces === 1 ? "" : "es"} a la organización compartida.`,
      );
      // The merge changes projects, connections, and the banner's own status —
      // refetch everything rather than enumerating keys.
      void queryClient.invalidateQueries();
    },
    onError: (error) =>
      toast.error(
        getStandardErrorMessage(
          error,
          "No hemos podido migrar las organizaciones. Inténtalo de nuevo.",
        ),
      ),
  });

  if (!statusQuery.data || statusQuery.data.legacyWorkspaceCount === 0) {
    return null;
  }

  return (
    <div className="rounded-xl border border-warning/40 bg-warning/10 p-5">
      <p className="max-w-3xl text-sm">
        Al autoalojar en Cloudflare hubo un fallo por el que cada usuario
        tenía su propio espacio de trabajo. La intención era que todos los
        usuarios estuvieran en uno solo. Al pulsar el botón de abajo migrarás
        el trabajo previo de todos a este espacio compartido.
      </p>
      <button
        type="button"
        className="btn btn-primary btn-sm mt-4"
        disabled={mergeMutation.isPending}
        onClick={() => mergeMutation.mutate()}
      >
        {mergeMutation.isPending ? "Migrando…" : "Migrar organizaciones"}
      </button>
    </div>
  );
}
