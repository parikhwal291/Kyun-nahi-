"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function CreateClassForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("7");
  const [classCode, setClassCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, grade: Number(grade), classCode }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not create the class.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4 space-y-4">
      <p className="text-zinc-600">
        Create your first class to start. Students will join with the class
        code.
      </p>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="text-sm font-medium" htmlFor="name">
            Class name
          </label>
          <input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded-lg border border-black/10 p-2"
            placeholder="Class 7 — Green Valley Govt School"
          />
        </div>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-sm font-medium" htmlFor="grade">
              Grade (1–12)
            </label>
            <input
              id="grade"
              type="number"
              min={1}
              max={12}
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="mt-1 w-full rounded-lg border border-black/10 p-2"
            />
          </div>
          <div className="flex-1">
            <label className="text-sm font-medium" htmlFor="classCode">
              Class code
            </label>
            <input
              id="classCode"
              value={classCode}
              onChange={(e) => setClassCode(e.target.value.toUpperCase())}
              className="mt-1 w-full rounded-lg border border-black/10 p-2"
              placeholder="RAIN7"
            />
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-full bg-foreground text-background px-5 py-2 disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create class"}
        </button>
      </form>
    </div>
  );
}
