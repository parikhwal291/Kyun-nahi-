// src/lib/ai/tools/coachData.ts
// Teacher-coach data layer (A6). Plain functions that take a teacherId and return
// scoped, deterministic data for the coach agent. Ownership/scoping lives HERE,
// derived from the teacherId parameter — never from the model's tool arguments.
// They build on aggregateEvaluations over Evaluation[] from a single seam,
// loadEvaluationsForTeacher(teacherId), which Person B wires to MongoDB.

import {
  aggregateEvaluations,
  type ConceptAggregate,
  type MisconceptionCluster,
  type ReviewQueueItem,
} from "../jobs/aggregate";
import type { Evaluation } from "../../types";

// ---------------------------------------------------------------------------
// Seam (Person B): load a teacher's evaluations from the DB, re-scoped by
// teacherId. For now it returns a small built-in sample — every row is
// isSimulated: true so the UI shows the SIMULATED badge.
// ---------------------------------------------------------------------------
export async function loadEvaluationsForTeacher(teacherId: string): Promise<Evaluation[]> {
  void teacherId; // the scoping key once the DB is wired
  return SAMPLE_EVALUATIONS;
}

function sampleEval(
  id: string,
  conceptId: string,
  studentId: string,
  status: Evaluation["status"],
  confidence: number,
  opts: { misconceptionTag?: string; prereqGapNote?: string } = {},
): Evaluation {
  return {
    id,
    conversationId: `conv-${id}`,
    conceptId,
    studentId,
    status,
    reason: "",
    confidence,
    misconceptionTag: opts.misconceptionTag ?? null,
    prereqGapNote: opts.prereqGapNote ?? null,
    source: "ai",
    originalStatus: null,
    overriddenBy: null,
    overrideReason: null,
    isSimulated: true,
    createdAt: new Date("2026-10-10T00:00:00Z"),
  };
}

// 9 simulated evaluations across 3 concepts (fractions, water-cycle, photosynthesis).
const SAMPLE_EVALUATIONS: Evaluation[] = [
  sampleEval("e1", "fractions", "s1", "understood", 88),
  sampleEval("e2", "fractions", "s2", "shaky", 60, { misconceptionTag: "inverted-numerator" }),
  sampleEval("e3", "fractions", "s3", "not_yet", 45, {
    misconceptionTag: "inverted-numerator",
    prereqGapNote: "does not know numerator vs denominator",
  }),
  sampleEval("e4", "fractions", "s4", "understood", 91),
  sampleEval("e5", "water-cycle", "s5", "shaky", 55, { misconceptionTag: "clouds-are-smoke" }),
  sampleEval("e6", "water-cycle", "s6", "not_yet", 30, {
    misconceptionTag: "clouds-are-smoke",
    prereqGapNote: "evaporation concept missing",
  }),
  sampleEval("e7", "water-cycle", "s7", "understood", 84),
  sampleEval("e8", "photosynthesis", "s8", "understood", 95),
  sampleEval("e9", "photosynthesis", "s9", "shaky", 68, {
    misconceptionTag: "photosynthesis-needs-soil",
  }),
];

export interface ConceptOverview {
  conceptId: string;
  total: number;
  understood: number;
  shaky: number;
  notYet: number;
  topMisconception: string | null;
}

export interface ClassOverview {
  totalEvaluations: number;
  simulatedCount: number;
  conceptCount: number;
  reviewQueueSize: number;
  concepts: ConceptOverview[];
}

export async function getClassOverview(teacherId: string): Promise<ClassOverview> {
  const aggregate = aggregateEvaluations(await loadEvaluationsForTeacher(teacherId));
  return {
    totalEvaluations: aggregate.total,
    simulatedCount: aggregate.simulatedCount,
    conceptCount: aggregate.byConcept.length,
    reviewQueueSize: aggregate.reviewQueue.length,
    concepts: aggregate.byConcept.map((concept) => ({
      conceptId: concept.conceptId,
      total: concept.total,
      understood: concept.counts.understood,
      shaky: concept.counts.shaky,
      notYet: concept.counts.not_yet,
      topMisconception: concept.misconceptionClusters[0]?.tag ?? null,
    })),
  };
}

export async function getConceptStats(
  conceptId: string,
  teacherId: string,
): Promise<ConceptAggregate | null> {
  const aggregate = aggregateEvaluations(await loadEvaluationsForTeacher(teacherId));
  return aggregate.byConcept.find((concept) => concept.conceptId === conceptId) ?? null;
}

export async function getMisconceptions(
  conceptId: string,
  teacherId: string,
): Promise<MisconceptionCluster[]> {
  const aggregate = aggregateEvaluations(await loadEvaluationsForTeacher(teacherId));
  const concept = aggregate.byConcept.find((c) => c.conceptId === conceptId);
  return concept?.misconceptionClusters ?? [];
}

export async function getReviewQueue(teacherId: string): Promise<ReviewQueueItem[]> {
  const aggregate = aggregateEvaluations(await loadEvaluationsForTeacher(teacherId));
  return aggregate.reviewQueue;
}

export interface PrereqGap {
  conceptId: string;
  count: number;
  sampleNotes: string[];
}

export async function getPrereqGaps(teacherId: string): Promise<PrereqGap[]> {
  const evaluations = await loadEvaluationsForTeacher(teacherId);
  const byConcept = new Map<string, { count: number; notes: string[] }>();
  for (const evaluation of evaluations) {
    const note = evaluation.prereqGapNote?.trim();
    if (!note) continue;
    const gap = byConcept.get(evaluation.conceptId) ?? { count: 0, notes: [] };
    gap.count += 1;
    if (gap.notes.length < 3) gap.notes.push(note);
    byConcept.set(evaluation.conceptId, gap);
  }
  return [...byConcept.entries()]
    .map(([conceptId, gap]) => ({ conceptId, count: gap.count, sampleNotes: gap.notes }))
    .sort((a, b) => b.count - a.count || a.conceptId.localeCompare(b.conceptId));
}
