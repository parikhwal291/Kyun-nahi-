"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface ConceptOption {
  id: string;
  title: string;
  level: string;
}

export default function PracticePicker({
  concepts,
}: {
  concepts: ConceptOption[];
}) {
  const router = useRouter();
  const [language, setLanguage] = useState<"en" | "hi">("en");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(conceptId: string) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/student/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conceptId, language }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not start.");
        return;
      }
      router.push(`/student/practice/${data.conversationId}`);
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-4">
      <div className="text-sm font-medium">Explain in which language?</div>
      <div className="mt-2 flex gap-2">
        {(["en", "hi"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLanguage(l)}
            className={
              language === l
                ? "rounded-full bg-foreground text-background px-4 py-1.5 text-sm"
                : "rounded-full border border-black/10 px-4 py-1.5 text-sm"
            }
          >
            {l === "en" ? "English" : "हिंदी"}
          </button>
        ))}
      </div>

      <div className="mt-4 text-sm font-medium">Pick a concept</div>
      {concepts.length === 0 ? (
        <p className="mt-2 text-zinc-600">
          No approved concepts yet. Ask your teacher.
        </p>
      ) : (
        <div className="mt-2 space-y-2">
          {concepts.map((c) => (
            <button
              key={c.id}
              type="button"
              disabled={busy}
              onClick={() => start(c.id)}
              className="w-full rounded-lg border border-black/10 p-3 text-left disabled:opacity-50"
            >
              <div className="font-semibold">{c.title}</div>
              <div className="text-xs text-zinc-500">{c.level}</div>
            </button>
          ))}
        </div>
      )}
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
