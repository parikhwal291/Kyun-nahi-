import { auth } from "@clerk/nextjs/server";

export class TeacherAuthError extends Error {
  readonly status = 401;
  constructor() {
    super("Unauthorized");
    this.name = "TeacherAuthError";
  }
}

/**
 * Guard for /api/teacher/* routes. Returns the teacher id (Clerk userId) from
 * the session, or throws TeacherAuthError — map that to a 401 response.
 * Authorization is always derived from the session, never the request body.
 */
export async function requireTeacher(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new TeacherAuthError();
  return userId;
}

/**
 * Guard for /teacher/* pages. Redirects signed-out teachers to Clerk sign-in.
 */
export async function requireTeacherPage(): Promise<string> {
  const session = await auth();
  if (!session.userId) return session.redirectToSignIn();
  return session.userId;
}
