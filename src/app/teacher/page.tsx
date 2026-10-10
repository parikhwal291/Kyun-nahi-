import Link from "next/link";

export default function TeacherPage() {
  return (
    <main className="max-w-xl p-4">
      <h1 className="text-2xl font-semibold">Teacher area</h1>
      <p className="mt-1 text-zinc-600">
        Paste lesson notes, review the extracted concepts, and approve them for
        your students.
      </p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/teacher/notes"
          className="rounded-full bg-foreground text-background px-5 py-2 text-center"
        >
          Paste notes
        </Link>
        <Link
          href="/teacher/concepts"
          className="rounded-full border border-black/10 px-5 py-2 text-center"
        >
          Review concepts
        </Link>
      </div>
    </main>
  );
}

