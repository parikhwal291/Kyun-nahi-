"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SignOutButton, UserButton } from "@clerk/nextjs";

export default function TeacherHeader() {
  const pathname = usePathname();
  const links = [
    { href: "/teacher/notes", label: "Notes" },
    { href: "/teacher/concepts", label: "Concepts" },
    { href: "/teacher/dashboard", label: "Dashboard" },
  ];

  return (
    <header className="flex items-center justify-between border-b border-black/10 px-4 py-3">
      <div className="flex items-center gap-4">
        <Link href="/teacher" className="font-semibold">
          Teacher
        </Link>
        <nav className="flex gap-3 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={
                pathname.startsWith(l.href)
                  ? "font-semibold underline"
                  : "text-zinc-600"
              }
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <UserButton />
        <SignOutButton />
      </div>
    </header>
  );
}
