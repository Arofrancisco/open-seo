import { useState, type FormEvent } from "react";
import { useMutation } from "@tanstack/react-query";
import { AlertCircle, PackageSearch, Store } from "lucide-react";
import { startAmazonAsinLookup } from "@/serverFunctions/amazonAsin";
import {
  useAmazonAsinLookupPolling,
  type AmazonLookupJob,
} from "@/client/features/amazon-asin/useAmazonAsinLookupPolling";
import { getStandardErrorMessage } from "@/client/lib/error-messages";
import type {
  AmazonAsinResult,
  AmazonSellerOffer,
} from "@/server/lib/dataforseo";
import type { AmazonLookupKind } from "@/types/schemas/amazonAsin";
import {
  AMAZON_MARKETPLACES,
  DEFAULT_AMAZON_MARKETPLACE_CODE,
  type AmazonMarketplaceCode,
} from "@/shared/amazon-marketplaces";

type Props = { projectId: string };

const ASIN_RE = /^[A-Z0-9]{10}$/;

function useAmazonJob(projectId: string) {
  const [job, setJob] = useState<AmazonLookupJob | null>(null);
  const start = useMutation({
    mutationFn: (input: {
      kind: AmazonLookupKind;
      asin: string;
      marketplace: AmazonMarketplaceCode;
    }) =>
      startAmazonAsinLookup({ data: { projectId, ...input } }).then(
        ({ taskId }) => ({ kind: input.kind, asin: input.asin, taskId }),
      ),
    onSuccess: setJob,
  });
  const poll = useAmazonAsinLookupPolling(projectId, job);
  const outcome = poll.data?.outcome;
  const isBusy =
    start.isPending ||
    (job != null && (outcome === undefined || outcome.status === "pending"));
  const error = start.isError
    ? getStandardErrorMessage(start.error, "No se pudo iniciar la búsqueda")
    : poll.isError
      ? getStandardErrorMessage(poll.error, "No se pudo consultar el resultado")
      : null;
  const reset = () => {
    setJob(null);
    start.reset();
  };
  return { start, data: poll.data, isBusy, error, reset };
}

export function AmazonAsinLookupPage({ projectId }: Props) {
  const [asin, setAsin] = useState("");
  const [marketplace, setMarketplace] = useState<AmazonMarketplaceCode>(
    DEFAULT_AMAZON_MARKETPLACE_CODE,
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const [searched, setSearched] = useState<{
    asin: string;
    marketplace: AmazonMarketplaceCode;
  } | null>(null);

  const product = useAmazonJob(projectId);
  const sellers = useAmazonJob(projectId);

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
    setSearched({ asin: trimmed, marketplace });
    sellers.reset();
    product.reset();
    product.start.mutate({ kind: "asin", asin: trimmed, marketplace });
  };

  const productOutcome =
    product.data?.kind === "asin" ? product.data.outcome : undefined;
  const sellersOutcome =
    sellers.data?.kind === "sellers" ? sellers.data.outcome : undefined;

  return (
    <div className="px-4 py-4 pb-24 overflow-auto md:px-6 md:py-6 md:pb-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <PackageSearch className="size-6" />
            Buscar por ASIN
          </h1>
          <p className="text-sm text-base-content/70">
            Consulta precio, valoración, stock y marca de un producto de
            Amazon, y quién más lo está vendiendo.
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

          <button
            type="submit"
            className="btn btn-primary"
            disabled={product.isBusy}
          >
            {product.isBusy ? "Buscando…" : "Buscar"}
          </button>
        </form>

        <ErrorAlert message={product.error} />
        {product.isBusy && !product.error ? (
          <LoadingCard text="Consultando Amazon… puede tardar hasta medio minuto." />
        ) : null}
        {productOutcome?.status === "not_found" ? (
          <InfoCard text="No se encontró ningún producto con ese ASIN en este marketplace." />
        ) : null}

        {productOutcome?.status === "completed" && searched ? (
          <>
            <AmazonAsinResultCard result={productOutcome.result} />

            {sellers.data === undefined && !sellers.isBusy && !sellers.error ? (
              <button
                type="button"
                className="btn btn-outline gap-2"
                onClick={() =>
                  sellers.start.mutate({ kind: "sellers", ...searched })
                }
              >
                <Store className="size-4" />
                Ver vendedores de este producto
              </button>
            ) : null}

            <ErrorAlert message={sellers.error} />
            {sellers.isBusy && !sellers.error ? (
              <LoadingCard text="Buscando vendedores… puede tardar hasta medio minuto." />
            ) : null}
            {sellersOutcome?.status === "not_found" ? (
              <InfoCard text="Amazon no muestra otros vendedores para este producto." />
            ) : null}
            {sellersOutcome?.status === "completed" ? (
              <SellersTable offers={sellersOutcome.result.offers} />
            ) : null}
          </>
        ) : null}
      </div>
    </div>
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

function InfoCard({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-base-300 bg-base-100 p-6 text-center text-sm text-base-content/70">
      {text}
    </div>
  );
}

function formatPrice(value: number | null, currency: string | null) {
  if (value == null) return "—";
  return `${value.toFixed(2)} ${currency ?? ""}`.trim();
}

function AmazonAsinResultCard({ result }: { result: AmazonAsinResult }) {
  const priceLabel =
    result.priceFrom == null
      ? "No disponible"
      : result.priceTo != null && result.priceTo !== result.priceFrom
        ? `${formatPrice(result.priceFrom, null)} – ${formatPrice(result.priceTo, result.currency)}`
        : formatPrice(result.priceFrom, result.currency);

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

function SellersTable({ offers }: { offers: AmazonSellerOffer[] }) {
  if (offers.length === 0) {
    return <InfoCard text="Amazon no muestra otros vendedores para este producto." />;
  }
  return (
    <div className="rounded-xl border border-base-300 bg-base-100">
      <div className="flex items-center gap-2 border-b border-base-300 px-4 py-3">
        <Store className="size-4" />
        <h2 className="font-medium">
          Vendedores ({offers.length})
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="table table-sm">
          <thead>
            <tr>
              <th>#</th>
              <th>Vendedor</th>
              <th>Envía</th>
              <th>Precio</th>
              <th>Estado</th>
              <th>Valoración</th>
              <th>Entrega</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer, index) => (
              <tr key={`${offer.sellerName ?? "seller"}-${index}`}>
                <td>{offer.position ?? index + 1}</td>
                <td>
                  {offer.sellerUrl?.startsWith("https://") && offer.sellerName ? (
                    <a
                      href={offer.sellerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="link link-hover"
                    >
                      {offer.sellerName}
                    </a>
                  ) : (
                    (offer.sellerName ?? "—")
                  )}
                </td>
                <td>{offer.shipsFrom ?? "—"}</td>
                <td>
                  {formatPrice(offer.price, offer.currency)}
                  {offer.regularPrice != null &&
                  offer.price != null &&
                  offer.regularPrice > offer.price ? (
                    <span className="ml-1 text-xs text-base-content/50 line-through">
                      {formatPrice(offer.regularPrice, null)}
                    </span>
                  ) : null}
                </td>
                <td>{offer.condition ?? "—"}</td>
                <td>
                  {offer.ratingValue != null
                    ? `${offer.ratingValue}/${offer.ratingMax ?? 5}${
                        offer.ratingVotes != null ? ` (${offer.ratingVotes})` : ""
                      }`
                    : "—"}
                </td>
                <td className="max-w-48 text-xs">
                  {offer.deliveryMessage ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
