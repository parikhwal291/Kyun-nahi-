import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "../db";
import type { Session } from "../types";

export const SESSION_COOKIE = "sid";
export const SESSION_TTL_MS = 30 * 60 * 1000; // sliding 30 minutes
export const SESSION_HARD_CAP_MS = 2 * 60 * 60 * 1000; // absolute 2-hour cap

/** What requireStudent() returns — scoped by the verified session. */
export type StudentSessionContext = {
  studentId: string;
  classId: string;
  sid: string;
};

export class StudentAuthError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "StudentAuthError";
  }
}

function getSecret(): string {
  const secret = process.env.STUDENT_SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "STUDENT_SESSION_SECRET is not set. Add it to .env.local (see .env.example).",
    );
  }
  return secret;
}

/** 24 URL-safe random characters (18 bytes -> 24 base64url chars). */
export function createSessionId(): string {
  return randomBytes(18).toString("base64url");
}

/** Signs a session id as "<id>.<HMAC-SHA256(id)>" for the cookie value. */
export function signSessionToken(sid: string): string {
  const hmac = createHmac("sha256", getSecret()).update(sid).digest("hex");
  return `${sid}.${hmac}`;
}

/** Verifies the HMAC and returns the session id, or null if invalid. */
export function verifySessionToken(token: string): string | null {
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const sid = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = createHmac("sha256", getSecret()).update(sid).digest("hex");
  const a = Buffer.from(provided, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? sid : null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    path: "/",
    secure: process.env.NODE_ENV === "production",
  };
}

/**
 * Loads the session from the cookie, verifies the HMAC, checks expiry, and
 * slides the 30-minute window on activity (never past the 2-hour hard cap,
 * derived from createdAt).
 */
export async function getSessionFromCookie(): Promise<Session | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const sid = verifySessionToken(token);
  if (!sid) return null;

  const db = await getDb();
  const session = await db.collection<Session>("sessions").findOne({ sid });
  if (!session) return null;

  const now = Date.now();
  if (session.expiresAt.getTime() <= now) return null;
  const hardCap = session.createdAt.getTime() + SESSION_HARD_CAP_MS;
  if (hardCap <= now) return null;

  const newExpiry = Math.min(now + SESSION_TTL_MS, hardCap);
  if (newExpiry > session.expiresAt.getTime()) {
    await db
      .collection<Session>("sessions")
      .updateOne({ sid }, { $set: { expiresAt: new Date(newExpiry) } });
  }

  return session;
}

/**
 * Guard for student routes. Verifies the session and returns the scoped
 * { studentId, classId, sid }, or throws StudentAuthError.
 */
export async function requireStudent(): Promise<StudentSessionContext> {
  const session = await getSessionFromCookie();
  if (!session) throw new StudentAuthError();
  return { studentId: session.studentId, classId: session.classId, sid: session.sid };
}

/**
 * Guard for /student/practice pages. Redirects to /student/login when there is
 * no valid session (mirrors requireTeacherPage on the teacher side).
 */
export async function requireStudentPage(): Promise<StudentSessionContext> {
  const session = await getSessionFromCookie();
  if (!session) redirect("/student/login");
  return { studentId: session.studentId, classId: session.classId, sid: session.sid };
}

