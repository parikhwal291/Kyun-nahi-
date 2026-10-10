"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ConfirmNotes({ materialId }: { materialId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/notes/${materialId}/confirm`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not confirm.");
        return;
      }
      router.push("/teacher/concepts");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <p className="text-sm text-zinc-600">
        Confirming saves this text. Students only ever see concepts you
        explicitly approve.
      </p>
      <button
        onClick={confirm}
        disabled={busy}
        className="mt-2 rounded-full bg-foreground text-background px-5 py-2 disabled:opacity-50"
      >
        {busy ? "Confirming…" : "Confirm text"}
      </button>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
