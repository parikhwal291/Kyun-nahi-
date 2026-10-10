import { getDb } from "../db";
import type { LoginAttempt } from "../types";

const RATE_LIMITS = "rate_limits";
const LOGIN_LOCKS = "login_locks";

const WINDOW_MS = 60_000;
const MAX_ATTEMPTS_PER_WINDOW = 10;
const MAX_FAILURES = 5;
const LOCK_MS = 10 * 60_000;

interface RateLimitDoc {
  key: string;
  count: number;
  windowStart: Date;
}

export type RateLimitResult =
  | { allowed: true }
  | { allowed: false; retryAfterSeconds: number };

/**
 * Sliding 1-minute window, keyed by IP + class code, max 10 attempts.
 * Uses a simple read-modify-write (fine for a single-instance demo).
 */
export async function checkRateLimit(
  ip: string,
  classCode: string,
): Promise<RateLimitResult> {
  const db = await getDb();
  const col = db.collection<RateLimitDoc>(RATE_LIMITS);
  const key = `${ip}:${classCode}`;
  const now = Date.now();

  const doc = await col.findOne({ key });

  if (!doc || now - doc.windowStart.getTime() > WINDOW_MS) {
    await col.updateOne(
      { key },
      { $set: { key, count: 1, windowStart: new Date(now) } },
      { upsert: true },
    );
    return { allowed: true };
  }

  if (doc.count >= MAX_ATTEMPTS_PER_WINDOW) {
    const retryAfterSeconds = Math.ceil(
      (doc.windowStart.getTime() + WINDOW_MS - now) / 1000,
    );
    return { allowed: false, retryAfterSeconds: Math.max(1, retryAfterSeconds) };
  }

  await col.updateOne({ key }, { $inc: { count: 1 } });
  return { allowed: true };
}

/** True when a class code + roll number is locked out after repeated failures. */
export async function isLocked(
  classCode: string,
  rollNumber: number,
): Promise<boolean> {
  const db = await getDb();
  const doc = await db
    .collection<LoginAttempt>(LOGIN_LOCKS)
    .findOne({ classCode, rollNumber });
  if (!doc?.lockedUntil) return false;
  return doc.lockedUntil.getTime() > Date.now();
}

/** Records a failed login and locks the account after MAX_FAILURES attempts. */
export async function recordFailure(
  classCode: string,
  rollNumber: number,
): Promise<void> {
  const db = await getDb();
  const col = db.collection<LoginAttempt>(LOGIN_LOCKS);
  const now = new Date();

  await col.updateOne(
    { classCode, rollNumber },
    { $inc: { failedCount: 1 }, $set: { lastFailedAt: now } },
    { upsert: true },
  );

  const doc = await col.findOne({ classCode, rollNumber });
  if (
    doc &&
    doc.failedCount >= MAX_FAILURES &&
    (!doc.lockedUntil || doc.lockedUntil.getTime() <= Date.now())
  ) {
    await col.updateOne(
      { classCode, rollNumber },
      { $set: { lockedUntil: new Date(Date.now() + LOCK_MS) } },
    );
  }
}

/** Clears failed-attempt counters and any lock after a successful login. */
export async function clearFailures(
  classCode: string,
  rollNumber: number,
): Promise<void> {
  const db = await getDb();
  await db.collection<LoginAttempt>(LOGIN_LOCKS).updateOne(
    { classCode, rollNumber },
    { $set: { failedCount: 0, lockedUntil: null, lastFailedAt: null } },
  );
}

