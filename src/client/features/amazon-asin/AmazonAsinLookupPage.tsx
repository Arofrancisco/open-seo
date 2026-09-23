import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, PackageSearch } from "lucide-react";
import { startAmazonAsinLookup } from "@/serverFunctions/amazonAsin";
import { useAmazonAsinLookupPolling } from "@/client/features/amazon-asin/useAmazonAsinLookupPolling";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import type { AmazonAsinResult } from "@/server/lib/dataforseo";
import {
  AMAZON_MARKETPLACES,
  DEFAULT_AMAZON_MARKETPLACE_CODE,
  type AmazonMarketplaceCode,
} from "@/shared/amazon-marketplaces";

type Props = { projectId: string };

const ASIN_RE = /^[A-Z0-9]{10}$/;

export function AmazonAsinLookupPage({ projectId }: Props) {
  const [asin, setAsin] = useState("");
  const [marketplace, setMarketplace] = useState<AmazonMarketplaceCode>(
    DEFAULT_AMAZON_MARKETPLACE_CODE,
  );
  const [taskId, setTaskId] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: (input: { asin: string; marketplace: AmazonMarketplaceCode }) =>
      startAmazonAsinLookup({
        data: { projectId, asin: input.asin, marketplace: input.marketplace },
      }),
    onSuccess: (result) => setTaskId(result.taskId),
  });

  const lookupQuery = useAmazonAsinLookupPolling(projectId, taskId);
  const outcome = lookupQuery.data;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = asin.trim().toUpperCase();
    if (!ASIN_RE.test(trimmed)) {
      setValidationError(
        "Introduce un ASIN válido de 10 caracteres (ej. B08N5WRWNW)",
      );
      return;
    }
    setValidationError(null);
    setAsin(trimmed);
    setTaskId(null);
    startMutation.mutate({ asin: trimmed, marketplace });
  };

  const isBusy =
    startMutation.isPending ||
    (taskId != null && (outcome === undefined || outcome.status === "pending"));

  const errorMessage = startMutation.isError
    ? getStandardErrorMessage(
        startMutation.error,
        "No se pudo iniciar la búsqueda",
      )
    : lookupQuery.isError
      ? getStandardErrorMessage(
          lookupQuery.error,
          "No se pudo consultar el resultado",
        )
      : null;

  return (
    <div className="px-4 py-4 pb-24 overflow-auto md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <PackageSearch className="size-6" />
            Buscar por ASIN
          </h1>
          <p className="text-sm text-base-content/70">
            Consulta precio, valoración, stock y marca de un producto de
            Amazon a partir de su ASIN.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 rounded-xl border border-base-300 bg-base-100 p-4 sm:flex-row sm:items-end"
        >
          <div className="flex-1">
            <label className="label" htmlFor="asin-input">
              <span className="label-text">ASIN</span>
            </label>
            <input
              id="asin-input"
              type="text"
              className={`input input-bordered w-full ${
                validationError ? "input-error" : ""
              }`}
              placeholder="B08N5WRWNW"
              value={asin}
              maxLength={10}
              onChange={(event) => {
                setAsin(event.target.value);
                if (validationError) setValidationError(null);
              }}
            />
            {validationError ? (
              <span className="mt-1 block text-xs text-error">
                {validationError}
              </span>
            ) : null}
          </div>

          <div>
            <label className="label" htmlFor="marketplace-select">
              <span className="label-text">Marketplace</span>
            </label>
            <select
              id="marketplace-select"
              className="select select-bordered"
              value={marketplace}
              onChange={(event) =>
                setMarketplace(event.target.value as AmazonMarketplaceCode)
              }
            >
              {AMAZON_MARKETPLACES.map((market) => (
                <option key={market.code} value={market.code}>
                  {market.label}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="btn btn-primary" disabled={isBusy}>
            {isBusy ? "Buscando…" : "Buscar"}
          </button>
        </form>

        {errorMessage ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        ) : null}

        {isBusy && !errorMessage ? (
          <div className="rounded-xl border border-base-300 bg-base-100 p-6 text-center text-sm text-base-content/70">
            Consultando Amazon… puede tardar hasta medio minuto.
          </div>
        ) : null}

        {outcome?.status === "not_found" ? (
          <div className="rounded-xl border border-base-300 bg-base-100 p-6 text-center text-sm text-base-content/70">
            No se encontró ningún producto con ese ASIN en este marketplace.
          </div>
        ) : null}

        {outcome?.status === "completed" ? (
          <AmazonAsinResultCard result={outcome.result} />
        ) : null}
      </div>
    </div>
  );
}

function AmazonAsinResultCard({ result }: { result: AmazonAsinResult }) {
  const priceLabel =
    result.priceFrom != null
      ? result.priceTo != null && result.priceTo !== result.priceFrom
        ? `${result.priceFrom} – ${result.priceTo} ${result.currency ?? ""}`
        : `${result.priceFrom} ${result.currency ?? ""}`
      : "No disponible";

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-base-300 bg-base-100 p-4 sm:flex-row">
      {result.imageUrl ? (
        <img
          src={result.imageUrl}
          alt={result.title ?? result.asin ?? "Producto de Amazon"}
          className="h-32 w-32 shrink-0 self-center rounded-lg object-contain sm:self-start"
        />
      ) : null}

      <div className="flex-1 space-y-2">
        <h2 className="font-medium">{result.title ?? "Sin título"}</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          <dt className="text-base-content/70">ASIN</dt>
          <dd>{result.asin ?? "—"}</dd>

          <dt className="text-base-content/70">Precio</dt>
          <dd>{priceLabel}</dd>

          {result.percentageDiscount ? (
            <>
              <dt className="text-base-content/70">Descuento</dt>
              <dd>{result.percentageDiscount}%</dd>
            </>
          ) : null}

          <dt className="text-base-content/70">Valoración</dt>
          <dd>
            {result.rating?.value != null
              ? `${result.rating.value} / ${result.rating.ratingMax ?? 5} (${result.rating.votesCount ?? 0} valoraciones)`
              : "—"}
          </dd>

          <dt className="text-base-content/70">Stock</dt>
          <dd>
            {result.isAvailable == null
              ? "—"
              : result.isAvailable
                ? "Disponible"
                : "No disponible"}
          </dd>

          <dt className="text-base-content/70">Marca</dt>
          <dd>{result.brand ?? "—"}</dd>

          {result.bestSellersRank ? (
            <>
              <dt className="text-base-content/70">BSR</dt>
              <dd>{result.bestSellersRank}</dd>
            </>
          ) : null}
        </dl>
      </div>
    </div>
  );
}
