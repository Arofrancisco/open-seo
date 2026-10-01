import { z } from "zod";
import {
  isValidTrendsKeyword,
  TRENDS_ITEMS,
  TRENDS_LOCATION_CODES,
  TRENDS_MAX_KEYWORDS,
  TRENDS_RANGE_VALUES,
  TRENDS_SOURCE_VALUES,
} from "@/shared/google-trends";

export const googleTrendsSchema = z.object({
  projectId: z.string().uuid(),
  keywords: z
    .array(
      z
        .string()
        .trim()
        .refine(isValidTrendsKeyword, "Cada palabra: de 2 a 100 caracteres, sin símbolos como - + : ( ) , \" |"),
    )
    .min(1, "Escribe al menos una palabra")
    .max(TRENDS_MAX_KEYWORDS, `Máximo ${TRENDS_MAX_KEYWORDS} palabras`),
  locationCode: z
    .number()
    .refine((code) => TRENDS_LOCATION_CODES.some((known) => known === code), "Ubicación no válida"),
  source: z.enum(TRENDS_SOURCE_VALUES),
  range: z.enum(TRENDS_RANGE_VALUES),
  item: z.enum(TRENDS_ITEMS),
});
