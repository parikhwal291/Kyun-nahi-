import { getDb } from "@/lib/db";
import { getTeacherContext } from "@/lib/teacher";
import ConfirmNotes from "@/components/teacher/ConfirmNotes";
import type { Concept, Material } from "@/lib/types";

export default async function ConfirmNotesPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { teacher } = await getTeacherContext();
  const db = await getDb();

  const material = await db
    .collection<Material>("materials")
    .findOne({ id, teacherId: teacher.id });
  if (!material) {
    return (
      <main className="max-w-xl p-4">
        <p>Material not found.</p>
      </main>
    );
  }

  const concepts = await db
    .collection<Concept>("concepts")
    .find({ materialId: material.id })
    .toArray();

  return (
    <main className="max-w-xl p-4">
      <h1 className="text-2xl font-semibold">Review extracted content</h1>
      <p className="mt-1 text-sm text-amber-700">
        Demo extraction (mock) — the real AI extraction, built by your teammate,
        will replace this.
      </p>

      <section className="mt-4">
        <h2 className="font-medium">Extracted text</h2>
        <div className="mt-1 whitespace-pre-wrap rounded-lg border border-black/10 p-3 text-sm">
          {material.rawText}
        </div>
      </section>

      <section className="mt-4 space-y-3">
        <h2 className="font-medium">Extracted concepts ({concepts.length})</h2>
        {concepts.map((c) => (
          <div key={c.id} className="rounded-lg border border-black/10 p-3">
            <div className="font-semibold">{c.title}</div>
            <div className="text-xs text-zinc-500">
              Level: {c.level} · Language: {c.language}
            </div>
            <div className="mt-2 text-sm">
              <span className="font-medium">Rubric</span>
              <ul className="ml-5 list-disc">
                {c.rubric.map((r, i) => (
                  <li key={i}>{r.point}</li>
                ))}
              </ul>
            </div>
            <div className="mt-2 text-sm">
              <span className="font-medium">Common wrong ideas</span>
              <ul className="ml-5 list-disc">
                {c.wrongIdeas.map((w, i) => (
                  <li key={i}>
                    <span className="font-medium">{w.label}</span> —{" "}
                    {w.description}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ))}
      </section>

      {material.status === "draft" ? (
        <ConfirmNotes materialId={material.id} />
      ) : (
        <p className="mt-4 text-green-700">This text is confirmed.</p>
      )}
    </main>
  );
}
