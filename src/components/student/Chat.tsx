"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

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

// Friendly, non-leaky messages keyed by the API's error codes.
function messageFor(status: number, code: unknown): string {
  if (status === 401) return "Your session ended. Please sign in again.";
  if (code === "conversation_not_active" || code === "conversation_not_done")
    return "This chat has already finished.";
  if (code === "not_found") return "We couldn't find this chat.";
  if (code === "ai_failed")
    return "The junior is having trouble right now. Please try again.";
  return "Something went wrong. Please try again.";
}

export default function Chat({
  conversationId,
  conceptTitle,
  initialTurns,
  initiallyDone = false,
}: {
  conversationId: string;
  conceptTitle: string;
  initialTurns: TurnView[];
  initiallyDone?: boolean;
}) {
  const router = useRouter();
  const [turns, setTurns] = useState<TurnView[]>(initialTurns);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(initiallyDone);
  const [evaluating, setEvaluating] = useState(false);
  const [evaluation, setEvaluation] = useState<EvalView | null>(null);
  const [evalFailed, setEvalFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real endpoint: POST /api/chat/evaluate { conversationId } -> evaluation.
  // Safe to retry: the server is idempotent per conversation.
  async function evaluate() {
    setEvaluating(true);
    setEvalFailed(false);
    setError(null);
    try {
      const res = await fetch("/api/chat/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || typeof data.status !== "string") {
        setEvalFailed(true);
        setError(messageFor(res.status, data?.error));
        return;
      }
      setEvaluation({
        status: data.status,
        reason: data.reason,
        confidence: data.confidence,
        misconceptionTag: data.misconceptionTag ?? null,
      });
    } catch {
      setEvalFailed(true);
      setError("Could not reach the server. Please try again.");
    } finally {
      setEvaluating(false);
    }
  }

  // Reloading a finished conversation: fetch its (idempotent) evaluation once.
  const autoEvaluated = useRef(false);
  useEffect(() => {
    if (initiallyDone && !autoEvaluated.current) {
      autoEvaluated.current = true;
      void evaluate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Real endpoint: POST /api/chat/turn { conversationId, message } -> { reply, done }.
  async function send() {
    const message = input.trim();
    if (!message || busy || done) return;
    setBusy(true);
    setError(null);
    setInput("");
    setTurns((prev) => [...prev, { role: "student", text: message }]);

    // Roll back the optimistic bubble so the student can retry the same message.
    const rollback = () => {
      setTurns((prev) => prev.slice(0, -1));
      setInput(message);
    };

    try {
      const res = await fetch("/api/chat/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId, message }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || typeof data.reply !== "string") {
        // A finished chat can't take more turns: don't offer a retry.
        if (data?.error === "conversation_not_active") {
          setDone(true);
          rollback();
          setInput("");
          setError(messageFor(res.status, data.error));
          await evaluate();
          return;
        }
        rollback();
        setError(messageFor(res.status, data?.error));
        return;
      }
      setTurns((prev) => [...prev, { role: "junior", text: data.reply }]);
      if (data.done) {
        setDone(true);
        await evaluate();
      }
    } catch {
      rollback();
      setError("Could not reach the server. Please try again.");
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
          {/* Real AI evaluation (isSimulated:false) — deliberately NO SIMULATED
              badge here; that label is only for seeded demo rows on the dashboard. */}
          <div className="font-semibold capitalize">
            {evaluation.status.replace("_", " ")}
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
      ) : evalFailed ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={evaluate}
            disabled={evaluating}
            className="w-full rounded-full bg-foreground text-background px-5 py-3 font-semibold disabled:opacity-50"
          >
            {evaluating ? "Trying again…" : "Try again"}
          </button>
          <button
            type="button"
            onClick={switchStudent}
            className="w-full rounded-full border border-black/10 px-5 py-3"
          >
            Switch student
          </button>
        </div>
      ) : (
        <p className="text-sm text-zinc-600" role="status">
          {evaluating ? "Checking your explanation…" : "Finishing up…"}
        </p>
      )}

      {busy && !done && (
        <p className="text-sm text-zinc-600" role="status">
          The junior is thinking…
        </p>
      )}

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
