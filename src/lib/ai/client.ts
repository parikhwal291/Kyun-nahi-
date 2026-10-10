// src/lib/ai/client.ts
// OpenAI-compatible client for https://api.cline.bot/api/v1. All model calls go
// through here. The API key is read server-side only (never logged or echoed).
// We never log message content (notes text / student text); only status codes and
// model IDs.

import { CLINE_PASS_FALLBACK_ID, isClinePass } from "./models";

const BASE_URL = "https://api.cline.bot/api/v1";
const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 8000;
const DEFAULT_MAX_TOKENS = 1500; // headroom for reasoning tokens
const DEFAULT_TIMEOUT_MS = 30_000;
const PROBE_TIMEOUT_MS = 30_000;

export type ChatRole = "system" | "user" | "assistant";

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

// Minimal structural contract for a Zod schema: we only need safeParse. This
// keeps the client decoupled from Zod v4's generic variance.
export interface SchemaLike<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: unknown };
}

export interface RawCompletion {
  model: string;
  text: string;
}

interface CallOpts {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: "json_object" | "text";
  timeoutMs?: number;
}

interface CompleteOptions extends CallOpts {
  model: string;
  fallback?: string;
  messages: ChatMessage[];
}

function apiKey(): string {
  const key = process.env.CLINE_API_KEY;
  if (!key) {
    throw new Error("CLINE_API_KEY is not set (server-side env).");
  }
  return key;
}

// api.cline.bot wraps successful completions as { data: { choices: [...] } }
// (not the bare OpenAI { choices } shape). We extract ONLY the visible content and
// the metadata we need — never message.reasoning / reasoning_details, which are
// stripped here and never returned, logged, or exposed to any API response.
interface ParsedChatResponse {
  content: string;
  finishReason: string | null;
  reasoningTokens: number | null;
}

function parseChatResponse(raw: string): ParsedChatResponse {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { content: "", finishReason: null, reasoningTokens: null };
  }
  const root = ((parsed as { data?: unknown }).data ?? parsed) as {
    choices?: { finish_reason?: string | null; message?: { content?: string } }[];
    usage?: {
      completion_tokens_details?: { reasoning_tokens?: number };
      reasoning_tokens?: number;
    };
  };
  const choice = root.choices?.[0];
  const content = choice?.message?.content ?? "";
  const finishReason = choice?.finish_reason ?? null;
  const details = root.usage?.completion_tokens_details;
  const reasoningTokens =
    typeof details?.reasoning_tokens === "number"
      ? details.reasoning_tokens
      : typeof root.usage?.reasoning_tokens === "number"
        ? root.usage.reasoning_tokens
        : null;
  return { content, finishReason, reasoningTokens };
}

// Error bodies come in two shapes: { error: "..." } or { error: { message: "..." } }.
function extractErrorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: unknown };
    const err = parsed?.error;
    if (typeof err === "string") return err;
    if (err && typeof (err as { message?: unknown }).message === "string") {
      return (err as { message: string }).message;
    }
    return raw.slice(0, 200);
  } catch {
    return raw.slice(0, 200);
  }
}

function backoffMs(attempt: number): number {
  const ms = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  return ms + Math.floor(Math.random() * 200); // jitter
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type AttemptResult =
  | {
      ok: true;
      model: string;
      text: string;
      finishReason: string | null;
      emptyContent: boolean;
    }
  | { ok: false; status: number | null; retryAfterSec: number | null; timedOut: boolean };

// One POST to /chat/completions with a per-request timeout. Logs only status/timeout
// — never the body (which may echo our content back) and never reasoning fields.
async function attempt(
  modelId: string,
  messages: ChatMessage[],
  opts: CallOpts
): Promise<AttemptResult> {
  const body: Record<string, unknown> = { model: modelId, messages };
  if (opts.temperature !== undefined) body.temperature = opts.temperature;
  if (opts.maxTokens !== undefined) body.max_tokens = opts.maxTokens;
  if (opts.responseFormat === "json_object") body.response_format = { type: "json_object" };

  const controller = new AbortController();
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (res.ok) {
      const parsed = parseChatResponse(await res.text());
      return {
        ok: true,
        model: modelId,
        text: parsed.content,
        finishReason: parsed.finishReason,
        emptyContent: parsed.content.length === 0,
      };
    }

    const status = res.status;
    console.warn(`[ai] ${modelId} -> HTTP ${status}`);

    let retryAfterSec: number | null = null;
    const raw = res.headers.get("retry-after");
    if (raw) {
      const n = Number(raw);
      if (Number.isFinite(n) && n > 0) retryAfterSec = n;
    }

    try {
      await res.text(); // drain so the socket can be reused
    } catch {
      /* ignore */
    }

    return { ok: false, status, retryAfterSec, timedOut: false };
  } catch (err) {
    if (controller.signal.aborted) {
      console.warn(`[ai] ${modelId} -> timeout after ${timeoutMs}ms`);
      return { ok: false, status: null, retryAfterSec: null, timedOut: true };
    }
    console.warn(`[ai] ${modelId} -> network error`);
    return { ok: false, status: null, retryAfterSec: null, timedOut: false };
  } finally {
    clearTimeout(timer);
  }
}

function resolveFallbackAfterFailure(opts: {
  failedModel: string;
  fallback?: string;
  billingBlocked: boolean;
}): string | undefined {
  const { failedModel, fallback, billingBlocked } = opts;
  if (!billingBlocked) {
    return fallback && fallback !== failedModel ? fallback : undefined;
  }
  // 402 (billing/quota) handling:
  if (isClinePass(failedModel)) {
    // The ClinePass-tier model itself is blocked → use the configured fallback.
    return fallback && fallback !== failedModel ? fallback : undefined;
  }
  // A credit-billed model hit 402 → prefer a ClinePass-tier model, not another
  // credit-billed one.
  return fallback && isClinePass(fallback) ? fallback : CLINE_PASS_FALLBACK_ID;
}

// Raw completion: retry 429/5xx with backoff, then fall back. On 402, a
// credit-billed call falls back to a ClinePass-tier model. On timeout, fall back
// immediately. Empty visible content with finish_reason "length" (reasoning models
// starved by max_tokens) retries once with a doubled budget before falling back.
export async function complete(opts: CompleteOptions): Promise<RawCompletion> {
  const { model, fallback, messages, ...callOpts } = opts;

  let billingBlocked = false;

  for (let attemptNo = 0; attemptNo <= MAX_RETRIES; attemptNo++) {
    const r = await attempt(model, messages, callOpts);
    if (r.ok) {
      if (r.emptyContent && r.finishReason === "length") {
        const doubled = (callOpts.maxTokens ?? DEFAULT_MAX_TOKENS) * 2;
        console.warn(`[ai] ${model} -> empty content (length); retrying with max_tokens ${doubled}`);
        const retry = await attempt(model, messages, { ...callOpts, maxTokens: doubled });
        if (retry.ok && !retry.emptyContent) {
          return { model: retry.model, text: retry.text };
        }
        console.warn(`[ai] ${model} -> still empty after doubling; falling back`);
        break;
      }
      return { model: r.model, text: r.text };
    }

    if (r.timedOut) {
      console.warn(`[ai] ${model} -> timed out; switching to fallback`);
      break;
    }
    if (r.status === 402) {
      billingBlocked = true;
      console.warn(`[ai] ${model} -> 402 (billing) — switching to ClinePass tier`);
      break;
    }
    if (r.status === 429) {
      const wait = r.retryAfterSec ? r.retryAfterSec * 1000 : backoffMs(attemptNo);
      console.warn(`[ai] ${model} -> 429 — retry ${attemptNo + 1}/${MAX_RETRIES} in ${wait}ms`);
      await sleep(wait);
      continue;
    }
    if (r.status !== null && RETRYABLE.has(r.status)) {
      console.warn(`[ai] ${model} -> HTTP ${r.status} — retry ${attemptNo + 1}/${MAX_RETRIES}`);
      await sleep(backoffMs(attemptNo));
      continue;
    }
    throw new Error(`AI model ${model} returned HTTP ${r.status ?? "network error"}.`);
  }

  const fallbackModel = resolveFallbackAfterFailure({
    failedModel: model,
    fallback,
    billingBlocked,
  });

  if (!fallbackModel) {
    throw new Error(`AI model ${model} failed after retries (no fallback configured).`);
  }

  const r = await attempt(fallbackModel, messages, callOpts);
  if (r.ok) return { model: r.model, text: r.text };
  console.warn(`[ai] ${fallbackModel} -> HTTP ${r.status ?? "network error"} (fallback failed)`);
  throw new Error(`AI fallback ${fallbackModel} returned HTTP ${r.status ?? "network error"}.`);
}

function stripFences(raw: string): string {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "");
  text = text.replace(/\s*```$/, "");
  return text.trim();
}

function extractJsonText(text: string): string | null {
  const startObj = text.indexOf("{");
  const startArr = text.indexOf("[");
  let start = -1;
  let end = -1;
  if (startObj !== -1 && (startArr === -1 || startObj < startArr)) {
    start = startObj;
    end = text.lastIndexOf("}");
  } else if (startArr !== -1) {
    start = startArr;
    end = text.lastIndexOf("]");
  }
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function parseJson<T>(schema: SchemaLike<T>, raw: string): { ok: true; value: T } | { ok: false } {
  const text = stripFences(raw);
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    const extracted = extractJsonText(text);
    if (extracted === null) return { ok: false };
    try {
      data = JSON.parse(extracted);
    } catch {
      return { ok: false };
    }
  }
  const result = schema.safeParse(data);
  return result.success ? { ok: true, value: result.data } : { ok: false };
}

interface CompleteJsonOptions<T> extends CompleteOptions {
  schema: SchemaLike<T>;
}

// Call a model for structured JSON, parse + Zod-validate, and retry ONCE if the
// output is not valid JSON or fails the schema. We never rely on
// `response_format: json_object` alone — the schema is always the gate.
export async function completeJson<T>(opts: CompleteJsonOptions<T>): Promise<T> {
  const { schema, messages, ...rest } = opts;

  const first = await complete({ ...rest, messages, responseFormat: "json_object" });
  const parsed = parseJson(schema, first.text);
  if (parsed.ok) return parsed.value;

  console.warn(`[ai] ${first.model} -> invalid JSON output; retrying once`);
  const second = await complete({
    ...rest,
    messages: [
      ...messages,
      { role: "assistant", content: first.text },
      {
        role: "user",
        content:
          "Your previous response was not valid JSON matching the required schema. Respond again with ONLY the corrected JSON, no markdown fences or commentary.",
      },
    ],
    responseFormat: "json_object",
  });
  const retried = parseJson(schema, second.text);
  if (retried.ok) return retried.value;
  throw new Error(`AI model ${second.model} returned invalid JSON twice.`);
}

// Fetch the live model catalog (ids only). Used by /api/health for the assertion
// and to pick a free model for the smoke test at runtime.
export async function listModels(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/models`, {
    headers: { Authorization: `Bearer ${apiKey()}` },
  });
  if (!res.ok) {
    console.warn(`[ai] GET /models -> HTTP ${res.status}`);
    throw new Error(`Catalog fetch failed with HTTP ${res.status}.`);
  }
  const data = (await res.json()) as { data?: { id: string }[] };
  return (data.data ?? []).map((m) => m.id);
}

export interface ModelProbe {
  model: string;
  ok: boolean;
  status: number | null;
  emptyContent?: boolean;
  finishReason?: string | null;
  reasoningTokens?: number | null;
  error?: string;
}

// Dev-only probe (used by /api/health?deep=1): send a small completion
// (max_tokens=300) and report status, empty-content, finish_reason and
// reasoning-token count. The catalog list is not authoritative for cline-pass/*.
export async function probeModel(modelId: string): Promise<ModelProbe> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey()}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
        max_tokens: 300,
      }),
      signal: controller.signal,
    });
    const raw = await res.text();
    if (res.ok) {
      const parsed = parseChatResponse(raw);
      return {
        model: modelId,
        ok: parsed.content.length > 0,
        status: res.status,
        emptyContent: parsed.content.length === 0,
        finishReason: parsed.finishReason,
        reasoningTokens: parsed.reasoningTokens,
      };
    }
    return {
      model: modelId,
      ok: false,
      status: res.status,
      error: extractErrorMessage(raw),
    };
  } catch (err) {
    return {
      model: modelId,
      ok: false,
      status: null,
      error: controller.signal.aborted ? "timeout" : err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}
