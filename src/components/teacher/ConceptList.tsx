"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ConceptSummary {
  id: string;
  title: string;
  level: string;
  status: "draft" | "approved";
  rubric: { point: string }[];
  wrongIdeas: { label: string; description: string }[];
}

export default function ConceptList({
  concepts,
}: {
  concepts: ConceptSummary[];
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function approve(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/teacher/concepts/${id}/approve`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not approve.");
        return;
      }
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusyId(null);
    }
  }

  if (concepts.length === 0) {
    return (
      <p className="mt-4 text-zinc-600">
        No concepts yet. Paste some notes first.
      </p>
    );
  }

  return (
    <div className="mt-4 space-y-3">
      {concepts.map((c) => (
        <div key={c.id} className="rounded-lg border border-black/10 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="font-semibold">{c.title}</div>
            {c.status === "approved" ? (
              <span className="text-xs font-medium text-green-700">Approved</span>
            ) : (
              <button
                onClick={() => approve(c.id)}
                disabled={busyId === c.id}
                className="rounded-full bg-foreground text-background px-4 py-1.5 text-sm disabled:opacity-50"
              >
                {busyId === c.id ? "Approving…" : "Approve"}
              </button>
            )}
          </div>
          <div className="text-xs text-zinc-500">Level: {c.level}</div>
          <div className="mt-2 text-sm">
            <span className="font-medium">Rubric:</span>
            <ul className="ml-5 list-disc">
              {c.rubric.map((r, i) => (
                <li key={i}>{r.point}</li>
              ))}
            </ul>
          </div>
          <div className="mt-1 text-sm">
            <span className="font-medium">Wrong-idea tags:</span>
            <ul className="ml-5 list-disc">
              {c.wrongIdeas.map((w, i) => (
                <li key={i}>{w.label}</li>
              ))}
            </ul>
          </div>
        </div>
      ))}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
