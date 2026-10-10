// src/lib/ai/jobs/evaluate.ts
// "evaluateConversation" job: transcript + rubric + wrongIdeas (+ optional prereq)
// -> { status, reason, confidence, misconceptionTag, prereqGapNote }.
// A deterministic fast path handles only the clearly-not-gradable cases (no answer,
// or an explicit "I don't know") without spending a model call; everything else goes
// to the model and the misconceptionTag is clamped to the concept's own wrongIdeas
// labels so we never return an invented tag.

import {
  EvaluateConversationResponseSchema,
  type Concept,
  type EvaluateConversationResponse,
  type Turn,
} from "@/lib/types";
import { MODELS } from "../models";
import { completeJson } from "../client";
import { buildEvaluatorMessages } from "../prompts/evaluator";

export interface EvaluateConversationInput {
  concept: Pick<Concept, "title" | "rubric" | "wrongIdeas" | "language">;
  transcript: Turn[];
  prerequisite?: string | null;
}

const DONT_KNOW =
  /don'?t know|dunno|\bidk\b|not sure|no idea|pata nahi|nahi pata|malum nahi|maalam nahi|पता नहीं|नहीं पता|मालूम नहीं|नहीं जानता|नहीं जानती|नहीं आता|समझ नहीं/i;

export async function evaluateConversation(
  input: EvaluateConversationInput
): Promise<EvaluateConversationResponse> {
  const gate = deterministicGate(input.transcript);
  if (gate) return gate;

  const messages = buildEvaluatorMessages(input);
  const result = await completeJson<EvaluateConversationResponse>({
    model: MODELS.evaluateConversation.primary,
    fallback: MODELS.evaluateConversation.fallback,
    messages,
    schema: EvaluateConversationResponseSchema,
    temperature: 0.2,
    maxTokens: MODELS.evaluateConversation.maxTokens,
    timeoutMs: MODELS.evaluateConversation.timeoutMs,
  });

  const labels = new Set(input.concept.wrongIdeas.map((w) => w.label));
  return {
    status: result.status,
    reason: result.reason,
    confidence: result.confidence,
    misconceptionTag:
      result.misconceptionTag && labels.has(result.misconceptionTag)
        ? result.misconceptionTag
        : null,
    prereqGapNote: input.prerequisite ? result.prereqGapNote : null,
  };
}

// Fast path for transcripts that are clearly not gradable: no answer at all, or an
// explicit "I don't know" (English / Hindi / Hinglish). Everything else — including
// short but real answers — goes to the model. Reasons are English (dashboard UI).
function deterministicGate(transcript: Turn[]): EvaluateConversationResponse | null {
  const studentTexts = transcript
    .filter((turn) => turn.role === "student")
    .map((turn) => turn.text.trim());

  const hasAnyAnswer = studentTexts.some((text) => text.length > 0);
  if (!hasAnyAnswer) {
    return {
      status: "not_yet",
      reason: "The student gave no answer to assess.",
      confidence: 15,
      misconceptionTag: null,
      prereqGapNote: null,
    };
  }
  if (studentTexts.some((text) => DONT_KNOW.test(text))) {
    return {
      status: "not_yet",
      reason: "The student said they did not know.",
      confidence: 20,
      misconceptionTag: null,
      prereqGapNote: null,
    };
  }
  return null;
}
