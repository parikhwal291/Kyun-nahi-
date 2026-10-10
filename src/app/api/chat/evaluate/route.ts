// src/app/api/chat/evaluate/route.ts
// Conversation evaluation — typed contract. Person A provides the Zod-validated route
// shape and the evaluateConversation AI call; Person B wires requireStudent(), the
// MongoDB driver, and the prerequisite lookup (the DB seams below). Only the seams
// were replaced; validation, status guards, the AI call and the generic 502 are
// Person A's and unchanged.

import {
  EvaluateConversationRequestSchema,
  type Concept,
  type Conversation,
  type EvaluateConversationResponse,
  type Evaluation,
} from "@/lib/types";
import { evaluateConversation } from "@/lib/ai/jobs/evaluate";
import { getDb, newId } from "@/lib/db";
import { requireStudent, StudentAuthError } from "@/lib/auth/student";

// Load the student's OWN done conversation (scoped by studentId from the verified
// session) and its approved concept (scoped to the student's class), plus the
// prerequisite text ("<title>: <rubric points>") when prereqConceptId is set.
// Returns null when anything is missing/not owned => 404 (nothing leaks).
async function dbLoadEvaluationContext(args: {
  conversationId: string;
  studentId: string;
  classId: string;
}): Promise<{
  conversation: Conversation;
  concept: Concept;
  prerequisiteText: string | null;
} | null> {
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

  let prerequisiteText: string | null = null;
  if (concept.prereqConceptId) {
    const prereq = await db
      .collection<Concept>("concepts")
      .findOne({ id: concept.prereqConceptId, classId: args.classId });
    if (prereq) {
      prerequisiteText = `${prereq.title}: ${prereq.rubric
        .map((r) => r.point)
        .join(" ")}`;
    }
  }

  return { conversation, concept, prerequisiteText };
}

// The existing evaluation for a conversation (idempotency), as the response shape.
async function dbFindExistingEvaluation(
  conversationId: string,
  studentId: string,
): Promise<EvaluateConversationResponse | null> {
  const db = await getDb();
  const existing = await db
    .collection<Evaluation>("evaluations")
    .findOne({ conversationId, studentId });
  if (!existing) return null;
  return {
    status: existing.status,
    reason: existing.reason,
    confidence: existing.confidence,
    misconceptionTag: existing.misconceptionTag,
    prereqGapNote: existing.prereqGapNote,
  };
}

// Persist the AI evaluation (source "ai", isSimulated false). The unique index on
// evaluations.conversationId turns a double-submit race into a duplicate-key error,
// which is reported as `false` so the caller returns the already-saved evaluation.
async function dbSaveEvaluation(args: {
  conversationId: string;
  conceptId: string;
  studentId: string;
  result: EvaluateConversationResponse;
}): Promise<boolean> {
  const db = await getDb();
  const evaluation: Evaluation = {
    id: newId(),
    conversationId: args.conversationId,
    conceptId: args.conceptId,
    studentId: args.studentId,
    status: args.result.status,
    reason: args.result.reason,
    confidence: args.result.confidence,
    misconceptionTag: args.result.misconceptionTag,
    prereqGapNote: args.result.prereqGapNote,
    source: "ai",
    originalStatus: null,
    overriddenBy: null,
    overrideReason: null,
    isSimulated: false,
    createdAt: new Date(),
  };
  try {
    await db.collection("evaluations").insertOne(evaluation);
    return true;
  } catch (err) {
    if (typeof err === "object" && err !== null && (err as { code?: number }).code === 11000) {
      return false;
    }
    throw err;
  }
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
    console.warn("[chat/evaluate] auth failed:", err instanceof Error ? err.name : "unknown");
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  const parsed = EvaluateConversationRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request" }, { status: 400 });
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
    console.warn("[chat/evaluate] load failed:", err instanceof Error ? err.name : "unknown");
    return Response.json({ error: "server_error" }, { status: 500 });
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

  // Idempotency: if this conversation was already evaluated, return the saved
  // result without spending another model call.
  try {
    const existing = await dbFindExistingEvaluation(ctx.conversation.id, studentId);
    if (existing) return Response.json(existing);
  } catch (err) {
    console.warn("[chat/evaluate] lookup failed:", err instanceof Error ? err.name : "unknown");
    return Response.json({ error: "server_error" }, { status: 500 });
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
    const inserted = await dbSaveEvaluation({
      conversationId: ctx.conversation.id,
      conceptId: ctx.concept.id,
      studentId,
      result,
    });
    if (!inserted) {
      // Lost a double-submit race: return the evaluation that was saved first.
      const winner = await dbFindExistingEvaluation(ctx.conversation.id, studentId);
      if (winner) return Response.json(winner);
    }
  } catch (err) {
    console.warn("[chat/evaluate] save failed:", err instanceof Error ? err.name : "unknown");
    return Response.json({ error: "server_error" }, { status: 500 });
  }

  return Response.json(result);
}
