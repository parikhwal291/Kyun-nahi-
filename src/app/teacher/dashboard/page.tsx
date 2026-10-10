import { getDb } from "@/lib/db";
import { getTeacherContext } from "@/lib/teacher";
import { aggregateEvaluations } from "@/lib/ai/jobs/aggregate";
import Dashboard, {
  type ConceptView,
  type ReviewItemView,
} from "@/components/teacher/Dashboard";
import type { Concept, Evaluation, Student } from "@/lib/types";

export default async function DashboardPage() {
  const { schoolClass } = await getTeacherContext();
  if (!schoolClass) {
    return (
      <main className="mx-auto w-full max-w-xl p-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-2 text-zinc-600">Create a class first.</p>
      </main>
    );
  }

  const db = await getDb();
  const concepts = await db
    .collection<Concept>("concepts")
    .find({ classId: schoolClass.id })
    .toArray();
  const students = await db
    .collection<Student>("students")
    .find({ classId: schoolClass.id })
    .toArray();

  const conceptIds = concepts.map((c) => c.id);
  const evaluations = await db
    .collection<Evaluation>("evaluations")
    .find({ conceptId: { $in: conceptIds } })
    .toArray();

  // A5: deterministic roll-up. No aggregation re-implemented here.
  const aggregate = aggregateEvaluations(evaluations);

  const titleById = new Map(concepts.map((c) => [c.id, c.title]));
  const aliasById = new Map(students.map((s) => [s.id, s.alias]));
  const evalById = new Map(evaluations.map((e) => [e.id, e]));

  const conceptViews: ConceptView[] = aggregate.byConcept
    .map((c) => ({
      conceptId: c.conceptId,
      title: titleById.get(c.conceptId) ?? "(untitled)",
      counts: c.counts,
      total: c.total,
      misconceptionClusters: c.misconceptionClusters.map((m) => ({
        tag: m.tag,
        count: m.count,
      })),
      foundationalGapCount: c.foundationalGapCount,
    }))
    .sort((a, b) => a.title.localeCompare(b.title));

  const reviewViews: ReviewItemView[] = aggregate.reviewQueue.map((r) => {
    const e = evalById.get(r.evaluationId);
    return {
      evaluationId: r.evaluationId,
      conceptTitle: titleById.get(r.conceptId) ?? "(untitled)",
      studentAlias: aliasById.get(r.studentId) ?? "?",
      status: r.status,
      confidence: r.confidence,
      misconceptionTag: r.misconceptionTag,
      isSimulated: r.isSimulated,
      source: e?.source ?? "ai",
      originalStatus: e?.originalStatus ?? null,
    };
  });

  return (
    <main className="mx-auto w-full max-w-xl p-4">
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <Dashboard
        concepts={conceptViews}
        reviewQueue={reviewViews}
        total={aggregate.total}
        simulatedCount={aggregate.simulatedCount}
      />
    </main>
  );
}
