import { z } from "zod";
import { dataforseoPost } from "@/server/lib/dataforseo/core";
import {
  assertOk,
  buildTaskBilling,
  type DataforseoApiResponse,
  type DataforseoTaskLike,
} from "@/server/lib/dataforseo/envelope";
import type {
  TrendsItem,
  TrendsPoint,
  TrendsRange,
  TrendsSource,
} from "@/shared/google-trends";

// Google Trends (Explore). One request returns one kind of item, because the
// docs recommend asking for one item at a time and bill every request, so
// graph, regions and related queries are separate calls.
const PATH = "/v3/keywords_data/google_trends/explore/live";

const ITEM_TYPE: Record<TrendsItem, string> = {
  graph: "google_trends_graph",
  map: "google_trends_map",
  queries: "google_trends_queries_list",
};

export type GoogleTrendsInput = {
  keywords: string[];
  locationCode: number;
  languageCode: string;
  source: TrendsSource;
  range: TrendsRange;
  item: TrendsItem;
};

const valuesSchema = z.array(z.number().nullable());

const itemSchema = z
  .object({
    type: z.string(),
    data: z.unknown().optional(),
  })
  .passthrough();

const resultSchema = z
  .object({ items: z.array(itemSchema).nullable().optional() })
  .passthrough();

const graphPointSchema = z
  .object({
    date_from: z.string(),
    values: valuesSchema.nullable().optional(),
    missing_data: z.boolean().nullable().optional(),
  })
  .passthrough();

const mapPointSchema = z
  .object({
    geo_id: z.string().nullable().optional(),
    geo_name: z.string(),
    values: valuesSchema.nullable().optional(),
  })
  .passthrough();

const queryRowSchema = z
  .object({ query: z.string(), value: z.union([z.number(), z.string()]) })
  .passthrough();

const queriesSchema = z
  .object({
    top: z.array(queryRowSchema).nullable().optional(),
    rising: z.array(queryRowSchema).nullable().optional(),
  })
  .passthrough();

export type TrendsRegion = { geoName: string; values: (number | null)[] };
export type TrendsRelatedQuery = { query: string; value: number };

export type GoogleTrendsResult = {
  points: TrendsPoint[];
  regions: TrendsRegion[];
  topQueries: TrendsRelatedQuery[];
  risingQueries: TrendsRelatedQuery[];
};

function toRow(row: z.infer<typeof queryRowSchema>): TrendsRelatedQuery {
  return { query: row.query, value: Number(row.value) || 0 };
}

export async function fetchGoogleTrends(
  input: GoogleTrendsInput,
): Promise<DataforseoApiResponse<GoogleTrendsResult>> {
  const response = await dataforseoPost<DataforseoTaskLike>(PATH, [
    {
      keywords: input.keywords,
      location_code: input.locationCode,
      language_code: input.languageCode,
      type: input.source,
      time_range: input.range,
      item_types: [ITEM_TYPE[input.item]],
    },
  ]);
  const task = assertOk(response, { treatNoResultsAsEmpty: true });

  const result = resultSchema.safeParse(task.result?.[0] ?? {});
  const items = result.success ? (result.data.items ?? []) : [];
  const empty: GoogleTrendsResult = {
    points: [],
    regions: [],
    topQueries: [],
    risingQueries: [],
  };

  for (const item of items) {
    if (item.type === ITEM_TYPE.graph) {
      const rows = z.array(graphPointSchema).safeParse(item.data);
      if (rows.success) {
        empty.points = rows.data
          .filter((row) => row.missing_data !== true)
          .map((row) => ({ from: row.date_from, values: row.values ?? [] }));
      }
    } else if (item.type === ITEM_TYPE.map) {
      const rows = z.array(mapPointSchema).safeParse(item.data);
      if (rows.success) {
        empty.regions = rows.data.map((row) => ({
          geoName: row.geo_name,
          values: row.values ?? [],
        }));
      }
    } else if (item.type === ITEM_TYPE.queries) {
      const rows = queriesSchema.safeParse(item.data);
      if (rows.success) {
        empty.topQueries = (rows.data.top ?? []).map(toRow);
        empty.risingQueries = (rows.data.rising ?? []).map(toRow);
      }
    }
  }
  return { data: empty, billing: buildTaskBilling(task) };
}
