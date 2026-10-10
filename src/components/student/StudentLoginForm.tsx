"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function StudentLoginForm() {
  const router = useRouter();
  const [classCode, setClassCode] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/student-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          classCode,
          rollNumber: Number(rollNumber),
          pin,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || "Incorrect class code, roll number, or PIN.");
        return;
      }
      router.push("/student/practice");
      router.refresh();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-3">
      <div>
        <label className="text-sm font-medium" htmlFor="classCode">
          Class code
        </label>
        <input
          id="classCode"
          value={classCode}
          onChange={(e) => setClassCode(e.target.value.toUpperCase())}
          className="mt-1 w-full rounded-lg border border-black/10 p-3"
          placeholder="RAIN7"
          autoCapitalize="characters"
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="rollNumber">
          Roll number
        </label>
        <input
          id="rollNumber"
          type="number"
          min={1}
          inputMode="numeric"
          value={rollNumber}
          onChange={(e) => setRollNumber(e.target.value)}
          className="mt-1 w-full rounded-lg border border-black/10 p-3"
          placeholder="7"
        />
      </div>
      <div>
        <label className="text-sm font-medium" htmlFor="pin">
          4-digit PIN
        </label>
        <input
          id="pin"
          type="password"
          inputMode="numeric"
          maxLength={4}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="mt-1 w-full rounded-lg border border-black/10 p-3"
          placeholder="••••"
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-full bg-foreground text-background px-5 py-3 disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
