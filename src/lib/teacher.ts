import { auth, currentUser } from "@clerk/nextjs/server";
import { getDb, newId } from "./db";
import { TeacherAuthError } from "./auth/teacher";
import type { SchoolClass, Teacher } from "./types";

// The seed script creates a Teacher with this placeholder Clerk id so that the
// seeded demo class + students + evaluations exist before any real teacher
// signs in. The first real teacher to sign in "claims" it.
const DEMO_CLERK_ID = "demo-teacher-clerk-id";

export interface TeacherContext {
  teacher: Teacher;
  schoolClass: SchoolClass | null;
}

async function claimOrCreateTeacher(
  clerkUserId: string,
  name: string,
  email: string,
): Promise<Teacher> {
  const db = await getDb();
  const teachers = db.collection<Teacher>("teachers");

  const demo = await teachers.findOne({ clerkUserId: DEMO_CLERK_ID });
  if (demo) {
    const teacher: Teacher = {
      id: demo.id,
      clerkUserId,
      name,
      email,
      createdAt: demo.createdAt,
    };
    await teachers.updateOne(
      { id: demo.id },
      { $set: { clerkUserId, name, email } },
    );
    return teacher;
  }

  const teacher: Teacher = {
    id: newId(),
    clerkUserId,
    name,
    email,
    createdAt: new Date(),
  };
  await teachers.insertOne(teacher);
  return teacher;
}

/**
 * Resolves the authenticated teacher from the Clerk session and their (first)
 * class. Throws TeacherAuthError when signed out.
 *
 * All teacher data access is scoped by the returned teacher.id / schoolClass.id —
 * never by any id supplied in a request body.
 */
export async function getTeacherContext(): Promise<TeacherContext> {
  const { userId } = await auth();
  if (!userId) throw new TeacherAuthError();

  const user = await currentUser();
  const firstName = user?.firstName ?? "";
  const lastName = user?.lastName ?? "";
  const name =
    firstName || lastName
      ? [firstName, lastName].filter(Boolean).join(" ")
      : "Teacher";
  const email =
    user?.emailAddresses?.[0]?.emailAddress ?? "teacher@example.invalid";

  const db = await getDb();
  const existing = await db
    .collection<Teacher>("teachers")
    .findOne({ clerkUserId: userId });

  const teacher: Teacher =
    existing ?? (await claimOrCreateTeacher(userId, name, email));

  const schoolClass = await db
    .collection<SchoolClass>("classes")
    .findOne({ teacherId: teacher.id });

  return { teacher, schoolClass };
}

