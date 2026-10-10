// src/app/api/chat/turn/route.ts
// Junior chat turn — typed contract. Person A provides the Zod-validated route shape
// and the juniorTurn AI call; Person B wires requireStudent() and the MongoDB driver
// (the DB seams below). Only the seams were replaced; validation, status guards, the
// AI call and the generic 502 are Person A's and unchanged.

import {
  JuniorTurnRequestSchema,
  type Concept,
  type Conversation,
  type JuniorTurnResponse,
} from "@/lib/types";
import { juniorTurn } from "@/lib/ai/jobs/turn";
import { getDb } from "@/lib/db";
import { requireStudent, StudentAuthError } from "@/lib/auth/student";

// Load the student's OWN conversation (scoped by studentId from the verified
// session) and the concept it belongs to, scoped to the student's class. A concept
// that is missing, in another class, or not approved yields null => 404, which is
// indistinguishable from "not found" so nothing leaks.
async function dbLoadTurnContext(args: {
  conversationId: string;
  studentId: string;
  classId: string;
}): Promise<{ conversation: Conversation; concept: Concept } | null> {
  const db = await getDb();
  const conversation = await db
    .collection<Conversation>("conversations")
    .findOne({ id: args.conversationId, studentId: args.studentId });
  if (!conversation) return null;

  const concept = await db.collection<Concept>("concepts").findOne({
    id: conversation.conceptId,
    classId: args.classId,
    status: "approved",
  });
  if (!concept) return null;

  return { conversation, concept };
}

// Append the student turn + junior reply, set turnCount to the number of student
// turns, and close the conversation when done. The filter includes status:"active"
// so a concurrent finish cannot be overwritten; returns false when nothing matched.
async function dbAppendTurn(args: {
  conversation: Conversation;
  studentMessage: string;
  reply: string;
  done: boolean;
}): Promise<boolean> {
  const db = await getDb();
  const now = new Date();
  const studentTurns =
    args.conversation.turns.filter((t) => t.role === "student").length + 1;

  const result = await db.collection<Conversation>("conversations").updateOne(
    {
      id: args.conversation.id,
      studentId: args.conversation.studentId,
      status: "active",
    },
    {
      $push: {
        turns: {
          $each: [
            { role: "student" as const, text: args.studentMessage, at: now },
            {
              role: "junior" as const,
              text: args.reply,
              at: new Date(now.getTime() + 1),
            },
          ],
        },
      },
      $set: {
        turnCount: studentTurns,
        ...(args.done
          ? { status: "done" as const, endedReason: "completed" as const, endedAt: now }
          : {}),
      },
    },
  );
  return result.matchedCount === 1;
}

export async function POST(request: Request) {
  let studentId: string;
  let classId: string;
  try {
    ({ studentId, classId } = await requireStudent());
  } catch (err) {
    if (err instanceof StudentAuthError) {
      return Response.json({ error: "unauthorized" }, { status: 401 });
    }
    console.warn("[chat/turn] auth failed:", err instanceof Error ? err.name : "unknown");
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  const parsed = JuniorTurnRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    // Generic: do not echo validation issues (they can include the student's text).
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  let ctx: { conversation: Conversation; concept: Concept } | null;
  try {
    ctx = await dbLoadTurnContext({
      conversationId: parsed.data.conversationId,
      studentId,
      classId,
    });
  } catch (err) {
    console.warn("[chat/turn] load failed:", err instanceof Error ? err.name : "unknown");
    return Response.json({ error: "server_error" }, { status: 500 });
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

  let saved: boolean;
  try {
    saved = await dbAppendTurn({
      conversation: ctx.conversation,
      studentMessage: parsed.data.message,
      reply: result.reply,
      done: result.done,
    });
  } catch (err) {
    console.warn("[chat/turn] save failed:", err instanceof Error ? err.name : "unknown");
    return Response.json({ error: "server_error" }, { status: 500 });
  }
  if (!saved) {
    // The conversation finished between load and save (e.g. a double submit).
    return Response.json({ error: "conversation_not_active" }, { status: 409 });
  }

  return Response.json({ reply: result.reply, done: result.done });
}
