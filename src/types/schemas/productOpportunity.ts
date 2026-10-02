import { z } from "zod";
import { AMAZON_MARKETPLACE_CODES } from "@/shared/amazon-marketplaces";

export const productOpportunitySchema = z.object({
  projectId: z.string().uuid(),
  keyword: z
    .string()
    .trim()
    .min(2, "Escribe el nicho o producto (mínimo 2 caracteres)")
    .max(80, "Máximo 80 caracteres"),
  marketplace: z.enum(AMAZON_MARKETPLACE_CODES),
  context: z.string().trim().max(500, "Máximo 500 caracteres").optional(),
});
