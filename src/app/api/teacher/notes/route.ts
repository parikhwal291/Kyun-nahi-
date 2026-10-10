import { NextResponse } from "next/server";
import { getDb, newId } from "@/lib/db";
import { getTeacherContext } from "@/lib/teacher";
import { mockExtract } from "@/lib/teacher/mock-extract";
import { TeacherAuthError } from "@/lib/auth/teacher";
import type { Concept, Material } from "@/lib/types";

/**
 * POST /api/teacher/notes — create a draft material and run the (mock)
 * extraction to produce one draft concept. Class + teacher are derived from
 * the session, never from the request body.
 */
export async function POST(request: Request) {
  try {
    const { teacher, schoolClass } = await getTeacherContext();
    if (!schoolClass) {
      return NextResponse.json(
        { ok: false, error: "Create a class first." },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => null);
    const rawLabel = body?.label;
    const label: "taught" | "reference" | null =
      rawLabel === "taught" ? "taught" : rawLabel === "reference" ? "reference" : null;
    const rawText = typeof body?.rawText === "string" ? body.rawText.trim() : "";

    if (!label || rawText.length < 20) {
      return NextResponse.json(
        { ok: false, error: "Paste at least a few sentences of notes." },
        { status: 400 },
      );
    }

    const db = await getDb();
    const now = new Date();

    const material: Material = {
      id: newId(),
      classId: schoolClass.id,
      teacherId: teacher.id,
      label,
      sourceType: "text",
      rawText,
      confirmedText: "",
      status: "draft",
      createdAt: now,
      confirmedAt: null,
    };
    await db.collection("materials").insertOne(material);

    const extracted = mockExtract(rawText);
    const concept: Concept = {
      id: newId(),
      classId: schoolClass.id,
      materialId: material.id,
      title: extracted.title,
      level: extracted.level,
      language: extracted.language,
      rubric: extracted.rubric,
      wrongIdeas: extracted.wrongIdeas,
      prereqConceptId: null,
      status: "draft",
      approvedAt: null,
      createdAt: now,
    };
    await db.collection("concepts").insertOne(concept);

    return NextResponse.json({
      ok: true,
      materialId: material.id,
      conceptId: concept.id,
    });
  } catch (err) {
    if (err instanceof TeacherAuthError) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    throw err;
  }
}
