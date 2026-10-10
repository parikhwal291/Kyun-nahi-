import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTeacherContext } from "@/lib/teacher";
import { TeacherAuthError } from "@/lib/auth/teacher";
import type { Concept } from "@/lib/types";

/**
 * POST /api/teacher/concepts/[id]/approve — mark a concept approved so students
 * can practise it. Scoped to the teacher's class via the session.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { schoolClass } = await getTeacherContext();
    if (!schoolClass) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const db = await getDb();
    const concept = await db
      .collection<Concept>("concepts")
      .findOne({ id, classId: schoolClass.id });
    if (!concept) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    await db.collection<Concept>("concepts").updateOne(
      { id, classId: schoolClass.id },
      { $set: { status: "approved", approvedAt: new Date() } },
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
