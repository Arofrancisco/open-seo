import { z } from "zod";
import {
  AMAZON_MARKETPLACE_CODES,
  DEFAULT_AMAZON_MARKETPLACE_CODE,
} from "@/shared/amazon-marketplaces";

export const MAX_AMAZON_RANK_KEYWORDS_PER_PROJECT = 50;

const projectOnly = z.object({ projectId: z.string().uuid() });

export const listAmazonRankKeywordsSchema = projectOnly;

export const addAmazonRankKeywordSchema = projectOnly.extend({
  asin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{10}$/, "Introduce un ASIN válido de 10 caracteres"),
  keyword: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Introduce una palabra clave")
    .max(200, "La palabra clave es demasiado larga"),
  marketplace: z
    .enum(AMAZON_MARKETPLACE_CODES)
    .default(DEFAULT_AMAZON_MARKETPLACE_CODE),
});

export const amazonRankKeywordRefSchema = projectOnly.extend({
  keywordId: z.string().uuid(),
});

