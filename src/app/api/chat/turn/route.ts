// src/app/api/chat/turn/route.ts
// Junior chat turn — typed contract. Person A provides the Zod-validated route shape
// and the juniorTurn AI call; Person B wires requireStudent() and the MongoDB driver.

import {
  JuniorTurnRequestSchema,
  type Concept,
  type Conversation,
  type JuniorTurnResponse,
} from "@/lib/types";
import { juniorTurn } from "@/lib/ai/jobs/turn";

// SEAM (Person B): `import { requireStudent } from "@/lib/auth/session"`.
// Derives { studentId, classId } from the authenticated session — never the body.
function requireStudent(_request: Request): { studentId: string; classId: string } {
  throw new Error("requireStudent not wired yet (Person B)");
}

// SEAM (Person B): load the student's ACTIVE conversation (re-scoped by studentId)
// and the APPROVED concept it belongs to. Return null when not found, not owned by
// this student, or the concept is not approved.
async function dbLoadTurnContext(_args: {
  conversationId: string;
  studentId: string;
  classId: string;
}): Promise<{ conversation: Conversation; concept: Concept } | null> {
  throw new Error("db load not wired yet (Person B)");
}

// SEAM (Person B): append the student turn + junior reply, bump turnCount, and set
// status/endedReason when done. Returns the updated conversation.
async function dbAppendTurn(_args: {
  conversation: Conversation;
  studentMessage: string;
  reply: string;
  done: boolean;
}): Promise<Conversation> {
  throw new Error("db append not wired yet (Person B)");
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

  const parsed = JuniorTurnRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  let ctx: { conversation: Conversation; concept: Concept } | null;
  try {
    ctx = await dbLoadTurnContext({
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

  if (ctx.conversation.status !== "active") {
    return Response.json({ error: "conversation_not_active" }, { status: 409 });
  }
  if (ctx.concept.status !== "approved") {
    return Response.json({ error: "concept_not_approved" }, { status: 409 });
  }

  let result: JuniorTurnResponse;
  try {
    result = await juniorTurn({
      concept: ctx.concept,
      level: ctx.conversation.level,
      language: ctx.conversation.language,
      history: ctx.conversation.turns,
      message: parsed.data.message,
    });
  } catch (err) {
    // AI failure: generic 502 without leaking the prompt or student text.
    console.warn("[chat/turn] failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }

  try {
    await dbAppendTurn({
      conversation: ctx.conversation,
      studentMessage: parsed.data.message,
      reply: result.reply,
      done: result.done,
    });
  } catch (err) {
    return notImplemented(err);
  }

  return Response.json({ reply: result.reply, done: result.done });
}
