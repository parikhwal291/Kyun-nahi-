import { MongoClient, type Db, type Document } from "mongodb";
import { randomUUID } from "node:crypto";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB ?? "learning";

// Reuse a single client across hot reloads in development.
const globalForMongo = globalThis as unknown as {
  _mongoClientPromise?: Promise<MongoClient>;
};

function getClient(): Promise<MongoClient> {
  if (!MONGODB_URI) {
    throw new Error(
      "MONGODB_URI is not set. Add it to .env.local (see .env.example).",
    );
  }
  if (!globalForMongo._mongoClientPromise) {
    const client = new MongoClient(MONGODB_URI);
    globalForMongo._mongoClientPromise = client.connect();
  }
  return globalForMongo._mongoClientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(MONGODB_DB);
}

export async function getCollection<T extends Document>(name: string) {
  const db = await getDb();
  return db.collection<T>(name);
}

/**
 * Generates the string `id` stored on every document. Mongo still assigns its
 * own `_id` ObjectId, but that ObjectId never leaves the db layer — all
 * cross-document references use this string id.
 */
export function newId(): string {
  return randomUUID();
}

/** Creates the unique indexes our lookups rely on (idempotent). */
export async function ensureIndexes(): Promise<void> {
  const db = await getDb();
  await Promise.all([
    db.collection("teachers").createIndex({ clerkUserId: 1 }, { unique: true }),
    db.collection("teachers").createIndex({ id: 1 }, { unique: true }),
    db.collection("classes").createIndex({ classCode: 1 }, { unique: true }),
    db.collection("classes").createIndex({ id: 1 }, { unique: true }),
    db.collection("students").createIndex({ id: 1 }, { unique: true }),
    db.collection("students").createIndex(
      { classId: 1, rollNumber: 1 },
      { unique: true },
    ),
    db.collection("sessions").createIndex({ sid: 1 }, { unique: true }),
    db.collection("login_locks").createIndex(
      { classCode: 1, rollNumber: 1 },
      { unique: true },
    ),
  ]);
}

export default getDb;
