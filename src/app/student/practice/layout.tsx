import type { ReactNode } from "react";
import { requireStudentPage } from "@/lib/auth/student";

// requireStudentPage reads cookies, so this route renders dynamically.
export const instant = false;

export default async function PracticeLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Guards every /student/practice/* page: redirects to /student/login.
  await requireStudentPage();
  return <>{children}</>;
}
