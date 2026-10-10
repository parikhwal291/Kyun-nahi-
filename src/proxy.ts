import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16 renamed middleware.ts -> proxy.ts. clerkMiddleware hydrates Clerk
// auth state so that auth() works in Server Components and Route Handlers.
// Route protection happens resource-by-resource in requireTeacher().
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes.
    "/(api|trpc)(.*)",
    // Always run for Clerk-specific frontend API routes.
    "/__clerk/(.*)",
  ],
};
