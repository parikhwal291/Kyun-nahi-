# AI Practice Companion for Indian Classrooms

A mobile-first web app prototype that helps teachers look beyond memorised answers. Students explain concepts to an AI **“confused junior”** in English or Hindi, while teachers review concept-level learning signals and decide what to re-teach.


> **Status:** Hackathon prototype. All seeded demo data is simulated. There is no deployment URL or published test report in this README. The teacher coach is experimental and controlled by a feature flag.

## The problem

In busy classrooms, a student may memorise an answer without fully understanding the idea behind it. With many students per teacher, misconceptions and gaps in foundational knowledge can remain hidden until an exam. This is harder when students share a phone, do not have individual email accounts, or are more comfortable explaining ideas in a language other than English.

## The solution

The AI Practice Companion creates a short practice loop:

1. **Teacher prepares the material:** pastes lesson notes, reviews and confirms the text, then approves the concepts and evaluation guidance.
2. **Student explains:** signs in with a class code, roll number, and teacher-issued four-digit PIN, then explains a selected concept to an AI “confused junior” over a few private turns.
3. **Teacher reviews:** checks concept-level evaluation results, possible misconception tags, prerequisite gaps, and low-confidence evaluations. Teachers can override AI evaluations.
4. **Teacher coach (experimental):** a Cline SDK-powered coach can be enabled to answer questions about class data using read-only tools scoped to the teacher's classes.

The prototype is intended for school classrooms, with Classes 3–12 as the broader target. The current seeded demo is limited to two original sample topics, so it does not demonstrate full curriculum coverage.

## Architecture

```text
Teacher UI (Clerk login)                 Student UI (class code + roll + PIN)
           |                                              |
           +---------------- Next.js App Router ----------+
                                  |
                         API route handlers
                                  |
                 Auth, session checks and Zod validation
                                  |
                      MongoDB native driver
                                  |
                     Cline API client (server-side)
                         |                 |
               Concept extraction,     Optional Cline SDK
               junior chat, evaluation  teacher coach
                                           (feature-flagged)
```

Teacher routes derive the teacher identity from the Clerk session. Student PINs are verified with Node.js `crypto.scrypt`; student sessions use a signed, opaque cookie backed by a server-side session record. The **Switch student** flow revokes the active session so the next student can return to the PIN screen on a shared device.

## Tech stack

- **Framework:** Next.js 16 App Router, React 19, TypeScript (strict)
- **Styling:** Tailwind CSS 4
- **Backend:** Next.js API route handlers; no separate backend service
- **Database and validation:** MongoDB native driver 7.x and Zod; no ORM
- **Teacher authentication:** Clerk (`@clerk/nextjs`)
- **Student authentication:** class code + roll number + four-digit PIN, `crypto.scrypt`, rate limiting, and a server-side session record
- **AI integration:** Cline API (OpenAI-compatible endpoint); model IDs are centralised in `src/lib/ai/models.ts`
- **Agent integration:** `@cline/sdk` for the optional teacher coach

## How Cline was used in the build

Cline was our AI coding partner during the hackathon. We used it to help plan and implement features, iterate on TypeScript and Next.js code, work through integration problems, and refine prompts. We reviewed and adjusted the generated code rather than treating model output as automatically correct.

Examples of the engineering work we tackled during development included:

- **Framework and authentication:** adapting route protection to Next.js 16's `proxy.ts` convention and resolving Clerk authentication/rendering integration issues.
- **Caching and rendering:** investigating prerendering and Cache Components conflicts in the Next.js setup.
- **Model integration:** checking model IDs against the live Cline API catalog and handling the API's wrapped completion response rather than assuming a bare OpenAI response.
- **Token limits:** diagnosing empty output from a reasoning-model test configured with `max_tokens=5` and increasing the test budget to provide more room for reasoning and output.
- **Prompt and output reliability:** fixing prompt-construction syntax errors, reinforcing the instruction that the junior must not reveal the answer, and clamping misconception tags to an allowed whitelist in deterministic code.
- **TypeScript correctness:** using a type predicate to narrow text values after a boolean-only helper caused a type-checking error.
- **Tool-call hangs:** adding a `Promise.race()`-based watchdog to time out stalled LLM tool-calling flows.

We followed a task-based model strategy: use stronger models for complex work such as schema, authentication, prompts, and SDK integration, and lighter models for UI styling, copy, and documentation. The important lesson was that AI accelerated iteration, but debugging, verification, and engineering judgement were still necessary.

## How Cline is used inside the product

Application model calls are routed through `src/lib/ai/client.ts` to the Cline API, with model configuration kept in `src/lib/ai/models.ts`. The Cline SDK teacher coach is a separate, optional integration gated by `COACH_ENABLED`. Its behaviour has not been verified in this README; enable it only in a controlled demo and verify the response and tool trace before presenting it as working functionality.

## Setup

### Requirements

- Node.js **22 or newer**
- A MongoDB database/connection string
- A Clerk application
- A Cline API key

### Run locally

```bash
git clone https://github.com/parikhwal291/Kyun-nahi-.git
cd Kyun-nahi-
npm install
cp .env.example .env.local
```

On Windows PowerShell, use `Copy-Item .env.example .env.local` instead of `cp` if needed.

Fill in the environment variables in `.env.local`:

| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB` | Optional database name; defaults to `learning` in `src/lib/db.ts` |
| `CLINE_API_KEY` | Server-side key for model calls |
| `STUDENT_SESSION_SECRET` | Long random secret used to sign student session cookies |
| `COACH_ENABLED` | Set to `true` to enable the experimental coach route |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Server-side Clerk secret key |

Then seed the simulated demo data and start the server:

```bash
npm run db:seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Keep `.env.local` and all secret values out of version control; do not expose server-side keys in browser code.

### Student demo credentials

After seeding, open `/student/login`:

- **Class code:** `RAIN7`
- **Roll number:** `1` to `8`
- **PIN:** `1000 + roll number` (for example, roll `1` uses PIN `1001`)

These credentials are for the simulated local demo only. Do not use them for real student records. Teacher sign-in uses your configured Clerk account at `/sign-in`; this repository does not provide shared teacher credentials.

## Limitations

- Demo students, conversations, and evaluations are simulated; they are not evidence of real-school outcomes.
- Lesson notes are text-only; photo/PDF input and offline support are not implemented.
- The seeded data contains two short, original demo topics rather than full textbook coverage.
- The four-digit student PIN is for low-stakes classroom practice, not sensitive records or exams.
- Hindi quality has only been lightly tested.
- The teacher coach is experimental and feature-flagged; verify its behaviour before relying on it.
- The prototype has not been validated through real-school trials. AI evaluations can be wrong, and teachers should review results.
