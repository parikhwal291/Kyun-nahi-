// src/app/api/chat/evaluate/route.ts
// Conversation evaluation — typed contract. Person A provides the Zod-validated route
// shape and the evaluateConversation AI call; Person B wires requireStudent(), the
// MongoDB driver, and the prerequisite lookup.

import {
  EvaluateConversationRequestSchema,
  type Concept,
  type Conversation,
  type EvaluateConversationResponse,
} from "@/lib/types";
import { evaluateConversation } from "@/lib/ai/jobs/evaluate";

// SEAM (Person B): `import { requireStudent } from "@/lib/auth/session"`.
// Derives { studentId, classId } from the authenticated session — never the body.
function requireStudent(_request: Request): { studentId: string; classId: string } {
  throw new Error("requireStudent not wired yet (Person B)");
}

// SEAM (Person B): load the DONE conversation (re-scoped by studentId) and the
// APPROVED concept it belongs to, plus the prerequisite text (title + rubric) when
// concept.prereqConceptId is set. Return null when not found or not owned.
async function dbLoadEvaluationContext(_args: {
  conversationId: string;
  studentId: string;
  classId: string;
}): Promise<{
  conversation: Conversation;
  concept: Concept;
  prerequisiteText: string | null;
} | null> {
  throw new Error("db load not wired yet (Person B)");
}

// SEAM (Person B): persist the AI evaluation (source "ai", isSimulated false).
async function dbSaveEvaluation(_args: {
  conversationId: string;
  conceptId: string;
  studentId: string;
  result: EvaluateConversationResponse;
}): Promise<void> {
  throw new Error("db save not wired yet (Person B)");
}

function notImplemented(err: unknown): Response {
  const detail = err instanceof Error ? err.message : "not wired yet";
  return Response.json({ error: "not_implemented", detail }, { status: 501 });
}

export async function POST(request: Request) {
  let studentId: string;
  let classId: string;
  try {
    ({ studentId, classId } = requireStudent(request));
  } catch (err) {
    return notImplemented(err);
  }

  const parsed = EvaluateConversationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  let ctx: {
    conversation: Conversation;
    concept: Concept;
    prerequisiteText: string | null;
  } | null;
  try {
    ctx = await dbLoadEvaluationContext({
      conversationId: parsed.data.conversationId,
      studentId,
      classId,
    });
  } catch (err) {
    return notImplemented(err);
  }
  if (!ctx) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  if (ctx.conversation.status !== "done") {
    return Response.json(
      { error: "conversation_not_done", detail: "Evaluate only after the conversation is done." },
      { status: 409 }
    );
  }
  if (ctx.concept.status !== "approved") {
    return Response.json({ error: "concept_not_approved" }, { status: 409 });
  }

  let result: EvaluateConversationResponse;
  try {
    result = await evaluateConversation({
      concept: ctx.concept,
      transcript: ctx.conversation.turns,
      prerequisite: ctx.prerequisiteText,
    });
  } catch (err) {
    // AI failure: generic 502 without leaking the transcript.
    console.warn("[chat/evaluate] failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }

  try {
    await dbSaveEvaluation({
      conversationId: ctx.conversation.id,
      conceptId: ctx.concept.id,
      studentId,
      result,
    });
  } catch (err) {
    return notImplemented(err);
  }

  return Response.json(result);
}
