// src/lib/ai/jobs/aggregate.ts
// "aggregateEvaluations" job: a pure, deterministic roll-up of Evaluation rows for the
// teacher dashboard. No model calls — this is the dashboard aggregate helper (A5).
// Groups by concept and produces, per concept: status counts (understood / shaky /
// not_yet), misconception clusters (misconceptionTag -> count + sample evaluation ids),
// and foundational-gap counts (evaluations with a non-empty prereqGapNote). It also
// returns the cross-concept review queue (confidence < 70, sorted ascending) and how
// many rows are simulated, so the UI can show the SIMULATED badge.

import type { Evaluation } from "@/lib/types";

export interface ConceptStatusCounts {
  understood: number;
  shaky: number;
  not_yet: number;
}

export interface MisconceptionCluster {
  tag: string; // matches Concept.wrongIdeas[].label
  count: number;
  sampleEvaluationIds: string[]; // up to MAX_SAMPLES, first in input order
}

export interface ConceptAggregate {
  conceptId: string;
  counts: ConceptStatusCounts;
  total: number;
  misconceptionClusters: MisconceptionCluster[];
  foundationalGapCount: number; // evaluations with a non-empty prereqGapNote
}

export interface ReviewQueueItem {
  evaluationId: string;
  conceptId: string;
  studentId: string;
  status: Evaluation["status"];
  confidence: number;
  misconceptionTag: string | null;
  prereqGapNote: string | null;
  isSimulated: boolean;
}

export interface EvaluationAggregate {
  total: number;
  simulatedCount: number;
  byConcept: ConceptAggregate[]; // sorted by conceptId
  reviewQueue: ReviewQueueItem[]; // sorted ascending by confidence
}

// How many evaluation ids to keep per misconception cluster (enough for the dashboard
// chip's tooltip, without bloating the payload).
const MAX_SAMPLES = 3;
const LOW_CONFIDENCE_THRESHOLD = 70;

function hasText(value: string | null): value is string {
  return value !== null && value.trim().length > 0;
}

export function aggregateEvaluations(evaluations: Evaluation[]): EvaluationAggregate {
  const byConceptMap = new Map<string, Evaluation[]>();
  for (const evaluation of evaluations) {
    const rows = byConceptMap.get(evaluation.conceptId);
    if (rows) rows.push(evaluation);
    else byConceptMap.set(evaluation.conceptId, [evaluation]);
  }

  const byConcept: ConceptAggregate[] = [];
  for (const [conceptId, rows] of byConceptMap) {
    const counts: ConceptStatusCounts = { understood: 0, shaky: 0, not_yet: 0 };
    const clusterMap = new Map<string, { count: number; sampleEvaluationIds: string[] }>();
    let foundationalGapCount = 0;

    for (const row of rows) {
      counts[row.status] += 1;

      if (hasText(row.misconceptionTag)) {
        const cluster = clusterMap.get(row.misconceptionTag) ?? {
          count: 0,
          sampleEvaluationIds: [],
        };
        cluster.count += 1;
        if (cluster.sampleEvaluationIds.length < MAX_SAMPLES) {
          cluster.sampleEvaluationIds.push(row.id);
        }
        clusterMap.set(row.misconceptionTag, cluster);
      }

      if (hasText(row.prereqGapNote)) foundationalGapCount += 1;
    }

    const misconceptionClusters: MisconceptionCluster[] = [...clusterMap.entries()]
      .map(([tag, cluster]) => ({
        tag,
        count: cluster.count,
        sampleEvaluationIds: cluster.sampleEvaluationIds,
      }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

    byConcept.push({
      conceptId,
      counts,
      total: rows.length,
      misconceptionClusters,
      foundationalGapCount,
    });
  }
  byConcept.sort((a, b) => a.conceptId.localeCompare(b.conceptId));

  const reviewQueue: ReviewQueueItem[] = evaluations
    .filter((evaluation) => evaluation.confidence < LOW_CONFIDENCE_THRESHOLD)
    .map((evaluation) => ({
      evaluationId: evaluation.id,
      conceptId: evaluation.conceptId,
      studentId: evaluation.studentId,
      status: evaluation.status,
      confidence: evaluation.confidence,
      misconceptionTag: evaluation.misconceptionTag,
      prereqGapNote: evaluation.prereqGapNote,
      isSimulated: evaluation.isSimulated,
    }))
    .sort((a, b) => a.confidence - b.confidence || a.evaluationId.localeCompare(b.evaluationId));

  const simulatedCount = evaluations.filter((evaluation) => evaluation.isSimulated).length;

  return {
    total: evaluations.length,
    simulatedCount,
    byConcept,
    reviewQueue,
  };
}
