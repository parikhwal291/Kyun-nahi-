import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTeacherContext } from "@/lib/teacher";
import { TeacherAuthError } from "@/lib/auth/teacher";
import type { Material } from "@/lib/types";

/**
 * POST /api/teacher/notes/[id]/confirm — confirm the extracted text. Only the
 * owning teacher may confirm; scoped by teacherId from the session.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { teacher } = await getTeacherContext();
    const db = await getDb();

    const material = await db
      .collection<Material>("materials")
      .findOne({ id, teacherId: teacher.id });
    if (!material) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    await db.collection<Material>("materials").updateOne(
      { id, teacherId: teacher.id },
      {
        $set: {
          status: "confirmed",
          confirmedText: material.rawText,
          confirmedAt: new Date(),
        },
      },
    );

    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
