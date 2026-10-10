// src/app/api/coach/route.ts
// Teacher coach endpoint (A6). Flag-gated on COACH_ENABLED. Tries the Cline SDK agent
// first; on any SDK failure/timeout it falls back to a plain completion with a
// pre-fetched class overview injected into the prompt (no tools).

import { z } from "zod";

import { complete } from "@/lib/ai/client";
import { MODELS } from "@/lib/ai/models";
import { getClassOverview } from "@/lib/ai/tools/coachData";
import { requireTeacher, TeacherAuthError } from "@/lib/auth/teacher";
import { buildSystemPrompt, runCoach, type CoachLanguage } from "@/lib/sdk/coach";

// Route handlers default to the Node.js runtime in Next 16 (Edge is opt-in), which
// the SDK requires. With cacheComponents enabled, declaring `runtime` here would
// break the build — so it is left to the default.

const CoachRequestSchema = z.object({
  question: z.string().trim().min(1).max(1000),
});

const SDK_TIMEOUT_MS = 40_000;

export async function POST(request: Request) {
  if (process.env.COACH_ENABLED !== "true") {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  let teacherId: string;
  try {
    teacherId = await requireTeacher();
  } catch (err) {
    if (err instanceof TeacherAuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    console.warn("[coach] auth failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const parsed = CoachRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  const { question } = parsed.data;
  const language: CoachLanguage = /[\u0900-\u097F]/.test(question) ? "hi" : "en";

  try {
    const result = await runCoach({
      teacherId,
      question,
      language,
      timeoutMs: SDK_TIMEOUT_MS,
    });
    return Response.json({ answer: result.answer, toolTrace: result.toolTrace });
  } catch (err) {
    console.warn(
      "[coach] SDK path failed; using plain fallback:",
      err instanceof Error ? err.message : String(err),
    );
  }

  return fallbackAnswer(teacherId, question, language);
}

async function fallbackAnswer(
  teacherId: string,
  question: string,
  language: CoachLanguage,
): Promise<Response> {
  let overview;
  try {
    overview = await getClassOverview(teacherId);
  } catch (err) {
    console.warn(
      "[coach] overview fetch failed in fallback:",
      err instanceof Error ? err.message : String(err),
    );
    overview = null;
  }

  const system =
    buildSystemPrompt(language) +
    "\n\nYou are in fallback mode with no tools. Answer only from the class data JSON in the user message; if it is empty or missing, say you have no data.";

  const user = [
    `Teacher question: ${question}`,
    "",
    overview
      ? `Here is the (simulated) class data as JSON:\n${JSON.stringify(overview)}`
      : "No class data is available.",
    "",
    "Answer using only this data. Cite the numbers. Keep it under 200 words.",
  ].join("\n");

  try {
    const { text } = await complete({
      model: MODELS.teacherCoach.fallback,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      maxTokens: MODELS.teacherCoach.maxTokens,
      timeoutMs: MODELS.teacherCoach.timeoutMs,
      temperature: 0.2,
    });
    return Response.json({ answer: text, toolTrace: [], fallback: true });
  } catch (err) {
    console.warn(
      "[coach] fallback completion failed:",
      err instanceof Error ? err.message : String(err),
    );
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
}
