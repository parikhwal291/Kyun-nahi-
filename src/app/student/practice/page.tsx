import { getDb } from "@/lib/db";
import { requireStudentPage } from "@/lib/auth/student";
import PracticePicker from "@/components/student/PracticePicker";
import type { Concept, Student } from "@/lib/types";

export default async function PracticePage() {
  const { studentId, classId } = await requireStudentPage();
  const db = await getDb();

  const concepts = await db
    .collection<Concept>("concepts")
    .find({ classId, status: "approved" })
    .sort({ createdAt: -1 })
    .toArray();

  const student = await db.collection<Student>("students").findOne({ id: studentId });

  const options = concepts.map((c) => ({
    id: c.id,
    title: c.title,
    level: c.level,
  }));

  return (
    <main className="mx-auto w-full max-w-md p-4">
      <h1 className="text-2xl font-semibold">Practise</h1>
      {student ? (
        <p className="mt-1 text-sm text-zinc-600">
          Hi {student.alias} — pick a concept and explain it to the confused
          junior.
        </p>
      ) : null}
      <PracticePicker concepts={options} />
    </main>
  );
}
