import { z } from "zod";
import {
  AMAZON_MARKETPLACE_CODES,
  DEFAULT_AMAZON_MARKETPLACE_CODE,
} from "@/shared/amazon-marketplaces";

export const startAmazonAsinLookupSchema = z.object({
  projectId: z.string().uuid(),
  asin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{10}$/, "Introduce un ASIN válido de 10 caracteres"),
  marketplace: z
    .enum(AMAZON_MARKETPLACE_CODES)
    .default(DEFAULT_AMAZON_MARKETPLACE_CODE),
});

export const getAmazonAsinLookupStatusSchema = z.object({
  projectId: z.string().uuid(),
  taskId: z.string().min(1),
});
