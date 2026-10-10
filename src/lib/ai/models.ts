// src/lib/ai/models.ts
// Exact model IDs — the ONLY place model strings are allowed.
//
// The live catalog (GET /api/v1/models) is authoritative for credit-billed models,
// but it does NOT list the `cline-pass/*` namespace. Those slugs are verified with
// an actual completion probe (see /api/health?deep=1), not the catalog list.
//
// PROBE RESULTS (2026-10-10, prompt "Reply with the single word: ok", max_tokens=300,
// 3 attempts each). Everything except qwen3.8-max returns 200 with content:
//   cline-pass/qwen3.7-plus         -> 200 x3   reasoning model (~177-263 tokens)
//   cline-pass/deepseek-v4.1-flash  -> 200 x3
//   cline-pass/glm-5.3              -> 200 x3   (reasoning_tokens_estimated)
//   cline-pass/mimo-v2.6-flash      -> 200 x3
//   cline-pass/qwen3.8-max          -> TIMEOUT (>40s) — not used anywhere.
//
// Earlier max_tokens=5 probes returned false "empty response content" failures:
// reasoning models spent all 5 tokens on reasoning and left no visible content.

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
  maxTokens: number; // headroom for reasoning tokens
  timeoutMs: number; // per-request timeout (extraction uses 60s)
}

export const MODELS: Record<JobName, JobModels> = {
  extractConcepts: {
    primary: "anthropic/claude-sonnet-5.5",
    fallback: "google/gemini-2.5-pro",
    maxTokens: 3000,
    timeoutMs: 60_000,
  },
  juniorTurn: {
    primary: "google/gemini-2.5-flash",
    fallback: "cline-pass/deepseek-v4.1-flash", // ClinePass tier
    maxTokens: 800,
    timeoutMs: 30_000,
  },
  evaluateConversation: {
    primary: "anthropic/claude-sonnet-5.5",
    fallback: "google/gemini-2.5-pro",
    maxTokens: 1500,
    timeoutMs: 30_000,
  },
  groupMisconceptions: {
    primary: "cline-pass/qwen3.7-plus",
    fallback: "cline-pass/deepseek-v4.1-flash",
    maxTokens: 1500,
    timeoutMs: 30_000,
  },
  teacherCoach: {
    // NOTE: tool-calling on glm-5.3 is not yet verified — test in the SDK step.
    primary: "cline-pass/glm-5.3",
    fallback: "anthropic/claude-haiku-5.5",
    maxTokens: 1500,
    timeoutMs: 30_000,
  },
  visionPhoto: {
    primary: "google/gemini-2.5-flash",
    fallback: "openai/gpt-4o",
    maxTokens: 1500,
    timeoutMs: 30_000,
  },
};

// ClinePass-tier models (the 402 fallback set). ONLY cline-pass/* slugs that passed
// the probe. cline-pass/qwen3.8-max is excluded: it timed out (>40s) in the probe.
export const CLINE_PASS_MODELS = [
  "cline-pass/qwen3.7-plus",
  "cline-pass/deepseek-v4.1-flash",
  "cline-pass/glm-5.3",
  "cline-pass/mimo-v2.6-flash",
] as const;

// Default ClinePass-tier model for a credit-billed call that hits 402 (credits
// exhausted).
export const CLINE_PASS_FALLBACK_ID = "cline-pass/deepseek-v4.1-flash";

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
