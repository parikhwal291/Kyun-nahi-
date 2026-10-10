import { NextResponse } from "next/server";
import { getDb, newId } from "@/lib/db";
import { getTeacherContext } from "@/lib/teacher";
import { TeacherAuthError } from "@/lib/auth/teacher";
import type { SchoolClass } from "@/lib/types";

/**
 * POST /api/teacher/classes — create a class for the authenticated teacher.
 * teacherId comes from the session, never from the request body.
 */
export async function POST(request: Request) {
  try {
    const { teacher } = await getTeacherContext();

    const body = await request.json().catch(() => null);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const grade = Number(body?.grade);
    const classCode =
      typeof body?.classCode === "string" ? body.classCode.trim().toUpperCase() : "";
    const defaultLanguage = body?.defaultLanguage === "hi" ? "hi" : "en";

    if (
      !name ||
      !Number.isInteger(grade) ||
      grade < 1 ||
      grade > 12 ||
      classCode.length < 4 ||
      classCode.length > 12
    ) {
      return NextResponse.json(
        { ok: false, error: "Invalid class details." },
        { status: 400 },
      );
    }

    const db = await getDb();
    const existing = await db.collection("classes").findOne({ classCode });
    if (existing) {
      return NextResponse.json(
        { ok: false, error: "That class code is already taken." },
        { status: 409 },
      );
    }

    const schoolClass: SchoolClass = {
      id: newId(),
      teacherId: teacher.id,
      name,
      grade,
      classCode,
      defaultLanguage,
      createdAt: new Date(),
    };
    await db.collection("classes").insertOne(schoolClass);

    return NextResponse.json({ ok: true, id: schoolClass.id, classCode });
  } catch (err) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
