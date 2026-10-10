import { Suspense } from "react";
import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Suspense fallback={<div className="text-zinc-500">Loading…</div>}>
        <SignIn />
      </Suspense>
    </div>
  );
}


