# AI Practice Companion for Indian Classrooms

## Problem
In many Indian classrooms (especially rural government schools), learning is rote. One teacher handles 40–60 students, sometimes several grades together, with little training support, so wrong ideas and weak foundations stay hidden until the final exam. Many students study in a language they don't think in. Rural schools may have one shared phone, no device per student, no student email addresses, and low data. Early-grade gaps compound into later classes.

## Solution
A mobile-first, low-data web app where a teacher uploads and confirms what she taught, students explain concepts to an AI "confused junior" in English or Hindi over 3–5 private turns, and the teacher gets a dashboard of what stuck, what didn't, and what to re-teach — plus an AI "teacher coach" built with the Cline SDK. 

No email, no app install, no device per student: students log in with class code + roll number + a 4-digit PIN issued by the teacher.

[screenshot]

## How it works

### For a Teacher
- Logs in via Clerk (email + password).
- Pastes notes, reviews, and confirms the text.
- Edits the rubric, wrong ideas, and prerequisite concepts, then approves them.
- Views a dashboard with per-concept status counts, misconception clusters (tag → count + sample IDs), prerequisite-gap counts, a low-confidence review queue, and a simulated-row count.
- The teacher has the final word and can override AI evaluations.
- Uses an AI "teacher coach" (a Cline SDK agent with read-only tools scoped to her classes) to ask questions like "What should I re-teach tomorrow?".

[screenshot]

### For a Student
- Logs in using a class code, their roll number, and a 4-digit PIN issued by the teacher (no email required).
- Picks a concept from the practice list.
- Enters a private chat session explaining the concept to an AI "confused junior" in their mother tongue (English or Hindi) over 3–5 turns. The junior asks one question at a time and never reveals the answer.
- Uses a big "Switch student" button when done. This deletes the session row, expires the opaque signed cookie, and marks the conversation as done. The next student using the shared phone never sees the previous student's data.

[screenshot]

## Architecture and Tech Stack
- **Next.js** (App Router 16)
- **TypeScript** (strict)
- **Tailwind CSS**
- **MongoDB Atlas** (M0, free shared hosted) via the **native driver (mongodb 7.x) + Zod** for schema/validation (No Prisma/ORM).
- **Clerk** for teacher login.
- **Custom Student Login:** Class-code + roll number + PIN login. Verified with Node's built-in `crypto.scrypt` (rate-limited, 30-min sliding TTL cookie).
- **AI Models:** Routed through the Cline API (`api.cline.bot`, OpenAI-compatible) and the Cline SDK.

## Setup Steps
1. Clone the repository.
2. Run `npm install` to install dependencies.
3. Copy `.env.example` to `.env` and fill the variables (Clerk keys, MongoDB URI, CLINE_API_KEY).
4. Run `npm run dev` to start the development server.

## How Cline was used in the build
We built this in 5 hours with Cline as our AI coding partner.

**Model Choices:** 
We used strong models for schema/auth/prompts/SDK, and cheap models for Tailwind/copy/i18n/README. Specifically, we used strong models (like `anthropic/claude-sonnet-5.5`) for complex tasks such as evaluating transcripts and extracting concepts, and cheap models (like `google/gemini-2.5-flash` or `cline-pass/deepseek-v4.1-flash`) for the "junior turn" chat. We used `cline-pass/glm-5.3` for the teacher coach.

**Mistakes we hit and fixed (from our build log):**
- **Next.js 16 file conventions (Entry 02):** Cline initially tried to add a middleware guard in `middleware.ts`, but Next 16 renamed this to `proxy.ts`. 
- **Clerk v7 deprecations (Entry 03):** Cline assumed `createRouteMatcher` was the pattern, but it's deprecated in v7. We switched to resource-based `auth()` for teacher guards.
- **Prerender errors in Next 16 (Entry 06):** `auth()` and Clerk's `<SignIn/>` hit runtime data rules. We fixed this with `export const instant = false` and wrapping in `<Suspense>`.
- **Cache Components conflicts (Entry 07):** Cline added `export const dynamic = "force-dynamic"`, which broke with `cacheComponents: true`. We removed it since route handlers are dynamic by default.
- **Model catalog drift (Entry 05):** The live catalog had no `cline-pass/*` prefix despite documentation. We asserted against the live catalog and mapped to the closest real IDs.
- **API Response parsing (Entry 09):** The Cline API wraps completions in `{ data: { choices: [...] } }`, unlike bare OpenAI. We added custom extraction for completions and errors.
- **Token starvation on reasoning models (Entry 10):** A probe with `max_tokens=5` starved models like `qwen3.7-plus`, returning empty content. We fixed it by bumping `max_tokens` to 300 to cover reasoning headroom.
- **Prompt brace balancing (Entry 06 (A3)):** Chunking large prompts across editor calls caused missing closing braces (TS1005). We fixed it and reinforced "NEVER reveal the answer" at the start and end of the prompt.
- **Safety clamps (Entry 07 (A4)):** To prevent the model from inventing misconception tags, we clamped the tag to a whitelist in deterministic code. 
- **TypeScript Type Predicates (Entry 08 (A5)):** A `hasText` helper returning `boolean` caused a compiler error (TS2345). We fixed it by using a type predicate (`value is string`) for proper narrowing.

## How Cline is used inside the product
[to be filled in]

## Honest Limitations
- The 4-digit PIN is classroom-grade. It is fine for ungraded practice on a shared device but not secure enough for graded records.
- Photo/PDF input is not built (only plain text pasting is supported).
- Seeded data is simulated (and clearly marked with a SIMULATED badge).
- No offline mode; requires internet connection.
- AI grading is purely assistive. The teacher always has the final word and can override evaluations.
- Hindi quality has only been lightly tested.
- Note: There are no claims of real-school results; this is a hackathon prototype.

## Future Scope
- Photo and PDF ingestion for teacher notes.
- Google login integration for teachers.
- AI-driven misconception clustering (currently done via deterministic tag counts).
- Streaming responses for the teacher coach.
- Expanding offline capabilities and refining language support.
