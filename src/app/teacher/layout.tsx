import type { ReactNode } from "react";
import { requireTeacherPage } from "@/lib/auth/teacher";

export default async function TeacherLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Guards every /teacher/* page: redirects to Clerk sign-in when signed out.
  await requireTeacherPage();
  return <>{children}</>;
}
