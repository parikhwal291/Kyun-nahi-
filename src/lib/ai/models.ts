// src/lib/ai/models.ts
// Exact model IDs — the ONLY place model strings are allowed.
// The live catalog at GET https://api.cline.bot/api/v1/models is authoritative;
// these IDs are asserted against it at /api/health. Never hardcode a model string
// anywhere else.
//
// CATALOG DRIFT (asserted 2026-10-10): PLAN.md §6 routes three models through a
// `cline-pass/*` namespace, but the live catalog exposes NO `cline-pass/*` prefix.
// Closest real matches (same underlying model, different provider prefix):
//   cline-pass/deepseek-v4.1-flash -> deepseek/deepseek-v4.1-flash
//   cline-pass/qwen3.7-plus       -> qwen/qwen3.7-plus
//   cline-pass/glm-5.3            -> z-ai/glm-5.3

export type JobName =
  | "extractConcepts"
  | "juniorTurn"
  | "evaluateConversation"
  | "groupMisconceptions"
  | "teacherCoach"
  | "visionPhoto";

export interface JobModels {
  primary: string;
  fallback: string;
}

export const MODELS: Record<JobName, JobModels> = {
  extractConcepts: {
    primary: "anthropic/claude-sonnet-5.5",
    fallback: "google/gemini-2.5-pro",
  },
  juniorTurn: {
    primary: "google/gemini-2.5-flash",
    fallback: "deepseek/deepseek-v4.1-flash", // ClinePass tier (PLAN: cline-pass/*)
  },
  evaluateConversation: {
    primary: "anthropic/claude-sonnet-5.5",
    fallback: "google/gemini-2.5-pro",
  },
  groupMisconceptions: {
    primary: "qwen/qwen3.7-plus", // ClinePass tier (PLAN: cline-pass/*)
    fallback: "google/gemini-2.5-flash",
  },
  teacherCoach: {
    primary: "z-ai/glm-5.3", // ClinePass tier (PLAN: cline-pass/*)
    fallback: "anthropic/claude-haiku-5.5",
  },
  visionPhoto: {
    primary: "google/gemini-2.5-flash",
    fallback: "openai/gpt-4o",
  },
};

// Models billed under the flat ClinePass subscription (per PLAN §6). The catalog
// dropped the `cline-pass/` prefix, so these are the corrected real IDs.
export const CLINE_PASS_MODELS = [
  "deepseek/deepseek-v4.1-flash",
  "qwen/qwen3.7-plus",
  "z-ai/glm-5.3",
] as const;

// Used when a credit-billed call is rejected with 402 (credits exhausted) and its
// configured fallback is also credit-billed: keep the demo running on the flat
// subscription instead of spending more credits.
export const CLINE_PASS_FALLBACK_ID = "z-ai/glm-5.3";

export function isClinePass(modelId: string): boolean {
  return (CLINE_PASS_MODELS as readonly string[]).includes(modelId);
}

// Every model ID that may be called — for the /api/health catalog assertion.
export function allModelIds(): string[] {
  const ids = Object.values(MODELS).flatMap((job) => [job.primary, job.fallback]);
  ids.push(CLINE_PASS_FALLBACK_ID);
  return [...new Set(ids)];
}
