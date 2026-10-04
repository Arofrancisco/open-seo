import type { ProductOpportunityResult } from "@/serverFunctions/productOpportunity";
import { downloadFile } from "@/client/features/amazon-rank/amazonRankExport";

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "boolean") return value ? "sí" : "no";
  // Decimal comma so Excel in Spanish reads numbers as numbers.
  const text = typeof value === "number" ? String(value).replace(".", ",") : value;
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function fileBase(result: ProductOpportunityResult): string {
  const slug = result.keyword
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `que-producto-lanzo-${slug}-${result.marketplace}-${result.createdAt.slice(0, 10)}`;
}

/**
 * One row per product, with the verdict on the first lines. Semicolon-separated
 * with a UTF-8 BOM so Excel in Spanish opens it in columns with accents intact.
 */
export function buildProductOpportunityCsv(result: ProductOpportunityResult): string {
  const { verdict, summary } = result;
  const intro = [
    ["nicho", result.keyword],
    ["mercado", result.marketplace],
    ["fecha", result.createdAt],
    ["veredicto", verdict.verdict],
    ["titular", verdict.headline],
    ["ventas_mes_minimas_del_nicho", summary.monthlySalesFloor],
    ["precio_mediano", summary.price?.median ?? null],
    ["resenas_medianas", summary.medianVotes],
    ["cuota_top3", summary.top3Share],
    [],
  ];
  const header = [
    "posicion_organica",
    "asin",
    "titulo",
    "ventas_mes",
    "ventas_sin_confirmar",
    "precio",
    "moneda",
    "resenas",
    "valoracion",
    "anunciado",
    "amazons_choice",
    "mas_vendido",
    "fuera_del_nicho",
  ];
  const rows = result.products.map((p) => [
    p.organicPosition,
    p.asin,
    p.title,
    p.monthlySales,
    p.salesUnconfirmed,
    p.price,
    p.currency,
    p.votes,
    p.rating,
    p.advertised,
    p.isAmazonChoice,
    p.isBestSeller,
    p.offNiche,
  ]);
  const lines = [...intro, header, ...rows].map((row) => row.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}`;
}

export function downloadProductOpportunity(
  result: ProductOpportunityResult,
  format: "csv" | "json",
) {
  if (format === "csv") {
    downloadFile(`${fileBase(result)}.csv`, buildProductOpportunityCsv(result), "text/csv;charset=utf-8");
    return;
  }
  downloadFile(
    `${fileBase(result)}.json`,
    JSON.stringify({ exportedAt: new Date().toISOString(), ...result }, null, 2),
    "application/json",
  );
}
