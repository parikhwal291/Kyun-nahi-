"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function NotesForm() {
  const router = useRouter();
  const [label, setLabel] = useState<"taught" | "reference">("taught");
  const [rawText, setRawText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/teacher/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label, rawText }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      router.push(`/teacher/notes/${data.materialId}`);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div>
        <span className="text-sm font-medium">Label</span>
        <div className="mt-1 flex gap-2">
          {(["taught", "reference"] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLabel(l)}
              className={
                label === l
                  ? "rounded-full bg-foreground text-background px-4 py-1.5 text-sm"
                  : "rounded-full border border-black/10 px-4 py-1.5 text-sm"
              }
            >
              {l === "taught" ? "Taught today" : "Reference"}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-sm font-medium" htmlFor="rawText">
          Your lesson notes
        </label>
        <textarea
          id="rawText"
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          rows={8}
          placeholder="Paste the notes you taught…"
          className="mt-1 w-full rounded-lg border border-black/10 p-3 text-base"
        />
      </div>

      <div>
        <span className="text-sm font-medium">Add from a file</span>
        <div className="mt-1 flex gap-2">
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-full border border-black/10 px-4 py-2 text-zinc-400"
          >
            Upload photo
          </button>
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-full border border-black/10 px-4 py-2 text-zinc-400"
          >
            Upload PDF
          </button>
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          Photo and PDF upload are not supported yet. Paste your notes as text
          for now.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={busy || rawText.trim().length < 20}
        className="rounded-full bg-foreground text-background px-5 py-2 disabled:opacity-50"
      >
        {busy ? "Saving…" : "Save & review"}
      </button>
    </form>
  );
}
