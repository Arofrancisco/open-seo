import { z } from "zod";
import {
  AMAZON_MARKETPLACE_CODES,
  DEFAULT_AMAZON_MARKETPLACE_CODE,
} from "@/shared/amazon-marketplaces";

export const AMAZON_LOOKUP_KINDS = ["asin", "sellers"] as const;
export type AmazonLookupKind = (typeof AMAZON_LOOKUP_KINDS)[number];

const asinField = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9]{10}$/, "Introduce un ASIN válido de 10 caracteres");

export const startAmazonAsinLookupSchema = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(AMAZON_LOOKUP_KINDS),
  asin: asinField,
  marketplace: z
    .enum(AMAZON_MARKETPLACE_CODES)
    .default(DEFAULT_AMAZON_MARKETPLACE_CODE),
});

export const getAmazonAsinLookupStatusSchema = z.object({
  projectId: z.string().uuid(),
  kind: z.enum(AMAZON_LOOKUP_KINDS),
  asin: asinField,
  taskId: z.string().min(1),
});
