// src/app/api/dev/extract/route.ts
// DEV-ONLY test harness for the extractConcepts job — no DB, no auth. It bypasses
// the confirm gate's DB lookup, so it MUST BE DELETED BEFORE DEPLOYMENT. Returns
// 404 in any non-development environment.

import { z } from "zod";
import { LEVELS, LANGUAGES } from "@/lib/types";
import { extractConcepts } from "@/lib/ai/jobs/extract";

const DevExtractBody = z.object({
  confirmedText: z.string().min(1).max(100_000),
  level: z.enum(LEVELS),
  language: z.enum(LANGUAGES),
});

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return new Response("Not Found", { status: 404 });
  }

  const parsed = DevExtractBody.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const result = await extractConcepts({
      confirmedText: parsed.data.confirmedText,
      level: parsed.data.level,
      language: parsed.data.language,
      status: "confirmed",
    });
    return Response.json(result);
  } catch (err) {
    console.warn("[dev/extract] failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
}
