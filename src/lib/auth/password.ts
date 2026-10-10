import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 64;
const SALT_LEN = 16;

// Fixed salt used only to burn CPU time when a record does not exist, so the
// login route does not reveal (via timing) whether a student is real.
const DUMMY_SALT = Buffer.alloc(SALT_LEN, 0x5a);

async function derive(
  pin: string,
  salt: Buffer,
  opts: { N: number; r: number; p: number },
): Promise<Buffer> {
  return scryptAsync(pin, salt, KEY_LEN, opts);
}

/** Hashes a PIN with scrypt and encodes all parameters in the stored string. */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const key = await derive(pin, salt, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("base64"),
    key.toString("base64"),
  ].join("$");
}

/** Constant-time comparison of a PIN against a stored scrypt hash. */
export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;

  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isInteger(n) || !Number.isInteger(r) || !Number.isInteger(p)) {
    return false;
  }

  try {
    const salt = Buffer.from(parts[4], "base64");
    const expected = Buffer.from(parts[5], "base64");
    const actual = await derive(pin, salt, { N: n, r, p });
    if (actual.length !== expected.length) return false;
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

/** Performs the same scrypt work as a real check, for non-existent records. */
export async function burnPin(pin: string): Promise<void> {
  await derive(pin, DUMMY_SALT, { N: SCRYPT_N, r: SCRYPT_R, p: SCRYPT_P });
}
