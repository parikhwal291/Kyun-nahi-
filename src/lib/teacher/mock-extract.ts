// src/lib/teacher/mock-extract.ts
//
// DEMO / MOCK extraction only. Person A owns the real AI extraction
// (src/lib/ai/* and the extraction API route). This placeholder turns pasted
// notes into ONE plausible concept so the confirm + approve flow can be
// demonstrated before the AI route lands. It does NOT call any AI model, and
// the UI labels its output as a mock.

import type { RubricItem, WrongIdea } from "../types";

export interface MockExtraction {
  title: string;
  level: "primary" | "secondary";
  language: "en" | "hi";
  rubric: RubricItem[];
  wrongIdeas: WrongIdea[];
}

function sentences(text: string): string[] {
  return text
    .split(/(?:[.!?\n]+)/)
    .map((s) => s.trim())
    .filter((s) => s.split(/\s+/).length >= 4);
}

function guessLevel(text: string): "primary" | "secondary" {
  if (/force|motion|newton|velocity|acceleration|gravity|momentum|energy/i.test(text)) {
    return "secondary";
  }
  return "primary";
}

export function mockExtract(rawText: string): MockExtraction {
  const parts = sentences(rawText);
  const first = parts[0] ?? rawText.trim();
  const words = first.split(/\s+/);
  const title = words.slice(0, 8).join(" ") + (words.length > 8 ? "…" : "");

  const rubric: RubricItem[] = parts.slice(0, 4).map((s) => ({ point: s }));

  const wrongIdeas: WrongIdea[] = [
    { label: "Mixes up key terms", description: "May swap or confuse the main terms in these notes." },
    { label: "Misses a step", description: "May leave out one step in the order of events." },
  ];

  return {
    title: title || "New concept",
    level: guessLevel(rawText),
    language: "en",
    rubric,
    wrongIdeas,
  };
}
