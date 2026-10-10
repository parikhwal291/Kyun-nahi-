// src/app/api/health/route.ts
// GET /api/health
// Default: reports key presence (boolean, never the value) + asserts credit-billed
// model IDs against the live catalog. With ?deep=1 AND NODE_ENV=development, it also
// runs a Hindi smoke test on a free model and probes every model in models.ts with a
// tiny completion (max_tokens=5, "hi") — the catalog list is not authoritative for
// cline-pass/* slugs, so those are probed, not list-asserted.

import { allModelIds, isClinePassSlug } from "@/lib/ai/models";
import { complete, listModels, probeModel, type ModelProbe } from "@/lib/ai/client";

interface SmokeResult {
  model: string;
  ok: boolean;
  language: "hi";
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

        // Authoritative per-model probe: tiny completion (max_tokens=5, "hi").
        probe = await Promise.all(allModelIds().map((id) => probeModel(id)));
      }
    } catch (err) {
      console.warn("[health] catalog check failed:", err instanceof Error ? err.message : String(err));
    }
  }

  const ok =
    keyPresent && catalog.checked && catalog.missing.length === 0 && (!smoke || smoke.ok);

  return Response.json({ ok, keyPresent, catalog, smoke, probe });
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
