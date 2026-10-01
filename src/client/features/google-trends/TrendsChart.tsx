import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TrendsPoint } from "@/shared/google-trends";

export const TREND_COLORS = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed"];

export function formatTrendDate(iso: string, withDay = false): string {
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleDateString("es-ES", {
    timeZone: "UTC",
    day: withDay ? "numeric" : undefined,
    month: "short",
    year: "2-digit",
  });
}

export function TrendsChart({
  keywords,
  points,
}: {
  keywords: string[];
  points: TrendsPoint[];
}) {
  const rows = points.map((point) => {
    const row: Record<string, string | number | null> = { date: point.from };
    keywords.forEach((_, index) => {
      row[`k${index}`] = point.values[index] ?? null;
    });
    return row;
  });

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
          <XAxis
            dataKey="date"
            tickFormatter={(value: string) => formatTrendDate(value)}
            minTickGap={40}
            fontSize={11}
          />
          <YAxis domain={[0, 100]} fontSize={11} />
          <Tooltip
            labelFormatter={(value) => formatTrendDate(String(value), true)}
            formatter={(value, name) => [value ?? "sin datos", name]}
          />
          <Legend />
          {keywords.map((keyword, index) => (
            <Line
              key={keyword}
              type="monotone"
              dataKey={`k${index}`}
              name={keyword}
              stroke={TREND_COLORS[index % TREND_COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
