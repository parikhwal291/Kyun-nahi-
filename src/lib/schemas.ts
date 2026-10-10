import { z } from "zod";
import { ObjectId } from "mongodb";

/**
 * Zod schemas for our MongoDB entities (Person B owns the DB schema).
 * The TS types shared with Person A are derived from these in src/lib/types.ts.
 */

export const TeacherSchema = z.object({
  clerkId: z.string().min(1),
  name: z.string().min(1),
  email: z.email(),
  createdAt: z.date(),
});

export const SchoolClassSchema = z.object({
  teacherId: z.string().min(1),
  name: z.string().min(1),
  classCode: z.string().min(3).max(20),
  language: z.enum(["en", "hi"]),
  createdAt: z.date(),
});

export const StudentSchema = z.object({
  classId: z.instanceof(ObjectId),
  firstName: z.string().min(1).max(40),
  rollNumber: z.string().min(1).max(20),
  pinHash: z.string().min(1),
  createdAt: z.date(),
});

export const SessionSchema = z.object({
  sid: z.string().length(24),
  studentId: z.instanceof(ObjectId),
  classId: z.instanceof(ObjectId),
  createdAt: z.date(),
  expiresAt: z.date(),
  hardExpiresAt: z.date(),
});

/**
 * PROPOSED shared shape for a student's chat conversation (confirm with Person A,
 * who owns the AI chat route). Status flips to "done" when the student switches.
 */
export const ConversationSchema = z.object({
  sid: z.string().min(1),
  studentId: z.instanceof(ObjectId),
  classId: z.instanceof(ObjectId),
  status: z.enum(["active", "done"]),
  createdAt: z.date(),
});

// ---- Request input schemas ----

export const StudentLoginInputSchema = z.object({
  classCode: z.string().trim().min(3).max(20),
  rollNumber: z.string().trim().min(1).max(20),
  pin: z.string().trim().regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

export type StudentLoginInput = z.infer<typeof StudentLoginInputSchema>;
