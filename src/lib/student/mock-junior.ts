// src/lib/student/mock-junior.ts
//
// DEMO / MOCK adapter for the student "confused junior" chat and the evaluator.
// Person A owns the real AI (src/lib/ai/*) and the /api/chat/* routes. This
// produces the SAME response shapes as their contract — JuniorTurnResponse and
// EvaluateConversationResponse — so the student UI can be pointed at the real
// routes later without UI changes. It does NOT call any AI model.

import type {
  EvaluateConversationResponse,
  JuniorTurnResponse,
} from "../types";

export const MAX_STUDENT_TURNS = 4; // 3–5 turn cap

const QUESTIONS_EN = [
  "Hmm, I don't quite get it. Can you explain that again in simpler words?",
  "Wait — why does that happen? What causes it?",
  "What would happen if that step didn't happen?",
  "Can you give me one small example?",
];

const QUESTIONS_HI = [
  "हम्म, मुझे ठीक से समझ नहीं आया। थोड़े आसान शब्दों में फिर बताओ?",
  "रुको — ऐसा क्यों होता है? इसकी वजह क्या है?",
  "अगर वह कदम न होता तो क्या होता?",
  "एक छोटा सा उदाहरण दे सकते हो?",
];

const CLOSER_EN = "Thanks, that helped me understand it better!";
const CLOSER_HI = "धन्यवाद, अब मुझे थोड़ा समझ आया!";

export type ChatLanguage = "en" | "hi";

/** The confused junior's opening question (one question, never the answer). */
export function juniorOpening(title: string, language: ChatLanguage): string {
  return language === "hi"
    ? `नमस्ते! मैं थोड़ा confused हूँ। "${title}" के बारे में अपने शब्दों में बताओ?`
    : `Hi! I'm a little confused. Can you explain "${title}" to me in your own words?`;
}

/** The confused junior's reply after the student's turn (number 1..N). */
export function juniorReply(
  language: ChatLanguage,
  studentTurnNumber: number,
): JuniorTurnResponse {
  if (studentTurnNumber >= MAX_STUDENT_TURNS) {
    return {
      reply: language === "hi" ? CLOSER_HI : CLOSER_EN,
      done: true,
    };
  }
  const questions = language === "hi" ? QUESTIONS_HI : QUESTIONS_EN;
  return {
    reply: questions[(studentTurnNumber - 1) % questions.length],
    done: false,
  };
}

function reasonFor(
  status: "understood" | "shaky" | "not_yet",
  language: ChatLanguage,
): string {
  if (language === "hi") {
    if (status === "understood") return "मुख्य बात अपने शब्दों में अच्छे से समझाई।";
    if (status === "shaky") return "कुछ बातें सही थीं, लेकिन कदमों का क्रम उलझ गया।";
    return "जवाब रटा हुआ लग रहा है, समझा हुआ नहीं।";
  }
  if (status === "understood") return "Explained the main idea clearly in their own words.";
  if (status === "shaky") return "Got some parts right but mixed up the order of the steps.";
  return "The answers looked memorised rather than understood.";
}

/** Mock evaluation (same shape as EvaluateConversationResponse). */
export function mockEvaluate(
  language: ChatLanguage,
  studentMessages: string[],
  misconceptionLabel: string | null,
): EvaluateConversationResponse {
  const total = studentMessages.join(" ").trim().length;

  let status: "understood" | "shaky" | "not_yet";
  let confidence: number;
  if (total >= 160) {
    status = "understood";
    confidence = 86;
  } else if (total >= 60) {
    status = "shaky";
    confidence = 61;
  } else {
    status = "not_yet";
    confidence = 38;
  }

  return {
    status,
    reason: reasonFor(status, language),
    confidence,
    misconceptionTag: status === "understood" ? null : misconceptionLabel,
    prereqGapNote:
      status === "not_yet"
        ? language === "hi"
          ? "पहले का concept दोबारा देखना पड़ सकता है।"
          : "May need to revisit the earlier concept first."
        : null,
  };
}
