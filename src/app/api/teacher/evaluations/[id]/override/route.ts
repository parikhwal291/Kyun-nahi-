import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getTeacherContext } from "@/lib/teacher";
import { TeacherAuthError } from "@/lib/auth/teacher";
import type { Concept, Evaluation } from "@/lib/types";

/**
 * POST /api/teacher/evaluations/[id]/override — teacher overrides an evaluation
 * status. Scoped to the teacher's own class via the evaluation's conceptId.
 * Uses only the fields already in the Evaluation schema (source, originalStatus,
 * overriddenBy, overrideReason) — no invented fields.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { teacher, schoolClass } = await getTeacherContext();
    if (!schoolClass) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    const body = await request.json().catch(() => null);
    const status = body?.status;
    if (status !== "understood" && status !== "shaky" && status !== "not_yet") {
      return NextResponse.json(
        { ok: false, error: "Invalid status." },
        { status: 400 },
      );
    }
    const overrideReason =
      typeof body?.overrideReason === "string" && body.overrideReason.trim()
        ? body.overrideReason.trim()
        : null;

    const db = await getDb();
    const evaluation = await db
      .collection<Evaluation>("evaluations")
      .findOne({ id });
    if (!evaluation) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    // Scope: the evaluation's concept must belong to this teacher's class.
    const concept = await db
      .collection<Concept>("concepts")
      .findOne({ id: evaluation.conceptId, classId: schoolClass.id });
    if (!concept) {
      return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });
    }

    // Preserve the original AI status on the first override; keep it thereafter.
    const originalStatus =
      evaluation.source === "ai"
        ? evaluation.status
        : (evaluation.originalStatus ?? evaluation.status);

    await db.collection<Evaluation>("evaluations").updateOne(
      { id },
      {
        $set: {
          status,
          source: "teacher",
          originalStatus,
          overriddenBy: teacher.id,
          overrideReason,
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
