// src/lib/types.ts
// Shared Zod schemas + inferred types — the single source of truth for the contract.
// The DB layer (native mongodb driver) parses documents with these; API routes use
// them for request/response validation. Change a schema here before touching code.
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared enums
// ---------------------------------------------------------------------------
export const LEVELS = ["primary", "middle", "secondary"] as const; // "middle" cut from demo build
export const LANGUAGES = ["en", "hi"] as const;
export const EVAL_STATUSES = ["understood", "shaky", "not_yet"] as const;

// ---------------------------------------------------------------------------
// Domain documents (MongoDB collections)
// ---------------------------------------------------------------------------
export const TeacherSchema = z.object({
  id: z.string(),
  clerkUserId: z.string(), // Clerk holds the credential; this row is a slim profile
  email: z.string().email(),
  name: z.string(),
  createdAt: z.coerce.date(),
});

export const SchoolClassSchema = z.object({
  id: z.string(),
  teacherId: z.string(), // scoping key: every downstream row hangs off a class
  name: z.string(),
  grade: z.number().int().min(1).max(12),
  classCode: z.string().min(4).max(12), // short unique invite code, e.g. "RAIN7"
  defaultLanguage: z.enum(LANGUAGES),
  createdAt: z.coerce.date(),
});

export const StudentSchema = z.object({
  id: z.string(),
  classId: z.string(),
  rollNumber: z.number().int().positive(),
  alias: z.string(), // NOT a full name — minimize PII
  pinHash: z.string(), // "scrypt:16384:8:1:<saltB64>:<hashB64>" (crypto.scrypt)
  active: z.boolean(),
  isSimulated: z.boolean(), // seeded rows set true + show the SIMULATED badge
  createdAt: z.coerce.date(),
});

export const SessionSchema = z.object({
  sid: z.string(), // opaque token, source of truth; cookie = "<sid>.<HMAC(sid, SECRET)>"
  studentId: z.string(),
  classId: z.string(),
  createdAt: z.coerce.date(),
  expiresAt: z.coerce.date(), // 30-min sliding TTL, 2h absolute cap
});

export const MaterialSchema = z.object({
  id: z.string(),
  classId: z.string(),
  teacherId: z.string(),
  label: z.enum(["taught", "reference"]),
  sourceType: z.enum(["text", "photo", "pdf"]), // photo/pdf supported by schema, cut from demo
  rawText: z.string(), // as pasted by teacher (pre-confirmation)
  confirmedText: z.string(), // empty until teacher confirms
  status: z.enum(["draft", "confirmed"]),
  createdAt: z.coerce.date(),
  confirmedAt: z.coerce.date().nullable(),
});

export const RubricItemSchema = z.object({ point: z.string() });
export const WrongIdeaSchema = z.object({
  label: z.string(), // short misconception tag (used for clustering)
  description: z.string(),
});

export const ConceptSchema = z.object({
  id: z.string(),
  classId: z.string(),
  materialId: z.string(),
  title: z.string(),
  level: z.enum(LEVELS),
  language: z.enum(LANGUAGES),
  rubric: z.array(RubricItemSchema),
  wrongIdeas: z.array(WrongIdeaSchema),
  prereqConceptId: z.string().nullable(), // self-FK, "from an earlier class" → gap detection
  status: z.enum(["draft", "approved"]),
  approvedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
});

export const TurnSchema = z.object({
  role: z.enum(["junior", "student"]),
  text: z.string(),
  at: z.coerce.date(),
});

export const ConversationSchema = z.object({
  id: z.string(),
  conceptId: z.string(),
  studentId: z.string(),
  language: z.enum(LANGUAGES),
  level: z.enum(LEVELS),
  turns: z.array(TurnSchema),
  turnCount: z.number().int(), // cap 5 student turns
  status: z.enum(["active", "done"]),
  endedReason: z.enum(["completed", "switched", "abandoned"]).nullable(),
  createdAt: z.coerce.date(),
  endedAt: z.coerce.date().nullable(),
});

export const EvaluationSchema = z.object({
  id: z.string(),
  conversationId: z.string(),
  conceptId: z.string(),
  studentId: z.string(),
  status: z.enum(EVAL_STATUSES),
  reason: z.string(),
  confidence: z.number().int().min(0).max(100), // <70 → review queue
  misconceptionTag: z.string().nullable(), // → Concept.wrongIdeas[].label
  prereqGapNote: z.string().nullable(),
  source: z.enum(["ai", "teacher"]),
  originalStatus: z.enum(EVAL_STATUSES).nullable(), // AI value kept on override
  overriddenBy: z.string().nullable(),
  overrideReason: z.string().nullable(),
  isSimulated: z.boolean(),
  createdAt: z.coerce.date(),
});

// ---------------------------------------------------------------------------
// AI job request / response shapes
// ---------------------------------------------------------------------------
export const ExtractConceptsRequestSchema = z.object({
  materialId: z.string(), // confirmedText loaded server-side by id
});

export const ExtractConceptsResponseSchema = z.object({
  concepts: z.array(
    z.object({
      title: z.string(),
      level: z.enum(LEVELS),
      language: z.enum(LANGUAGES),
      rubric: z.array(RubricItemSchema),
      wrongIdeas: z.array(WrongIdeaSchema),
      prereqSuggestion: z.string().nullable(),
      prereqClassHint: z.string().nullable(),
    })
  ),
});

export const JuniorTurnRequestSchema = z.object({
  conversationId: z.string(),
  message: z.string().min(1).max(2000),
});

export const JuniorTurnResponseSchema = z.object({
  reply: z.string(),
  done: z.boolean(), // true when the 3–5-turn cap is reached
});

export const EvaluateConversationRequestSchema = z.object({
  conversationId: z.string(),
});

export const EvaluateConversationResponseSchema = z.object({
  status: z.enum(EVAL_STATUSES),
  reason: z.string(),
  confidence: z.number().int().min(0).max(100),
  misconceptionTag: z.string().nullable(),
  prereqGapNote: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------
export type Teacher = z.infer<typeof TeacherSchema>;
export type SchoolClass = z.infer<typeof SchoolClassSchema>;
export type Student = z.infer<typeof StudentSchema>;
export type Session = z.infer<typeof SessionSchema>;
export type Material = z.infer<typeof MaterialSchema>;
export type RubricItem = z.infer<typeof RubricItemSchema>;
export type WrongIdea = z.infer<typeof WrongIdeaSchema>;
export type Concept = z.infer<typeof ConceptSchema>;
export type Turn = z.infer<typeof TurnSchema>;
export type Conversation = z.infer<typeof ConversationSchema>;
export type Evaluation = z.infer<typeof EvaluationSchema>;
export type ExtractConceptsRequest = z.infer<typeof ExtractConceptsRequestSchema>;
export type ExtractConceptsResponse = z.infer<typeof ExtractConceptsResponseSchema>;
export type JuniorTurnRequest = z.infer<typeof JuniorTurnRequestSchema>;
export type JuniorTurnResponse = z.infer<typeof JuniorTurnResponseSchema>;
export type EvaluateConversationRequest = z.infer<typeof EvaluateConversationRequestSchema>;
export type EvaluateConversationResponse = z.infer<typeof EvaluateConversationResponseSchema>;

