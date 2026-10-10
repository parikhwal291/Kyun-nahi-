// src/app/api/health/route.ts
// GET /api/health
// Default: reports key presence (boolean, never the value) + asserts every model
// ID in models.ts against the live catalog. The Hindi smoke test runs only when
// ?deep=1 AND NODE_ENV is development, on a free model picked from the live
// catalog (never hardcoded).

import { allModelIds } from "@/lib/ai/models";
import { complete, listModels } from "@/lib/ai/client";

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

  if (keyPresent) {
    try {
      const ids = await listModels();
      const set = new Set(ids);
      catalog = {
        checked: true,
        count: ids.length,
        missing: allModelIds().filter((id) => !set.has(id)),
      };

      if (deep && isDev) {
        const freeModels = ids.filter((id) => id.includes(":free"));
        if (freeModels.length > 0) {
          const testModel = freeModels[0];
          console.log(`[health] Hindi smoke test on free model: ${testModel}`);
          smoke = await runSmokeTest(testModel);
        } else {
          smoke = { model: "", ok: false, language: "hi" };
        }
      }
    } catch (err) {
      console.warn("[health] catalog check failed:", err instanceof Error ? err.message : String(err));
    }
  }

  const ok =
    keyPresent && catalog.checked && catalog.missing.length === 0 && (!smoke || smoke.ok);

  return Response.json({ ok, keyPresent, catalog, smoke });
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
