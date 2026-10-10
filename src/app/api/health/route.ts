// src/app/api/health/route.ts
// GET /api/health
// Default: reports key presence (boolean, never the value) + asserts credit-billed
// model IDs against the live catalog. With ?deep=1 AND NODE_ENV=development, it also
// runs a Hindi smoke test on a free model, probes every model in models.ts
// SEQUENTIALLY (max_tokens=300, "Reply with the single word: ok") — the catalog list
// is not authoritative for cline-pass/* slugs, so those are probed, not list-asserted
// — and runs a 3x Hindi roleplay check on the juniorTurn primary.

import { allModelIds, isClinePassSlug, MODELS } from "@/lib/ai/models";
import { complete, listModels, probeModel, type ModelProbe } from "@/lib/ai/client";

interface SmokeResult {
  model: string;
  ok: boolean;
  language: "hi";
}

interface HindiCheck {
  run: number;
  model: string;
  ok: boolean;
  reply?: string;
  error?: string;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";
  const isDev = process.env.NODE_ENV === "development";

  const keyPresent = Boolean(process.env.CLINE_API_KEY);

  let catalog: { checked: boolean; count: number; missing: string[] } = {
    checked: false,
    count: 0,
    missing: [],
  };
  let smoke: SmokeResult | null = null;
  let probe: ModelProbe[] | null = null;
  let hindi: HindiCheck[] | null = null;

  if (keyPresent) {
    try {
      const ids = await listModels();
      const set = new Set(ids);
      catalog = {
        checked: true,
        count: ids.length,
        // The catalog list never includes cline-pass/* slugs — those are probed.
        missing: allModelIds().filter((id) => !isClinePassSlug(id) && !set.has(id)),
      };

      if (deep && isDev) {
        const freeModels = ids.filter((id) => id.includes(":free"));
        smoke =
          freeModels.length > 0
            ? await runSmokeTest(freeModels[0])
            : { model: "", ok: false, language: "hi" };

        // Authoritative per-model probe, run SEQUENTIALLY to avoid bursting the
        // gateway (concurrent probes trigger spurious "empty response content").
        probe = [];
        for (const id of allModelIds()) {
          probe.push(await probeModel(id));
        }

        // 3x Hindi roleplay check on the juniorTurn primary.
        hindi = await runHindiCheck();
      }
    } catch (err) {
      console.warn("[health] catalog check failed:", err instanceof Error ? err.message : String(err));
    }
  }

  const ok =
    keyPresent && catalog.checked && catalog.missing.length === 0 && (!smoke || smoke.ok);

  return Response.json({ ok, keyPresent, catalog, smoke, probe, hindi });
}

async function runSmokeTest(modelId: string): Promise<SmokeResult> {
  try {
    const { text } = await complete({
      model: modelId,
      messages: [
        { role: "system", content: "You are a connectivity smoke test. Reply with exactly: OK" },
        { role: "user", content: "नमस्ते, क्या आप हिंदी समझते हैं?" },
      ],
      temperature: 0,
      maxTokens: 16,
    });
    return { model: modelId, ok: text.trim().length > 0, language: "hi" };
  } catch (err) {
    console.warn("[health] smoke test failed:", err instanceof Error ? err.message : String(err));
    return { model: modelId, ok: false, language: "hi" };
  }
}

// Dev-only: ask the juniorTurn primary (as a Class-5 younger sibling) for ONE short
// Hindi question about the water cycle, 3 times. Returns the replies.
const HINDI_SYSTEM =
  "You are a curious younger sibling in Class 5. Ask ONE short question about the water cycle, in simple Hindi (Devanagari). Ask only the question, with no preamble.";

async function runHindiCheck(): Promise<HindiCheck[]> {
  const model = MODELS.juniorTurn.primary;
  const results: HindiCheck[] = [];
  for (let run = 1; run <= 3; run++) {
    try {
      const { text } = await complete({
        model,
        messages: [
          { role: "system", content: HINDI_SYSTEM },
          { role: "user", content: "अपना सवाल पूछो।" },
        ],
        maxTokens: MODELS.juniorTurn.maxTokens,
        temperature: 0.7,
        timeoutMs: MODELS.juniorTurn.timeoutMs,
      });
      results.push({ run, model, ok: text.trim().length > 0, reply: text.trim() });
    } catch (err) {
      console.warn(
        `[health] Hindi check run ${run} failed:`,
        err instanceof Error ? err.message : String(err)
      );
      results.push({ run, model, ok: false, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return results;
}
