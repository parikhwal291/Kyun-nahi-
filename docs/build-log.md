# Build Log

Entries track things a model got wrong and how they were fixed. Add one row per notable incident.

| Task | Model | What went wrong | Fix |
| --- | --- | --- | --- |
| Scaffold | Cline (Person B) | Node.js was not installed and a backgrounded `brew install node` was killed when its shell exited | Installed Node via `brew install node` in the foreground (v26.11.1) |
| Scaffold | Cline (Person B) | Assumed the guard file was `middleware.ts` | Next.js 16 renamed `middleware.ts` -> `proxy.ts`; use `src/proxy.ts` |
| Auth (Task 1) | Cline (Person B) | Assumed Clerk's `createRouteMatcher` was the way to protect routes | `createRouteMatcher` is deprecated in Clerk v7; use resource-based `auth()` checks in `requireTeacher()` |
