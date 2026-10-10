# AI Practice Companion for Indian Classrooms

A mobile-first web app prototype built for the Cline AI Builder Hackathon. A teacher confirms what was taught, students (Class 3–12) explain the concept to an AI "confused junior" over a few private turns, and the teacher sees a dashboard of which concepts stuck and which need re-teaching. An experimental teacher coach using the Cline SDK exists behind a feature flag; its behaviour is not verified in this README.

Repository: https://github.com/parikhwal291/Kyun-nahi-.git

> **Status: hackathon prototype.** No deployment URL, screenshots, or test results are published in this README. All demo data is **simulated** (see below).

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript + Tailwind CSS 4
- API routes under `src/app/api` are the backend; no Redux, no ORM
- MongoDB (Atlas M0 intended) via the native `mongodb` driver 7.x, with Zod schemas in `src/lib/types.ts`
- Teacher auth: Clerk (`@clerk/nextjs`)
- Student auth: class code + roll number + 4-digit PIN (no email, no personal data beyond an alias)
- AI: all model calls go through `src/lib/ai/client.ts` to the Cline API (OpenAI-compatible); model IDs live only in `src/lib/ai/models.ts`; the teacher coach uses `@cline/sdk`

## Getting started

Requirements: Node.js >= 22 (per `package.json` `engines`; the seed script is run directly by Node as a `.ts` file), a MongoDB database, a Clerk application, and a Cline API key.

```bash
npm install
cp .env.example .env.local   # then fill in the values below
npm run dev                  # http://localhost:3000
```

Environment variables (see `.env.example`; never commit real values, and none of the secrets may be exposed to the browser):

| Variable | Purpose |
| --- | --- |
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB` | Optional; database name, defaults to `learning` (read in `src/lib/db.ts`, not listed in `.env.example`) |
| `CLINE_API_KEY` | Server-side key for all model calls |
| `STUDENT_SESSION_SECRET` | Long random string used to sign the student session cookie |
| `COACH_ENABLED` | Set to `true` to enable the SDK teacher coach (`/api/coach`) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk teacher auth |

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` / `npm run start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm run db:seed` | Insert the simulated demo data (`node scripts/seed.ts`) |

There is no automated test script in `package.json`.

## Demo data (SIMULATED)

`npm run db:seed` reads `.env.local` (same loader as Next.js) and inserts:

- 1 demo teacher (placeholder Clerk id `demo-teacher-clerk-id`)
- 1 demo class, "Class 7 — Demo School (Simulated)", class code `RAIN7`
- 8 demo students with aliases only: Aarav, Diya, Rohan, Priya, Arjun, Meera, Kabir, Anaya
- 2 original, self-written topics: "The Water Cycle" (primary) and Newton's third law (secondary)
- 30 simulated conversations/evaluations

The seed is idempotent: if the demo class already exists it prints counts and exits without inserting or deleting anything.

Every seeded student and evaluation carries `isSimulated: true`, and the dashboard shows a **SIMULATED** badge on those rows. These are not real students, real school results, or real learning outcomes.

### Demo credentials (classroom-grade, demo only)

Student login at `/student/login`:

- Class code: `RAIN7`
- Roll number: `1` to `8`
- PIN: `1000 + roll number` (roll 1 → `1001`, roll 8 → `1008`)

Teacher: sign in through Clerk at `/sign-in`. The first real teacher who signs in claims the seeded demo teacher record, which links them to the seeded demo class. There are no shared teacher credentials; you create your own Clerk account.


## Security notes

- Student PINs are hashed with Node's built-in `crypto.scrypt`; plaintext PINs are not stored.
- **The PIN is classroom-grade security only** (4 digits). It is meant to keep students out of each other's practice sessions, not to protect sensitive data.
- Login attempts are rate-limited (5 failures → 10-minute lockout; 10 attempts per minute per IP + class code) with generic error messages.
- Student sessions use an opaque session id signed with HMAC in an httpOnly cookie; the database session row is the source of truth. Sliding 30-minute expiry with a 2-hour absolute cap; "switch student" revokes the session server-side.
- Teacher API routes derive the teacher from the Clerk session, not from request bodies.

## Project layout

- `src/app/teacher/*` — teacher pages (notes, concepts, dashboard)
- `src/app/student/*` — student login and practice chat
- `src/app/api/*` — auth, chat, coach, student, teacher, health, and dev routes
- `src/lib/ai/*` — model client, model catalog, jobs (extract, junior turn, evaluate, aggregate), prompts, read-only coach data tools
- `src/lib/sdk/coach.ts` — Cline SDK teacher coach
- `scripts/seed.ts` — demo seed
- `docs/build-log.md` — notes on notable AI mistakes and fixes
- `PLAN.md` — build plan

## Limitations

- **Not offline.** The app needs a network connection; no offline support is provided.
- **Prototype only.** No real-school results, and no educational or clinical guarantees, are claimed. AI evaluations can be wrong; teachers can override them from the dashboard.
- **Notes input is text-only.** The UI states photo and PDF upload are not supported yet.
- **One class per teacher in the UI.** Teacher context resolves the teacher's first class.
- **Seeded content is minimal:** two short original demo topics, not textbook material.
- **Rate limiting is simple** (database read-modify-write), suited to a single-instance demo.
- **Model availability** depends on the live Cline API catalog; see the notes in `src/lib/ai/models.ts`.
- `/api/health` and `/api/dev/extract` are development aids (`/api/dev/extract` only responds in development).
- The SDK coach is experimental and gated by `COACH_ENABLED`. Its tool execution and output quality have not been verified here, so treat it as unverified.

## Deployment

No deployment is documented here. If you deploy (for example to Vercel), set the same environment variables on the host and configure Clerk for the deployed domain.
