import { SignOutButton, UserButton } from "@clerk/nextjs";

export default function TeacherPage() {
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Teacher area</h1>
      <div className="mt-4 flex items-center gap-4">
        <UserButton />
        <SignOutButton />
      </div>
      <p className="mt-4 text-zinc-600">
        Notes input and concept review arrive in the next build step.
      </p>
    </main>
  );
}
