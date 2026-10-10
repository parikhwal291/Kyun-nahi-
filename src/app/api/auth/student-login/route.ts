import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  createSessionId,
  SESSION_COOKIE,
  SESSION_HARD_CAP_MS,
  SESSION_TTL_MS,
  sessionCookieOptions,
  signSessionToken,
} from "@/lib/auth/student";
import { burnPin, verifyPin } from "@/lib/auth/password";
import {
  checkRateLimit,
  clearFailures,
  isLocked,
  recordFailure,
} from "@/lib/auth/rate-limit";
import { StudentLoginInputSchema } from "@/lib/schemas";
import type { SchoolClass, Student } from "@/lib/types";

const GENERIC_ERROR = "Incorrect class code, roll number, or PIN.";
const TOO_MANY_ERROR = "Too many attempts. Please try again in a few minutes.";

function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "local";
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 400 });
  }

  const parsed = StudentLoginInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 400 });
  }
  const { classCode, rollNumber, pin } = parsed.data;

  // 1. Lockout check (class code + roll number).
  if (await isLocked(classCode, rollNumber)) {
    return NextResponse.json({ ok: false, error: TOO_MANY_ERROR }, { status: 429 });
  }

  // 2. Rate limit (IP + class code, 10/min).
  const rate = await checkRateLimit(getClientIp(request), classCode);
  if (!rate.allowed) {
    return NextResponse.json({ ok: false, error: TOO_MANY_ERROR }, { status: 429 });
  }

  // 3. Resolve the class and student.
  const db = await getDb();
  const schoolClass = await db
    .collection<SchoolClass>("classes")
    .findOne({ classCode });
  const student = schoolClass
    ? await db
        .collection<Student>("students")
        .findOne({ classId: schoolClass._id, rollNumber })
    : null;

  // 4. Verify the PIN (burn equal time whether or not the student exists).
  let valid = false;
  if (student) {
    valid = await verifyPin(pin, student.pinHash);
  } else {
    await burnPin(pin);
  }

  if (!schoolClass || !student || !valid) {
    await recordFailure(classCode, rollNumber);
    return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 401 });
  }

  await clearFailures(classCode, rollNumber);

  // 5. Create the session and set the signed cookie.
  const sid = createSessionId();
  const now = new Date();
  await db.collection("sessions").insertOne({
    sid,
    studentId: student._id,
    classId: schoolClass._id,
    createdAt: now,
    expiresAt: new Date(now.getTime() + SESSION_TTL_MS),
    hardExpiresAt: new Date(now.getTime() + SESSION_HARD_CAP_MS),
  });

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, signSessionToken(sid), sessionCookieOptions());
  return res;
}
