// src/app/api/teacher/concepts/route.ts
// Concept extraction (AI, real) + listing — typed contract. The extractConcepts job
// runs for confirmed materials; the DB seams are filled by Person B.

import {
  ExtractConceptsRequestSchema,
  type Concept,
  type Material,
} from "@/lib/types";
import { extractConcepts } from "@/lib/ai/jobs/extract";

type Level = Concept["level"];
type Language = Concept["language"];

// SEAM (Person B): `import { requireTeacher } from "@/lib/auth/session"`.
// Derives { teacherId, classId } from the authenticated session — never the body.
function requireTeacher(_request: Request): { teacherId: string; classId: string } {
  throw new Error("requireTeacher not wired yet (Person B)");
}

// SEAM (Person B): load the material by id, re-scoped to the teacher's class, and
// derive level (from the class grade) + language (from class defaultLanguage).
// Returns null when the material doesn't exist or isn't owned by this teacher.
async function dbLoadMaterialForExtraction(_args: {
  materialId: string;
  classId: string;
  teacherId: string;
}): Promise<{ material: Material; level: Level; language: Language } | null> {
  throw new Error("db load not wired yet (Person B)");
}

// SEAM (Person B): list concepts scoped to the class.
async function dbListConcepts(_classId: string): Promise<Concept[]> {
  throw new Error("db list not wired yet (Person B)");
}

function notImplemented(err: unknown): Response {
  const detail = err instanceof Error ? err.message : "not wired yet";
  return Response.json({ error: "not_implemented", detail }, { status: 501 });
}

export async function GET(request: Request) {
  let classId: string;
  try {
    ({ classId } = requireTeacher(request));
  } catch (err) {
    return notImplemented(err);
  }

  try {
    const concepts = await dbListConcepts(classId);
    return Response.json(concepts);
  } catch (err) {
    return notImplemented(err);
  }
}

export async function POST(request: Request) {
  let teacherId: string;
  let classId: string;
  try {
    ({ teacherId, classId } = requireTeacher(request));
  } catch (err) {
    return notImplemented(err);
  }

  const parsed = ExtractConceptsRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_request", issues: parsed.error.issues }, { status: 400 });
  }

  let loaded: { material: Material; level: Level; language: Language } | null;
  try {
    loaded = await dbLoadMaterialForExtraction({
      materialId: parsed.data.materialId,
      classId,
      teacherId,
    });
  } catch (err) {
    return notImplemented(err);
  }

  if (!loaded) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }

  if (loaded.material.status !== "confirmed") {
    return Response.json(
      { error: "material_not_confirmed", detail: "Confirm the material before extracting concepts." },
      { status: 409 }
    );
  }

  try {
    const result = await extractConcepts({
      confirmedText: loaded.material.confirmedText,
      level: loaded.level,
      language: loaded.language,
      status: loaded.material.status,
    });
    return Response.json(result);
  } catch (err) {
    // AI failure: generic 502 without leaking prompt/notes content.
    console.warn("[concepts] extraction failed:", err instanceof Error ? err.message : String(err));
    return Response.json({ error: "ai_failed" }, { status: 502 });
  }
}
