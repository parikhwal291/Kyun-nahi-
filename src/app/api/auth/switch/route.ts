import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  requireStudent,
  SESSION_COOKIE,
  sessionCookieOptions,
  type StudentSessionContext,
} from "@/lib/auth/student";
import type { Conversation, Session } from "@/lib/types";

/**
 * Ends the current student session: marks any active conversation done,
 * deletes the Session record, clears the cookie, and returns a JSON redirect
 * target so the client can navigate to /student/login.
 */
export async function POST() {
  let ctx: StudentSessionContext | null = null;
  try {
    ctx = await requireStudent();
  } catch {
    // No valid session — still clear the cookie below.
  }

  const db = await getDb();

  if (ctx) {
    await db.collection<Conversation>("conversations").updateMany(
      { studentId: ctx.studentId, status: "active" },
      { $set: { status: "done", endedReason: "switched", endedAt: new Date() } },
    );
    await db.collection<Session>("sessions").deleteOne({ sid: ctx.sid });
  }

  const res = NextResponse.json({ ok: true, redirect: "/student/login" });
  res.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}

