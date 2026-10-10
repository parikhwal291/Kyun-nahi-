import { NextResponse } from "next/server";
import { getDb, newId } from "@/lib/db";
import { requireStudent, StudentAuthError } from "@/lib/auth/student";
import { mockEvaluate } from "@/lib/student/mock-junior";
import type { Concept, Conversation, Evaluation } from "@/lib/types";

/**
 * POST /api/student/conversations/[id]/evaluate — evaluate a finished
 * conversation (mock adapter; swap for Person A's /api/chat/evaluate).
 * Persists an Evaluation marked isSimulated:true and returns the contract shape.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { studentId, classId } = await requireStudent();

    const db = await getDb();
    const conversation = await db
      .collection<Conversation>("conversations")
      .findOne({ id, studentId });
    if (!conversation) {
      return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }
    if (conversation.status !== "done") {
      return NextResponse.json(
        { ok: false, error: "Finish the chat first." },
        { status: 400 },
      );
    }

    const concept = await db
      .collection<Concept>("concepts")
      .findOne({ id: conversation.conceptId, classId });
    const studentMessages = conversation.turns
      .filter((t) => t.role === "student")
      .map((t) => t.text);

    const result = mockEvaluate(
      conversation.language,
      studentMessages,
      concept?.wrongIdeas?.[0]?.label ?? null,
    );

    const evaluation: Evaluation = {
      id: newId(),
      conversationId: conversation.id,
      conceptId: conversation.conceptId,
      studentId,
      status: result.status,
      reason: result.reason,
      confidence: result.confidence,
      misconceptionTag: result.misconceptionTag,
      prereqGapNote: result.prereqGapNote,
      source: "ai",
      originalStatus: null,
      overriddenBy: null,
      overrideReason: null,
      isSimulated: true,
      createdAt: new Date(),
    };
    await db.collection("evaluations").insertOne(evaluation);

    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof StudentAuthError) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
