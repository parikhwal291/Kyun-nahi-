import { getTeacherContext } from "@/lib/teacher";
import NotesForm from "@/components/teacher/NotesForm";
import CreateClassForm from "@/components/teacher/CreateClassForm";

export default async function NotesPage() {
  const { schoolClass } = await getTeacherContext();

  return (
    <main className="max-w-xl p-4">
      <h1 className="text-2xl font-semibold">Paste lesson notes</h1>
      {schoolClass ? (
        <>
          <p className="mt-1 text-sm text-zinc-600">
            Class: {schoolClass.name} · code {schoolClass.classCode}
          </p>
          <NotesForm />
        </>
      ) : (
        <CreateClassForm />
      )}
    </main>
  );
}
