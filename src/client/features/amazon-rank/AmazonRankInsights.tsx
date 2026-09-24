import { Award } from "lucide-react";
import type { AmazonRankKeywordView } from "@/serverFunctions/amazonRank";
import { RankTrendChart } from "@/client/features/rank-tracking/RankTrackingTrendChart";

// Same blue as the Google rank-tracking position line, so both read as one
// system. Validated against the light and dark surfaces (dataviz validator).
const ORGANIC_COLOR = "#2563eb";
const DEFAULT_DEPTH = 100;
const NICE_UPPER_BOUNDS = [5, 10, 20, 50, 100];
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;

function formatShortDate(value: number) {
  return new Date(value).toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
  });
}

function formatDateTime(value: number) {
  return new Date(value).toLocaleString("es-ES", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatLongDate(value: number) {
  return new Date(value).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Organic position over time for one keyword. Reuses the Google rank-tracking
 * chart (inverted axis, #1 at the top); checks where the ASIN wasn't found
 * are drawn in the bottom "not in top N" band instead of leaving a silent gap.
 */
export function AmazonPositionTrend({ row }: { row: AmazonRankKeywordView }) {
  if (row.history.length < 2) {
    return (
      <p className="text-xs text-base-content/60">
        La evolución aparece a partir de la segunda comprobación.
      </p>
    );
  }

  const positions = row.history.flatMap((check) =>
    check.organicPosition != null ? [check.organicPosition] : [],
  );
  const anyNotFound = positions.length < row.history.length;
  // Only a "not found" check needs the full scanned depth and its bottom band;
  // otherwise scale to the positions actually held, so #1 -> #3 is visible.
  const depth = anyNotFound
    ? Math.max(
        DEFAULT_DEPTH,
        ...row.history.map((check) => check.organicResultsScanned),
        ...positions,
      )
    : (NICE_UPPER_BOUNDS.find((bound) => bound > Math.max(...positions)) ??
      Math.max(...positions));
  const oldestFirst = [...row.history].reverse();
  const rawByTime = new Map<number, number | null>();
  const data = oldestFirst.map((check) => {
    const time = Date.parse(check.checkedAt);
    rawByTime.set(time, check.organicPosition);
    return { checkedAt: time, organic: check.organicPosition ?? depth };
  });
  const times = data.map((point) => point.checkedAt);
  const spansDays = Math.max(...times) - Math.min(...times) >= TWO_DAYS_MS;

  return (
    <RankTrendChart
      data={data}
      series={[
        { dataKey: "organic", name: "Posición orgánica", color: ORGANIC_COLOR },
      ]}
      serpDepth={depth}
      height={180}
      showBottomBand={anyNotFound}
      axisLabel="Posición orgánica en Amazon (1 = la mejor)"
      betterLabel="Mejor"
      tickFormatter={spansDays ? formatShortDate : formatDateTime}
      renderTooltip={(label) => {
        const position = rawByTime.get(label);
        return (
          <div className="rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs shadow-sm">
            <div className="text-base-content/60">{formatLongDate(label)}</div>
            <div className="font-semibold">
              {position != null ? `#${position}` : `Fuera del top ${depth}`}
            </div>
          </div>
        );
      }}
    />
  );
}

type AsinGroup = {
  key: string;
  asin: string;
  marketplace: string;
  title: string | null;
  keywords: number;
  checked: number;
  best: number | null;
  average: number | null;
  top10: number;
  notFound: number;
  amazonChoice: number;
};

function summarize(keywords: AmazonRankKeywordView[]): AsinGroup[] {
  const groups = new Map<string, AsinGroup & { positions: number[] }>();
  for (const row of keywords) {
    const key = `${row.asin}|${row.marketplace}`;
    const group = groups.get(key) ?? {
      key,
      asin: row.asin,
      marketplace: row.marketplace,
      title: null,
      keywords: 0,
      checked: 0,
      best: null,
      average: null,
      top10: 0,
      notFound: 0,
      amazonChoice: 0,
      positions: [],
    };
    group.keywords++;
    const latest = row.history[0];
    if (latest) {
      group.checked++;
      if (latest.organicPosition != null) {
        group.positions.push(latest.organicPosition);
        if (latest.organicPosition <= 10) group.top10++;
      } else {
        group.notFound++;
      }
      if (latest.isAmazonChoice) group.amazonChoice++;
      // The product's own title only comes back when it shows in a top 5.
      group.title ??=
        latest.topResults.find(
          (item) => item.asin?.toUpperCase() === row.asin.toUpperCase(),
        )?.title ?? null;
    }
    groups.set(key, group);
  }
  return [...groups.values()].map(({ positions, ...group }) => ({
    ...group,
    best: positions.length ? Math.min(...positions) : null,
    average: positions.length
      ? positions.reduce((sum, p) => sum + p, 0) / positions.length
      : null,
  }));
}

/** One card per tracked product: how it ranks across all its keywords. */
export function AmazonAsinSummary({
  keywords,
}: {
  keywords: AmazonRankKeywordView[];
}) {
  const groups = summarize(keywords).filter((group) => group.checked > 0);
  if (groups.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold">Resumen por producto</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groups.map((group) => (
          <div
            key={group.key}
            className="rounded-xl border border-base-300 bg-base-100 p-4"
          >
            <div className="mb-3 min-w-0">
              <div
                className="truncate text-sm font-medium"
                title={
                  group.title ??
                  "El título solo se conoce cuando el producto aparece en el top 5 de alguna de sus palabras clave."
                }
              >
                {group.title ?? (
                  <span className="text-base-content/60">
                    Título no disponible
                  </span>
                )}
              </div>
              <div className="font-mono text-xs text-base-content/60">
                {group.asin} · {group.marketplace} · {group.keywords} palabra
                {group.keywords === 1 ? "" : "s"} clave
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3">
              <Stat
                label="Mejor posición"
                value={group.best != null ? `#${group.best}` : "—"}
              />
              <Stat
                label="Posición media"
                value={
                  group.average != null
                    ? `#${formatAverage(group.average)}`
                    : "—"
                }
              />
              <Stat
                label="En el top 10"
                value={`${group.top10} de ${group.checked}`}
              />
              <Stat
                label="Amazon's Choice"
                value={`${group.amazonChoice} de ${group.checked}`}
                icon={group.amazonChoice > 0}
              />
            </dl>
            {group.notFound > 0 ? (
              <p className="mt-3 text-xs text-base-content/60">
                {group.notFound} palabra{group.notFound === 1 ? "" : "s"} clave
                sin aparecer en los resultados analizados.
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function formatAverage(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1).replace(".", ",");
}

function Stat({
  label,
  value,
  icon = false,
}: {
  label: string;
  value: string;
  icon?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-base-content/60">{label}</dt>
      <dd className="inline-flex items-center gap-1 text-lg font-semibold">
        {icon ? <Award className="size-4" aria-hidden /> : null}
        {value}
      </dd>
    </div>
  );
}
