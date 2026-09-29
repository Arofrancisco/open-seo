import { z } from "zod";
import {
  AI_VISIBILITY_MARKETPLACES,
  MAX_BRAND_TERMS,
  MAX_QUESTIONS_PER_PROJECT,
} from "@/shared/ai-visibility";

const projectOnly = z.object({ projectId: z.string().uuid() });

export const aiVisibilityOverviewSchema = projectOnly;

export const saveBrandTermsSchema = projectOnly.extend({
  terms: z
    .array(z.string().trim().min(1).max(60, "Cada nombre admite hasta 60 caracteres"))
    .min(1, "Escribe al menos el nombre de tu marca")
    .max(MAX_BRAND_TERMS, `Máximo ${MAX_BRAND_TERMS} nombres`),
});

export const addAiVisibilityQuestionSchema = projectOnly.extend({
  question: z
    .string()
    .trim()
    .min(5, "Escribe la pregunta tal como la haría un comprador")
    .max(300, "La pregunta es demasiado larga"),
  marketplace: z.enum(AI_VISIBILITY_MARKETPLACES),
});

export const removeAiVisibilityQuestionSchema = projectOnly.extend({
  questionId: z.string().uuid(),
});

export const launchAiVisibilitySchema = projectOnly.extend({
  questionIds: z
    .array(z.string().uuid())
    .min(1, "Elige al menos una pregunta")
    .max(MAX_QUESTIONS_PER_PROJECT),
});
