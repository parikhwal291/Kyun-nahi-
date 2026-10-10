// src/lib/ai/jobs/extract.ts
// "extractConcepts" job: teacher-confirmed lesson text -> Zod-validated concepts.
import {
  ExtractConceptsResponseSchema,
  type Concept,
  type ExtractConceptsResponse,
  type Material,
} from "@/lib/types";
import { MODELS } from "../models";
import { completeJson } from "../client";
import { buildExtractorMessages } from "../prompts/extractor";

export interface ExtractConceptsInput {
  confirmedText: string;
  level: Concept["level"];
  language: Concept["language"];
  status: Material["status"];
}

// Refuse to run unless the teacher has confirmed the material. Students and the
// evaluator only ever read confirmedText; this guard makes that invariant explicit
// at the job boundary, so nothing can extract (or leak) an unconfirmed draft.
export async function extractConcepts(
  input: ExtractConceptsInput
): Promise<ExtractConceptsResponse> {
  if (input.status !== "confirmed") {
    throw new Error(`extractConcepts: material status is "${input.status}", expected "confirmed".`);
  }

  const messages = buildExtractorMessages({
    confirmedText: input.confirmedText,
    level: input.level,
    language: input.language,
  });

  return completeJson<ExtractConceptsResponse>({
    model: MODELS.extractConcepts.primary,
    fallback: MODELS.extractConcepts.fallback,
    messages,
    schema: ExtractConceptsResponseSchema,
    temperature: 0.2,
    maxTokens: MODELS.extractConcepts.maxTokens,
    timeoutMs: MODELS.extractConcepts.timeoutMs,
  });
}
