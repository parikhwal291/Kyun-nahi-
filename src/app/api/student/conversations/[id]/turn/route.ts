import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { requireStudent, StudentAuthError } from "@/lib/auth/student";
import { juniorReply } from "@/lib/student/mock-junior";
import type { Conversation, Turn } from "@/lib/types";

/**
 * POST /api/student/conversations/[id]/turn — add a student turn and get the
 * confused junior's reply (mock adapter; swap for Person A's /api/chat/turn).
 * Scoped to the conversation owner via the session.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { studentId } = await requireStudent();

    const body = await request.json().catch(() => null);
    const message = typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json(
        { ok: false, error: "Type a message." },
        { status: 400 },
      );
    }

    const db = await getDb();
    const conversation = await db
      .collection<Conversation>("conversations")
      .findOne({ id, studentId });
    if (!conversation) {
      return NextResponse.json({ ok: false, error: "Not found." }, { status: 404 });
    }
    if (conversation.status !== "active") {
      return NextResponse.json(
        { ok: false, error: "Conversation already finished." },
        { status: 400 },
      );
    }

    const now = new Date();
    const turns: Turn[] = [
      ...conversation.turns,
      { role: "student", text: message, at: now },
    ];
    const turnCount = conversation.turnCount + 1;

    const reply = juniorReply(conversation.language, turnCount);
    turns.push({ role: "junior", text: reply.reply, at: new Date(now.getTime() + 1) });

    const done = reply.done;
    await db.collection<Conversation>("conversations").updateOne(
      { id, studentId },
      {
        $set: {
          turns,
          turnCount,
          ...(done
            ? { status: "done", endedReason: "completed", endedAt: now }
            : {}),
        },
      },
    );

    return NextResponse.json({ ok: true, reply: reply.reply, done });
  } catch (err) {
    if (err instanceof StudentAuthError) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
