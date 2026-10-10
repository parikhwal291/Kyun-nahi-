import type { ReactNode } from "react";
import { requireTeacherPage } from "@/lib/auth/teacher";
import TeacherHeader from "@/components/teacher/TeacherHeader";

// auth() reads cookies/headers, so this route must render dynamically.
export const instant = false;

export default async function TeacherLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Guards every /teacher/* page: redirects to Clerk sign-in when signed out.
  await requireTeacherPage();
  return (
    <div className="flex min-h-full flex-col">
      <TeacherHeader />
      {children}
    </div>
  );
}


