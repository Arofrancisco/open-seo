import type { AmazonRankKeywordView } from "@/serverFunctions/amazonRank";

const TOP_IN_CSV = 3;

function csvCell(value: string | number | boolean | null | undefined): string {
  if (value == null) return "";
  const text = typeof value === "boolean" ? (value ? "sí" : "no") : String(value);
  return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * One row per check. Semicolon-separated with a UTF-8 BOM so Excel in Spanish
 * locale opens it in columns with accents intact.
 */
export function buildAmazonRankCsv(keywords: AmazonRankKeywordView[]): string {
  const header = [
    "fecha",
    "palabra_clave",
    "asin",
    "marketplace",
    "posicion_organica",
    "posicion_patrocinada",
    "resultados_analizados",
    "amazons_choice",
    "mas_vendido",
    ...Array.from({ length: TOP_IN_CSV }, (_, i) => [
      `top${i + 1}_asin`,
      `top${i + 1}_titulo`,
      `top${i + 1}_precio`,
    ]).flat(),
  ];
  const rows = keywords.flatMap((keyword) =>
    keyword.history.map((check) => [
      check.checkedAt,
      keyword.keyword,
      keyword.asin,
      keyword.marketplace,
      check.organicPosition,
      check.sponsoredPosition,
      check.organicResultsScanned,
      check.isAmazonChoice,
      check.isBestSeller,
      ...Array.from({ length: TOP_IN_CSV }, (_, i) => {
        const top = check.topResults[i];
        return [top?.asin, top?.title, top?.price];
      }).flat(),
    ]),
  );
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}`;
}

export function buildAmazonRankJson(
  keywords: AmazonRankKeywordView[],
): string {
  return JSON.stringify(
    { exportedAt: new Date().toISOString(), keywords },
    null,
    2,
  );
}

export function downloadFile(filename: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking synchronously can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
