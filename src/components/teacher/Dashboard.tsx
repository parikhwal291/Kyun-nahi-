"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import SimulatedBadge from "@/components/SimulatedBadge";

export interface ConceptView {
  conceptId: string;
  title: string;
  counts: { understood: number; shaky: number; not_yet: number };
  total: number;
  misconceptionClusters: { tag: string; count: number }[];
  foundationalGapCount: number;
}

export interface ReviewItemView {
  evaluationId: string;
  conceptTitle: string;
  studentAlias: string;
  status: "understood" | "shaky" | "not_yet";
  confidence: number;
  misconceptionTag: string | null;
  isSimulated: boolean;
  source: "ai" | "teacher";
  originalStatus: "understood" | "shaky" | "not_yet" | null;
}

const STATUSES: ("understood" | "shaky" | "not_yet")[] = [
  "understood",
  "shaky",
  "not_yet",
];

function statusLabel(status: string): string {
  return status === "not_yet"
    ? "Not yet"
    : status === "shaky"
      ? "Shaky"
      : "Understood";
}

export default function Dashboard({
  concepts,
  reviewQueue,
  total,
  simulatedCount,
}: {
  concepts: ConceptView[];
  reviewQueue: ReviewItemView[];
  total: number;
  simulatedCount: number;
}) {
  return (
    <div className="mt-4 space-y-6">
      <section className="rounded-lg border border-black/10 p-4">
        <div className="flex items-center justify-between">
          <span className="font-semibold">Evaluations</span>
          <span className="text-sm text-zinc-600">
            {total} total · {simulatedCount} simulated
          </span>
        </div>
        {simulatedCount > 0 && (
          <div className="mt-2 flex items-center gap-2">
            <SimulatedBadge />
            <span className="text-xs text-zinc-500">
              Includes {simulatedCount} simulated demo record
              {simulatedCount === 1 ? "" : "s"} — not real student outcomes.
            </span>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-medium">By concept</h2>
        {concepts.length === 0 ? (
          <p className="mt-1 text-zinc-600">No evaluations yet.</p>
        ) : (
          <div className="mt-2 space-y-3">
            {concepts.map((c) => (
              <div
                key={c.conceptId}
                className="rounded-lg border border-black/10 p-3"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{c.title}</div>
                  <div className="text-xs text-zinc-500">{c.total} total</div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-md bg-green-100 p-2">
                    <div className="font-semibold text-green-800">
                      {c.counts.understood}
                    </div>
                    <div className="text-xs text-green-700">Understood</div>
                  </div>
                  <div className="rounded-md bg-amber-100 p-2">
                    <div className="font-semibold text-amber-800">
                      {c.counts.shaky}
                    </div>
                    <div className="text-xs text-amber-700">Shaky</div>
                  </div>
                  <div className="rounded-md bg-red-100 p-2">
                    <div className="font-semibold text-red-800">
                      {c.counts.not_yet}
                    </div>
                    <div className="text-xs text-red-700">Not yet</div>
                  </div>
                </div>
                {c.misconceptionClusters.length > 0 && (
                  <div className="mt-2">
                    <div className="text-xs font-medium text-zinc-500">
                      Common wrong ideas
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {c.misconceptionClusters.map((m) => (
                        <span
                          key={m.tag}
                          className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs"
                        >
                          {m.tag} × {m.count}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
                {c.foundationalGapCount > 0 && (
                  <div className="mt-2 text-xs text-zinc-500">
                    Foundational gap flagged: {c.foundationalGapCount}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-medium">Review queue</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Low-confidence results (confidence &lt; 70) — you have the final word.
        </p>
        {reviewQueue.length === 0 ? (
          <p className="mt-1 text-zinc-600">Nothing to review.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {reviewQueue.map((item) => (
              <ReviewItem key={item.evaluationId} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function ReviewItem({ item }: { item: ReviewItemView }) {
  const router = useRouter();
  const [status, setStatus] = useState<"understood" | "shaky" | "not_yet">(
    item.status,
  );
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/teacher/evaluations/${item.evaluationId}/override`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, overrideReason: reason }),
        },
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Could not save override.");
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
    <div className="rounded-lg border border-black/10 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-semibold">{item.conceptTitle}</div>
        {item.isSimulated && <SimulatedBadge />}
      </div>
      <div className="mt-1 text-xs text-zinc-600">
        {item.studentAlias} · confidence {item.confidence}% ·{" "}
        {item.source === "teacher" ? (
          <span className="font-medium">
            overridden by you
            {item.originalStatus
              ? ` (was ${statusLabel(item.originalStatus)})`
              : ""}
          </span>
        ) : (
          <span>
            AI said{" "}
            <span className="font-medium">{statusLabel(item.status)}</span>
          </span>
        )}
      </div>
      {item.misconceptionTag && (
        <div className="mt-1 text-xs text-zinc-500">
          Misconception: {item.misconceptionTag}
        </div>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(s)}
            className={
              status === s
                ? "rounded-full bg-foreground text-background px-3 py-1 text-xs"
                : "rounded-full border border-black/10 px-3 py-1 text-xs"
            }
          >
            {statusLabel(s)}
          </button>
        ))}
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Reason (optional)"
          className="min-w-0 flex-1 rounded-lg border border-black/10 px-2 py-1 text-xs"
        />
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="rounded-full bg-foreground text-background px-3 py-1 text-xs disabled:opacity-50"
        >
          {busy ? "Saving…" : "Save override"}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

