import { NextResponse } from "next/server";
import { getDb, newId } from "@/lib/db";
import { requireStudent, StudentAuthError } from "@/lib/auth/student";
import { juniorOpening } from "@/lib/student/mock-junior";
import type { Concept, Conversation, Turn } from "@/lib/types";

/**
 * POST /api/student/conversations — start a practice conversation for an
 * approved concept. studentId/classId come from the verified session only.
 */
export async function POST(request: Request) {
  try {
    const { studentId, classId } = await requireStudent();

    const body = await request.json().catch(() => null);
    const conceptId = typeof body?.conceptId === "string" ? body.conceptId : "";
    const language = body?.language === "hi" ? "hi" : "en";

    const db = await getDb();
    const concept = await db
      .collection<Concept>("concepts")
      .findOne({ id: conceptId, classId, status: "approved" });
    if (!concept) {
      return NextResponse.json(
        { ok: false, error: "Concept not available." },
        { status: 404 },
      );
    }

    const now = new Date();
    const opening: Turn = {
      role: "junior",
      text: juniorOpening(concept.title, language),
      at: now,
    };
    const conversation: Conversation = {
      id: newId(),
      conceptId,
      studentId,
      language,
      level: concept.level,
      turns: [opening],
      turnCount: 0,
      status: "active",
      endedReason: null,
      createdAt: now,
      endedAt: null,
    };
    await db.collection("conversations").insertOne(conversation);

    return NextResponse.json({
      ok: true,
      conversationId: conversation.id,
      firstQuestion: opening.text,
    });
  } catch (err) {
    if (err instanceof StudentAuthError) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
