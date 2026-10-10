import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  verifySessionToken,
} from "@/lib/auth/student";
import type { Conversation, Session } from "@/lib/types";

/**
 * Ends the current student session: deletes the Session record, clears the
 * cookie, and marks any active conversation as done. Returns a JSON redirect
 * target so the client can navigate to /student/login.
 */
export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;

  let sid: string | null = null;
  if (token) {
    sid = verifySessionToken(token);
  }

  const db = await getDb();

  if (sid) {
    await db
      .collection<Conversation>("conversations")
      .updateMany({ sid, status: "active" }, { $set: { status: "done" } });
    await db.collection<Session>("sessions").deleteOne({ sid });
  }

  const res = NextResponse.json({ ok: true, redirect: "/student/login" });
  res.cookies.set(SESSION_COOKIE, "", {
    ...sessionCookieOptions(),
    maxAge: 0,
    expires: new Date(0),
  });
  return res;
}
