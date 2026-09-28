import { z } from "zod";
import {
  AMAZON_MARKETPLACE_CODES,
  DEFAULT_AMAZON_MARKETPLACE_CODE,
} from "@/shared/amazon-marketplaces";
import { MAX_REVERSE_ASIN_KEYWORDS } from "@/shared/reverse-asin-candidates";

const projectOnly = z.object({ projectId: z.string().uuid() });

export const listReverseAsinRunsSchema = projectOnly;

export const startReverseAsinSchema = projectOnly.extend({
  asin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{10}$/, "Introduce un ASIN válido de 10 caracteres"),
  marketplace: z
    .enum(AMAZON_MARKETPLACE_CODES)
    .default(DEFAULT_AMAZON_MARKETPLACE_CODE),
});

export const reverseAsinRunRefSchema = projectOnly.extend({
  runId: z.string().uuid(),
});

export const confirmReverseAsinKeywordsSchema = reverseAsinRunRefSchema.extend({
  keywords: z
    .array(
      z
        .string()
        .trim()
        .toLowerCase()
        .min(1)
        .max(200, "La palabra clave es demasiado larga"),
    )
    .min(1, "Elige al menos una palabra clave")
    .max(
      MAX_REVERSE_ASIN_KEYWORDS,
      `Máximo ${MAX_REVERSE_ASIN_KEYWORDS} palabras clave por análisis`,
    ),
});

export const addReverseAsinKeywordSchema = reverseAsinRunRefSchema.extend({
  keyword: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "Introduce una palabra clave")
    .max(200, "La palabra clave es demasiado larga"),
});
