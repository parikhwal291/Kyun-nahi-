import { getDb } from "@/lib/db";
import { getTeacherContext } from "@/lib/teacher";
import ConceptList, {
  type ConceptSummary,
} from "@/components/teacher/ConceptList";
import type { Concept } from "@/lib/types";

export default async function ConceptsPage() {
  const { schoolClass } = await getTeacherContext();

  if (!schoolClass) {
    return (
      <main className="max-w-xl p-4">
        <h1 className="text-2xl font-semibold">Concepts</h1>
        <p className="mt-2 text-zinc-600">Create a class first.</p>
      </main>
    );
  }

  const db = await getDb();
  const concepts = await db
    .collection<Concept>("concepts")
    .find({ classId: schoolClass.id })
    .sort({ createdAt: -1 })
    .toArray();

  const summaries: ConceptSummary[] = concepts.map((c) => ({
    id: c.id,
    title: c.title,
    level: c.level,
    status: c.status,
    rubric: c.rubric.map((r) => ({ point: r.point })),
    wrongIdeas: c.wrongIdeas.map((w) => ({
      label: w.label,
      description: w.description,
    })),
  }));

  return (
    <main className="max-w-xl p-4">
      <h1 className="text-2xl font-semibold">Concepts</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Approve concepts so students can practise them.
      </p>
      <ConceptList concepts={summaries} />
    </main>
  );
}
