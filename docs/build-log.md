# Build Log

> Running record of the build: specs, key prompts, and what Cline got wrong and how
> we fixed it. This file doubles as the shot list for the demo video (each entry
> references a clip timestamp). Append entries **as they happen** — never reconstruct
> them later. Both teammates write to this file.

**How to add an entry** — copy the template below, fill it in, keep it short:

```markdown
## Entry NN — HH:MM — <one-line title> (<owner A/B>)
**Task:** what we were trying to do.
**Model tier:** strong / cheap (and why).
**Prompt excerpt:** (paste or link to docs/key-prompts.md#anchor)
**What Cline got wrong:** the exact mistake or misunderstanding.
**Fix:** what we changed; the commit(s) that fixed it.
**Outcome:** how we verified it (test, screenshot, clip: media/NN.mp4 @ 0:00).
**Lesson:** one sentence we'll carry forward.
```

---

## Entries

<!-- Append entries below, newest at top. -->

## Entry 05 — Task 1 auth — Next.js 16 prerender errors (Person B)
**Task:** Get teacher + student auth building on Next.js 16.
**Model tier:** strong (architectural fix).
**What Cline got wrong:** `auth()` (cookies) and Clerk's `<SignIn/>` (`usePathname`) hit Next 16's "runtime data outside `<Suspense>`" prerender rule, failing `next build`.
**Fix:** `export const instant = false` on the `/teacher` layout; wrap `<SignIn/>`/`<SignUp/>` in `<Suspense>`.
**Outcome:** `npm run build` passes; `/teacher` → 307 redirect to sign-in.
**Lesson:** Next 16's Cache Components model changes where dynamic data is allowed.

## Entry 04 — Task 1 auth — no credentials for smoke test (Person B)
**Task:** Smoke-test Clerk + Mongo flows.
**Model tier:** — (environment).
**What Cline got wrong:** no Clerk keys / MongoDB URI available.
**Fix:** provisioned accountless dev keys with `clerk init --accountless`; MongoDB URI still pending.
**Outcome:** teacher auth verified end-to-end; student login blocked on the Mongo URI.
**Lesson:** provision throwaway credentials early for live testing.

## Entry 03 — Task 1 auth — assumed `createRouteMatcher` (Person B)
**Task:** Protect /teacher + /api/teacher with Clerk.
**Model tier:** strong.
**What Cline got wrong:** assumed `createRouteMatcher` (middleware route matching) was the pattern.
**Fix:** `createRouteMatcher` is deprecated in Clerk v7 → resource-based `auth()` in `requireTeacher()`.
**Outcome:** teacher guard works.
**Lesson:** check the installed SDK's deprecations before coding against docs.

## Entry 02 — scaffold — assumed `middleware.ts` (Person B)
**Task:** Add the Clerk middleware guard.
**Model tier:** strong.
**What Cline got wrong:** assumed `middleware.ts` was the guard file.
**Fix:** Next.js 16 renamed `middleware.ts` → `proxy.ts` (`src/proxy.ts`).
**Outcome:** dev server boots; proxy runs.
**Lesson:** read the installed Next.js version's file conventions.

## Entry 01 — scaffold — Node not installed (Person B)
**Task:** Scaffold the Next.js app.
**Model tier:** — (environment).
**What Cline got wrong:** Node missing; backgrounded `brew install node` was killed when its shell exited.
**Fix:** `brew install node` in the foreground (v26.11.1).
**Outcome:** scaffold + build working.
**Lesson:** run long installs in the foreground.
