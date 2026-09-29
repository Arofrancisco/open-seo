import { createServerFn } from "@tanstack/react-start";
import { requireProjectContext } from "@/serverFunctions/middleware";
import {
  addAiVisibilityQuestionSchema,
  aiVisibilityOverviewSchema,
  launchAiVisibilitySchema,
  removeAiVisibilityQuestionSchema,
  saveBrandTermsSchema,
} from "@/types/schemas/aiVisibility";
import { AiVisibilityService } from "@/server/features/ai-visibility/AiVisibilityService";

export type {
  AiVisibilityBatchView,
  AiVisibilityOverview,
  AiVisibilityQuestionView,
} from "@/server/features/ai-visibility/AiVisibilityService";

// Loading the overview also advances it: it collects the answers that
// finished since the last visit.
export const getAiVisibility = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(aiVisibilityOverviewSchema)
  .handler(({ context }) => AiVisibilityService.getOverview(context.projectId));

export const saveAiVisibilityBrandTerms = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(saveBrandTermsSchema)
  .handler(({ data, context }) =>
    AiVisibilityService.saveBrandTerms(context.projectId, data.terms),
  );

export const addAiVisibilityQuestion = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(addAiVisibilityQuestionSchema)
  .handler(({ data, context }) =>
    AiVisibilityService.addQuestion({
      projectId: context.projectId,
      question: data.question,
      marketplace: data.marketplace,
    }),
  );

export const removeAiVisibilityQuestion = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(removeAiVisibilityQuestionSchema)
  .handler(({ data, context }) =>
    AiVisibilityService.removeQuestion(context.projectId, data.questionId),
  );

export const launchAiVisibility = createServerFn({ method: "POST" })
  .middleware(requireProjectContext)
  .validator(launchAiVisibilitySchema)
  .handler(({ data, context }) =>
    AiVisibilityService.launch({
      projectId: context.projectId,
      questionIds: data.questionIds,
      customer: context,
    }),
  );
