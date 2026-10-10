"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import SimulatedBadge from "@/components/SimulatedBadge";

interface TurnView {
  role: "junior" | "student";
  text: string;
}

interface EvalView {
  status: string;
  reason: string;
  confidence: number;
  misconceptionTag: string | null;
}

export default function Chat({
  conversationId,
  conceptTitle,
  initialTurns,
}: {
  conversationId: string;
  conceptTitle: string;
  initialTurns: TurnView[];
}) {
  const router = useRouter();
  const [turns, setTurns] = useState<TurnView[]>(initialTurns);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [evaluation, setEvaluation] = useState<EvalView | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function evaluate() {
    try {
      const res = await fetch(
        `/api/student/conversations/${conversationId}/evaluate`,
        { method: "POST" },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not evaluate.");
        return;
      }
      setEvaluation({
        status: data.status,
        reason: data.reason,
        confidence: data.confidence,
        misconceptionTag: data.misconceptionTag,
      });
    } catch {
      setError("Could not evaluate.");
    }
  }

  async function send() {
    const message = input.trim();
    if (!message || busy || done) return;
    setInput("");
    setBusy(true);
    setError(null);
    setTurns((prev) => [...prev, { role: "student", text: message }]);
    try {
      const res = await fetch(
        `/api/student/conversations/${conversationId}/turn`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not send.");
        return;
      }
      setTurns((prev) => [...prev, { role: "junior", text: data.reply }]);
      if (data.done) {
        setDone(true);
        await evaluate();
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  async function switchStudent() {
    await fetch("/api/auth/switch", { method: "POST" }).catch(() => {});
    router.push("/student/login");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="font-semibold">{conceptTitle}</div>

      <div className="space-y-2">
        {turns.map((t, i) => (
          <div key={i} className={t.role === "student" ? "ml-8" : "mr-8"}>
            <div
              className={
                "rounded-lg p-3 text-sm " +
                (t.role === "student"
                  ? "bg-foreground text-background"
                  : "border border-black/10")
              }
            >
              <div className="text-xs font-medium opacity-70">
                {t.role === "student" ? "You" : "Confused junior"}
              </div>
              {t.text}
            </div>
          </div>
        ))}
      </div>

      {!done ? (
        <form
          onSubmit={(e: FormEvent<HTMLFormElement>) => {
            e.preventDefault();
            send();
          }}
          className="flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Explain in your own words…"
            className="flex-1 rounded-lg border border-black/10 p-3 text-base"
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            className="rounded-full bg-foreground text-background px-4 disabled:opacity-50"
          >
            {busy ? "…" : "Send"}
          </button>
        </form>
      ) : evaluation ? (
        <div className="rounded-lg border border-black/10 p-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold capitalize">
              {evaluation.status.replace("_", " ")}
            </span>
            <SimulatedBadge />
          </div>
          <p className="mt-2 text-sm">{evaluation.reason}</p>
          <div className="mt-2 text-xs text-zinc-500">
            Confidence: {evaluation.confidence}%
          </div>
          {evaluation.misconceptionTag && (
            <div className="mt-1 text-xs text-zinc-500">
              Misconception: {evaluation.misconceptionTag}
            </div>
          )}
          <button
            onClick={switchStudent}
            className="mt-4 w-full rounded-full bg-foreground text-background px-5 py-3 font-semibold"
          >
            Switch student
          </button>
        </div>
      ) : (
        <p className="text-sm text-zinc-600">Finishing up…</p>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
