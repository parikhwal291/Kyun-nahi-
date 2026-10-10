// src/lib/ai/jobs/turn.ts
// "juniorTurn" job: concept + level + language + history + student message
// -> { reply, done }. The junior asks ONE question per turn and never reveals the
// answer. done is computed from the 5-student-turn cap; a distress/safety message
// short-circuits to a kind stop with done=true. If a reply nearly restates a rubric
// point (an answer reveal), we regenerate once.

import type { Concept, JuniorTurnResponse, Turn } from "@/lib/types";
import { MODELS } from "../models";
import { complete } from "../client";
import {
  buildJuniorTurnMessages,
  detectDistress,
  nearlyCopiesRubric,
  stopMessage,
} from "../prompts/junior";

export interface JuniorTurnInput {
  concept: Pick<Concept, "title" | "rubric" | "wrongIdeas">;
  level: Concept["level"];
  language: Concept["language"];
  history: Turn[];
  message: string;
}

const MAX_STUDENT_TURNS = 5;

export async function juniorTurn(input: JuniorTurnInput): Promise<JuniorTurnResponse> {
  const message = (input.message ?? "").trim();

  // Untrusted student text is checked deterministically BEFORE any model call.
  if (detectDistress(message)) {
    return { reply: stopMessage(input.language), done: true };
  }

  const studentTurnCount =
    input.history.filter((turn) => turn.role === "student").length + (message.length > 0 ? 1 : 0);
  const done = studentTurnCount >= MAX_STUDENT_TURNS;

  const reply = await generateReply(input, done);
  return { reply, done };
}

async function generateReply(input: JuniorTurnInput, done: boolean): Promise<string> {
  const baseMessages = buildJuniorTurnMessages(input, { done });
  const callOpts = {
    model: MODELS.juniorTurn.primary,
    fallback: MODELS.juniorTurn.fallback,
    temperature: 0.7,
    maxTokens: MODELS.juniorTurn.maxTokens,
    timeoutMs: MODELS.juniorTurn.timeoutMs,
  };

  const first = await complete({ ...callOpts, messages: baseMessages });
  const reply = first.text.trim();

  // A final closing is not a question, so only check non-final replies for leaking
  // the answer. Regenerate ONCE with an explicit "don't restate the material" nudge.
  if (!done && nearlyCopiesRubric(reply, input.concept.rubric)) {
    const retry = await complete({
      ...callOpts,
      messages: [
        ...baseMessages,
        { role: "assistant", content: reply },
        {
          role: "user",
          content:
            "That reply restated the material and gave away the answer. Ask ONE new question that does NOT repeat any of the material's goals or confusions.",
        },
      ],
    });
    return retry.text.trim();
  }

  return reply;
}
