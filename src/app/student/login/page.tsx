import StudentLoginForm from "@/components/student/StudentLoginForm";

export default function StudentLoginPage() {
  return (
    <main className="mx-auto w-full max-w-md p-4">
      <h1 className="text-2xl font-semibold">Student sign in</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Use the class code, roll number, and PIN your teacher gave you.
      </p>
      <StudentLoginForm />
      <p className="mt-4 text-xs text-zinc-500">
        No email or account needed.
      </p>
    </main>
  );
}
