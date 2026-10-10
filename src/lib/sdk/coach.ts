// src/lib/sdk/coach.ts
// Teacher coach (A6): a stateless Cline SDK Agent created per request. It exposes ONLY
// the five read-only coach tools (no file/shell/web tools, no builtin tools). The
// teacherId is captured in the closure, so ownership/scoping is enforced here — never
// from the model's tool arguments. Reasoning fields are never returned to the caller.

import { Agent, createTool } from "@cline/sdk";
import { z } from "zod";

import { MODELS } from "../ai/models";
import {
  getClassOverview,
  getConceptStats,
  getMisconceptions,
  getPrereqGaps,
  getReviewQueue,
} from "../ai/tools/coachData";

export type CoachLanguage = "en" | "hi";

export interface CoachToolTraceEntry {
  tool: string;
  args: unknown;
}

export interface CoachRunResult {
  answer: string;
  toolTrace: CoachToolTraceEntry[];
  status: string;
  error?: string;
}

export interface CoachRunOptions {
  teacherId: string;
  question: string;
  language: CoachLanguage;
  timeoutMs?: number;
}

const COACH_BASE_URL = "https://api.cline.bot/api/v1";
const COACH_MAX_ITERATIONS = 6;

// Errors are returned to the model as data (an { error } object) rather than thrown,
// so a single failing tool call can't abort the whole run.
async function asToolResult<T>(fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn();
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

export function buildSystemPrompt(language: CoachLanguage): string {
  const replyIn = language === "hi" ? "Hindi (Devanagari)" : "English";
  return [
    "You are a coach for an overloaded schoolteacher in India.",
    "You can only use the provided read-only tools, which return data about the teacher's own class. You have no file, shell, or web access.",
    "Rules:",
    "- Call the relevant tools before answering. Never invent data or numbers.",
    "- Cite the specific numbers you found (counts, confidence, misconception tags).",
    "- If the data is empty, or does not cover what the teacher asked, say so plainly instead of guessing.",
    "- Give a short, plain-language answer.",
    "- End with a 10-minute re-teach plan that uses an everyday village or small-town example (a roti, a field, a water tank, a market stall).",
    "- Keep the whole answer under 200 words.",
    `- Reply in ${replyIn}.`,
  ].join("\n");
}

export function createCoachAgent(teacherId: string, language: CoachLanguage) {
  const tools = [
    createTool({
      name: "get_class_overview",
      description:
        "Overall picture of this teacher's class: total evaluations, per-concept status counts (understood/shaky/not-yet), and each concept's top misconception. Call this first for any general question about the class.",
      inputSchema: z.object({}),
      execute: () => asToolResult(() => getClassOverview(teacherId)),
    }),
    createTool({
      name: "get_concept_stats",
      description:
        "Detailed stats for ONE concept: status counts, misconception clusters, and how many students show a prerequisite gap. Pass the exact conceptId returned by get_class_overview.",
      inputSchema: z.object({
        conceptId: z.string().describe("The exact conceptId from get_class_overview."),
      }),
      execute: (input) => asToolResult(() => getConceptStats(input.conceptId, teacherId)),
    }),
    createTool({
      name: "get_misconceptions",
      description:
        "Misconception clusters for ONE concept (tag, count, sample evaluation ids). Pass the exact conceptId returned by get_class_overview.",
      inputSchema: z.object({
        conceptId: z.string().describe("The exact conceptId from get_class_overview."),
      }),
      execute: (input) => asToolResult(() => getMisconceptions(input.conceptId, teacherId)),
    }),
    createTool({
      name: "get_review_queue",
      description:
        "Low-confidence evaluations that need the teacher's review, sorted ascending by confidence (least certain first).",
      inputSchema: z.object({}),
      execute: () => asToolResult(() => getReviewQueue(teacherId)),
    }),
    createTool({
      name: "get_prereq_gaps",
      description:
        "Concepts where students are missing prerequisite knowledge, with counts and sample gap notes.",
      inputSchema: z.object({}),
      execute: () => asToolResult(() => getPrereqGaps(teacherId)),
    }),
  ];

  const apiKey = process.env.CLINE_API_KEY;
  if (!apiKey) {
    throw new Error("CLINE_API_KEY is not set (server-side env).");
  }

  return new Agent({
    providerId: "openai-compatible",
    modelId: MODELS.teacherCoach.primary,
    apiKey,
    baseUrl: COACH_BASE_URL,
    systemPrompt: buildSystemPrompt(language),
    tools,
    toolPolicies: {
      get_class_overview: { autoApprove: true },
      get_concept_stats: { autoApprove: true },
      get_misconceptions: { autoApprove: true },
      get_review_queue: { autoApprove: true },
      get_prereq_gaps: { autoApprove: true },
    },
    maxIterations: COACH_MAX_ITERATIONS,
  });
}

export async function runCoach(options: CoachRunOptions): Promise<CoachRunResult> {
  const { teacherId, question, language, timeoutMs = 40_000 } = options;
  const agent = createCoachAgent(teacherId, language);

  const toolTrace: CoachToolTraceEntry[] = [];
  const unsubscribe = agent.subscribe((event) => {
    if (event.type === "tool-started") {
      toolTrace.push({
        tool: event.toolCall.toolName,
        args: event.toolCall.input ?? null,
      });
    }
  });

  try {
    const result = await withTimeout(agent.run(question), timeoutMs, () => agent.abort());

    if (result.status === "failed" || result.status === "aborted") {
      return {
        answer: "",
        toolTrace,
        status: result.status,
        error: result.error?.message ?? `Coach run ${result.status}.`,
      };
    }

    // Only the visible output text is returned. Reasoning fields (message parts,
    // usage, snapshots) are intentionally stripped.
    return { answer: result.outputText, toolTrace, status: result.status };
  } finally {
    unsubscribe();
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, onTimeout: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      onTimeout();
      reject(new Error(`Coach timed out after ${ms}ms`));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}
