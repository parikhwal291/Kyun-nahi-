// src/lib/ai/models.ts
// Exact model IDs — the ONLY place model strings are allowed.
//
// The live catalog (GET /api/v1/models) is authoritative for credit-billed models,
// but it does NOT list the `cline-pass/*` namespace. Those slugs are verified with
// an actual completion probe (see /api/health?deep=1), not the catalog list.
//
// PROBE RESULTS (2026-10-10, max_tokens=5, prompt "hi", 2 attempts each):
//   cline-pass/qwen3.7-plus         -> 200 / 200   restored (ClinePass tier)
//   cline-pass/deepseek-v4.1-flash  -> 200 / 500   restored (ClinePass tier, flaky)
//   cline-pass/glm-5.3              -> 500 / 500   NOT restored ("empty response content")
//   cline-pass/mimo-v2.6-flash      -> 500 / 500   NOT restored ("empty response content")
//   cline-pass/qwen3.8-max          -> 500 / 500   NOT restored ("empty response content")

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
    fallback: "deepseek/deepseek-v4.1-flash", // credit-billed
  },
  evaluateConversation: {
    primary: "anthropic/claude-sonnet-5.5",
    fallback: "google/gemini-2.5-pro",
  },
  groupMisconceptions: {
    primary: "cline-pass/qwen3.7-plus", // ClinePass tier (probe OK)
    fallback: "qwen/qwen3.7-plus",      // credit-billed
  },
  teacherCoach: {
    primary: "z-ai/glm-5.3",            // credit (cline-pass/glm-5.3 failed the probe)
    fallback: "anthropic/claude-haiku-5.5",
  },
  visionPhoto: {
    primary: "google/gemini-2.5-flash",
    fallback: "openai/gpt-4o",
  },
};

// ClinePass-tier models (the 402 fallback set). ONLY cline-pass/* slugs that passed
// the probe. The deepseek//qwen//z-ai/ catalog versions are credit-billed and are
// deliberately NOT here.
export const CLINE_PASS_MODELS = [
  "cline-pass/qwen3.7-plus",
  "cline-pass/deepseek-v4.1-flash",
] as const;

// Default ClinePass-tier model for a credit-billed call that hits 402 (credits
// exhausted). qwen3.7-plus was the only slug that passed both probe attempts.
export const CLINE_PASS_FALLBACK_ID = "cline-pass/qwen3.7-plus";

export function isClinePass(modelId: string): boolean {
  return (CLINE_PASS_MODELS as readonly string[]).includes(modelId);
}

// True when the id is a cline-pass/* slug (regardless of probe result). /api/health
// uses this to skip the catalog-list assertion for slugs the list never contains.
export function isClinePassSlug(modelId: string): boolean {
  return modelId.startsWith("cline-pass/");
}

// Every model ID that may be called — for the /api/health probe + catalog check.
export function allModelIds(): string[] {
  const ids = Object.values(MODELS).flatMap((job) => [job.primary, job.fallback]);
  ids.push(...CLINE_PASS_MODELS, CLINE_PASS_FALLBACK_ID);
  return [...new Set(ids)];
}
