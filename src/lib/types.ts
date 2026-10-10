import type { ObjectId } from "mongodb";
import { z } from "zod";
import {
  ConversationSchema,
  SchoolClassSchema,
  SessionSchema,
  StudentSchema,
  TeacherSchema,
} from "./schemas";

/**
 * SHARED DATA SHAPES — single source of truth for types used across
 * Person A (src/lib/ai/*) and Person B (pages, auth, db).
 *
 * The DB entity types below are derived from the Zod schemas owned by
 * Person B (src/lib/schemas.ts). If you need a change to a shared shape,
 * propose it here rather than silently diverging.
 */

export type Teacher = z.infer<typeof TeacherSchema> & { _id: ObjectId };
export type SchoolClass = z.infer<typeof SchoolClassSchema> & { _id: ObjectId };
export type Student = z.infer<typeof StudentSchema> & { _id: ObjectId };
export type Session = z.infer<typeof SessionSchema> & { _id: ObjectId };
export type Conversation = z.infer<typeof ConversationSchema> & { _id: ObjectId };

export type Language = "en" | "hi";

/**
 * What requireStudent() returns. All student data access is scoped by these
 * ids, which come from the verified session — never from the request body.
 */
export type StudentSessionContext = {
  studentId: ObjectId;
  classId: ObjectId;
  sid: string;
};

/**
 * AI concept/evaluation shapes will be added by Person A as they build the
 * extraction, junior-chat, evaluation and coach routes.
 */
