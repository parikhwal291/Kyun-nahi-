# PLAN — AI Practice Companion for Indian Classrooms (Class 3–12, English + Hindi)

> Hackathon: Cline AI Builder Hackathon, Round 2 · Team of 2 · 5-hour build window.
> This is the single source of truth for the build, v2 (post-revisions).

## 1. Problem

In many Indian classrooms (especially rural government schools), learning is rote.
One teacher handles 40–60 students, sometimes several grades together, with little
training support, so wrong ideas and weak foundations stay hidden until the final
exam. Many students study in a language they don't think in. Rural schools may have
one shared phone, no device per student, no student email addresses, and low data.
Early-grade gaps compound into later classes.

## 2. Solution (one sentence)

A mobile-first, low-data web app where a teacher uploads and confirms what she taught,
students explain concepts to an AI "confused junior" in English or Hindi over 3–5
private turns, and the teacher gets a dashboard of what stuck, what didn't, and what
to re-teach — plus an AI "teacher coach" built with the Cline SDK.

**No email, no app install, no device per student:** students log in with class code
+ roll number + a 4-digit PIN issued by the teacher.

## 3. Revisions from v1 (decisions that changed the plan)

1. **No Prisma.** Current Prisma is v8; **v7 has no MongoDB connector**, and v8's
   MongoDB support is a brand-new RC-stage package (`@prisma/orm-mongo`) with a
   contract workflow Cline's training data does not know. → Use the **native
   `mongodb` driver 7.x + Zod**. Trivial CRUD needs no ORM, no codegen, no version
   roulette. (Prisma v6.19 pinned is the documented fallback only.)
2. **No argon2** (native node-gyp pain on Windows/serverless). Use Node's built-in
   **`crypto.scrypt`** (async): `N=16384, r=8, p=1, keylen=64`, 16-byte random salt,
   stored as `scrypt:16384:8:1:<salt>:<hash>`, compared with `timingSafeEqual`. The
   real PIN defense is rate limiting + short TTL + DB secrecy (stated honestly in README).
3. **Student sessions = opaque signed cookie + server-side revocation.** Cookie carries
   `<sid>.<HMAC(sid, SESSION_SECRET)>`; the DB `Session` row is the source of truth.
   "Switch student" deletes the row and expires the cookie, so a copied cookie dies
   instantly — a stateless JWT can't do that on a shared phone.
4. **Exact model IDs live only in `src/lib/ai/models.ts`.** No model strings elsewhere.
   Catalog-asserted at setup (docs lag the live catalog: use `anthropic/claude-sonnet-5.5`,
   not the docs' `claude-sonnet-4-6`).
5. **Deployment is an optional 25-minute slot (B6), never on the critical path.** The
   demo video is recorded locally regardless.

## 4. Architecture

- **Stack:** Next.js (App Router) + TypeScript strict + Tailwind. API routes = backend.
- **DB:** MongoDB Atlas M0 (shared hosted, free; a replica set; both devs + Vercel see
  the same data). Native `mongodb` driver + Zod for schema/validation.
- **Auth:** Clerk for teachers (email+password; Google cut). Custom class-code + roll +
  PIN for students (scrypt-hashed, rate-limited).
- **AI:** one **Cline API key** (`api.cline.bot`, OpenAI-compatible) for everything —
  plain calls AND the Cline SDK agents. ClinePass quota covers `cline-pass/*` models.
- **Cline SDK:** used for (a) the teacher coach and (b) optionally the evaluator.
  Both are plain-call-first; the SDK is a removable wrapper behind flags. No file/shell/
  web tools; every tool scoped to the logged-in teacher's classes.

### Folder structure

```
/
├── PLAN.md  ·  README.md  ·  .clinerules
├── docs/
│   ├── build-log.md            # append entries as they happen (video shot list)
│   ├── key-prompts.md          # golden prompts, mapped to video timestamps
│   └── architecture.png
├── src/
│   ├── app/
│   │   ├── page.tsx            # "I'm a teacher / I'm a student"
│   │   ├── teacher/
│   │   │   ├── login/          # Clerk
│   │   │   ├── notes/          # paste text + label; photo/pdf disabled (cut)
│   │   │   ├── notes/[id]/confirm/   # REVIEW + CONFIRM gate (mandatory)
│   │   │   ├── concepts/       # edit rubric/wrong ideas/prereq, approve
│   │   │   ├── dashboard/      # counts, clusters, review queue, override
│   │   │   └── coach/          # Cline SDK agent, removable (COACH_ENABLED)
│   │   ├── student/
│   │   │   ├── login/          # class code + roll + PIN
│   │   │   ├── practice/       # concept picker → junior chat (3–5 turns)
│   │   │   └── done/           # big "Switch student" → back to PIN screen
│   │   └── api/
│   │       ├── health/route.ts
│   │       ├── auth/student-login/route.ts · auth/switch/route.ts
│   │       ├── teacher/notes/route.ts · teacher/concepts/route.ts
│   │       ├── teacher/dashboard/route.ts
│   │       ├── student/concepts/route.ts
│   │       ├── chat/turn/route.ts · chat/evaluate/route.ts
│   │       └── coach/route.ts  # flag-guarded; OFF = hidden
│   ├── lib/
│   │   ├── types.ts            # Zod schemas + inferred types (the contract)
│   │   ├── db.ts               # mongodb client singleton + connection cache
│   │   ├── db/schema.ts        # collection names + indexes
│   │   ├── auth/session.ts     # requireTeacher()/requireStudent(), HMAC, scrypt
│   │   ├── ai/client.ts        # OpenAI-compatible → api.cline.bot, retries, JSON mode
│   │   ├── ai/models.ts        # EXACT model IDs (primary + fallback) — only here
│   │   ├── ai/prompts/         # junior.{level}.{lang}, evaluator, extractor, coach
│   │   ├── ai/jobs/            # extract.ts, turn.ts, evaluate.ts, group.ts
│   │   └── ai/tools/           # plain fns + createTool wrappers (shared by plain+SDK)
│   └── components/             # UI primitives, SIMULATED badge, level/language switch
├── scripts/seed.ts             # 2 topics + 8 real students + 30 simulated evals
├── public/demo/                # OUR OWN demo notes (no copyrighted textbook content)
└── media/                      # continuous screen recordings → demo video
```

## 5. Data model (see `src/lib/types.ts` for the Zod source of truth)

| Collection | Key fields | Notes |
|---|---|---|
| **Teacher** | id, clerkUserId, email, name | Clerk holds the credential; slim profile row |
| **SchoolClass** | id, teacherId, name, grade, classCode, defaultLanguage | classId = scoping key for everything |
| **Student** | id, classId, rollNumber, alias, pinHash, active, isSimulated | alias not full name; no email/phone/photo |
| **Session** | sid, studentId, classId, createdAt, expiresAt | opaque token; server-side revocation on switch |
| **Material** | id, classId, teacherId, label, sourceType, rawText, confirmedText, status | students/evaluator only read confirmedText |
| **Concept** | id, classId, materialId, title, level, language, rubric[], wrongIdeas[], prereqConceptId, status | prereq self-FK powers gap detection |
| **Conversation** | id, conceptId, studentId, language, level, turns[], turnCount, status, endedReason | private; one practice session |
| **Evaluation** | id, conversationId, conceptId, studentId, status, reason, confidence, misconceptionTag, prereqGapNote, source, originalStatus, overriddenBy, overrideReason, isSimulated | override keeps AI value in originalStatus |

**Scoping rule (enforced in code, never by prompt):** teacher queries always filter by
`teacherId`/`classId` from the session; students see only their own `studentId`.
Client-supplied IDs are used for lookup only, then re-scoped.

## 6. AI jobs + exact model assignment

| Job | Input → Output | Primary model | Billing | Fallback (402/429) |
|---|---|---|---|---|
| extractConcepts | confirmed text → concepts[{title, level, language, rubric[], wrongIdeas[], prereqSuggestion, prereqClassHint}] | `anthropic/claude-sonnet-5.5` | Credits | `google/gemini-2.5-pro` |
| juniorTurn | concept + level + language + history + msg → {reply, done} | `google/gemini-2.5-flash` | Credits (cheap) | `cline-pass/deepseek-v4.1-flash` (ClinePass) |
| evaluateConversation | transcript + rubric + wrongIdeas + prereq → {status, reason, confidence, misconceptionTag?, prereqGapNote?} | `anthropic/claude-sonnet-5.5` | Credits | `google/gemini-2.5-pro` |
| groupMisconceptions (naming, optional) | tags+counts → cluster labels | `cline-pass/qwen3.7-plus` | ClinePass | `google/gemini-2.5-flash` |
| teacherCoach (SDK agent) | teacher question + scoped tools → answer citing numbers | `cline-pass/glm-5.3` | ClinePass | `anthropic/claude-haiku-5.5` |
| vision photo (CUT, stretch) | image → text+concepts | `google/gemini-2.5-flash` (check supportsImages) | Credits | `openai/gpt-4o` |
| dev smoke tests | — | any `:free` catalog model (e.g. `apodex/apodex-1.1-mini:free`) | FREE | — |

- All IDs asserted against `GET https://api.cline.bot/api/v1/models` during setup (part
  of kickoff + `/api/health`). The live catalog is authoritative, not the docs.
- ClinePass = flat $9.99/mo subscription quota (5-hour rolling / weekly / monthly windows)
  covering `cline-pass/*` only; everything else bills Cline credits; `:free` = no cost.
- SDK wiring: `providerId: "openai-compatible"`, `baseUrl: "https://api.cline.bot/api/v1"`,
  `apiKey: CLINE_API_KEY`, `modelId` = the slug above. Plain calls hit the same endpoint.

## 7. Auth

**Teachers** — Clerk, email + password (Google cut). Clerk handles credential hashing,
sessions, and its own cookie. `requireTeacher()` resolves the Clerk session to a
`Teacher` row and scopes all queries.

**Students** — custom, no email needed:
- Login: class code + roll number + 4-digit PIN. Rate limit (5 failed attempts on
  classCode+roll → 10-min lockout, generic error). PIN verified with `crypto.scrypt`.
- Session: create `Session` row → cookie `sid = "<24char>.<HMAC(sid, SECRET)>"`,
  `httpOnly, Secure(prod), SameSite=Lax, path=/, Max-Age=1800`. 30-min sliding TTL,
  2-hour absolute cap. Cookie carries no PII.
- Switch student: `POST /api/auth/switch` deletes the Session row, expires the cookie,
  marks any active conversation `done (switched)`, redirects to `/student/login`.
- **Security limits (stated honestly in README):** 4-digit PIN = 10,000 combos; scrypt
  slows offline guessing but the DB must never leak; PIN is classroom-grade (fine for
  ungraded practice, not for graded records). No PII beyond alias + roll number.

## 8. Build schedule — exactly 300 minutes, no slack (⛔ = cut, not scheduled)

**Kickoff (both, 0:00–0:25, 25m):** repo + `.clinerules` + `lib/types.ts` contract +
`db/schema.ts` draft; create Atlas M0, Clerk, Cline API key; catalog assertion + Hindi
smoke test + free-model pick; Vercel project + env vars pasted; **screen recorders ON**.

**Person A — AI / prompts / SDK (275m):**
| Slot | Task | Min |
|---|---|---|
| A1 0:25–0:45 | `ai/client.ts` + `ai/models.ts` + `/api/health` | 20 |
| A2 0:45–1:20 | extractConcepts prompt + notes/concepts endpoints (typed only) | 35 |
| A3 1:20–2:00 | juniorTurn + 4 templates (primary/secondary × en/hi) + red-team pass | 40 |
| A4 2:00–2:35 | evaluateConversation **plain call** + edge cases | 35 |
| A5 2:35–2:50 | misconception grouping (by tag, code) + dashboard aggregate helper | 15 |
| A6 2:50–3:35 | **SDK box (45m cap):** tools → createTool → `/api/coach` (glm-5.3) + plain fallback + COACH_ENABLED + minimal coach page ⛔evaluator-SDK | 45 |
| A7 3:35–3:55 | red-team fixes from checkpoints | 20 |
| A8 3:55–4:20 | README AI/SDK + `key-prompts.md` + build-log entries | 25 |
| A9 4:20–5:00 | demo run-through with B, fixes, video timestamps | 40 |

**Person B — UI / auth / data (275m):**
| Slot | Task | Min |
|---|---|---|
| B1 0:25–1:15 | Clerk login + guards; student PIN login (scrypt, rate limit) + Session + switch + requireStudent/Teacher | 50 |
| B2 1:15–1:45 | db schema finalize + seed (2 own-written topics; 8 real + 30 simulated evals) | 30 |
| B3 1:45–2:35 | Teacher UI: notes → confirm screen → concept approve (photo/PDF disabled, honest note) | 50 |
| B4 2:35–3:20 | Student UI: login → picker → junior chat → done + Switch Student | 45 |
| B5 3:20–4:00 | Dashboard: counts, cluster chips, review queue + override, SIMULATED badges | 40 |
| B6 4:00–4:25 | **Deploy slot (optional):** Vercel + env + `--prod` + health green | 25 |
| B7 4:25–5:00 | README + screenshots + PPT (6 slides) + rehearsal | 35 |

Integration checkpoints (5m each, inside task times): ~1:20 (notes API), ~2:00 (chat),
~2:50 (eval+dashboard), ~4:20 (coach + full loop). Video = cut from continuous recordings.

## 9. Cut line (order we drop things)

1. Deploy (optional B6 slot) → local demo + README deploy steps.
2. Photo/PDF ingestion → typed-only (already cut from schedule).
3. Evaluator-as-SDK → plain structured call stays.
4. Google login → Clerk email+password only.
5. AI misconception clustering → deterministic tag counts + fixed labels.
6. Hindi UI chrome → English UI, Hindi kept inside junior chat.
7. Middle level → primary/secondary only.
8. Voice → never (correct per constraints).
9. Coach streaming polish → non-streaming JSON.

**Never cut:** typed notes → confirm → approve → junior chat → evaluate → switch
student → dashboard + override → plain coach answer.

## 10. Riskiest parts & reductions

| Risk | Reduction |
|---|---|
| Vision OCR garbage (blur/Hindi) | cut from demo; confirm gate is mandatory regardless |
| Junior reveals answers / drifts | hard prompt rules, 3–5 turn cap, red-team pass (log it) |
| Evaluator reliability challenged | confidence + review queue + override IS the design |
| SDK eats the clock | plain-first, 45-min cap, flag-gated, shared tools/ code |
| Auth blocks both people | B does auth first; A tests via curl + seeded cookie |
| Model catalog drift | single `models.ts`, catalog assert at setup, 1-line swap |
| Prisma/Mongo/ORM churn | native driver + Zod (no ORM, no codegen) |
| Key spend / rate limits | free models for dev; credited/ClinePass for demo; retry+backoff |
| Simulated data mistaken for real | `isSimulated:true` everywhere + badge + README |
| Honesty violations | `.clinerules` bans offline/real-school/copyrighted claims |

## 11. 3-minute demo script

| Time | Screen | Say |
|---|---|---|
| 0:00–0:20 | Problem slide; VS Code + Cline visible | One teacher, 50 kids, rote learning, wrong ideas hidden until finals. |
| 0:20–0:45 | Teacher login → paste notes → confirm → approve | She must confirm and approve everything before students see it. |
| 0:45–1:15 | Student: code RAIN7 + roll 14 + PIN → chat 2–3 turns (one vague answer pushed) | No email, no app. Roll + PIN the teacher issued. Junior asks one Q at a time, never answers. |
| 1:15–1:30 | Switch student → back to PIN screen | One phone, passed around; the next kid never sees the last kid's data. |
| 1:30–2:05 | Dashboard: counts, clusters, review queue, override | What stuck, what didn't, common wrong ideas; teacher has the final word. |
| 2:05–2:35 | Coach: "What should I re-teach tomorrow?" → tool-call trace → answer | A Cline SDK agent with read-only tools, scoped to her classes. One flag removes it. |
| 2:35–3:00 | README + build log + honesty slide | Built in 5h with Cline; here's what it got wrong and how we fixed it. Honest limits. |

## 12. Deliverables & Cline usage

- Public GitHub repo: README (problem, solution, architecture, stack, setup, **how
  Cline was used in the build AND inside the product**, honest limits), PLAN.md,
  `.clinerules`, `docs/build-log.md`.
- PPT (6 slides), mandatory demo video (cut from continuous recordings — the build
  log doubles as the shot list), social post tagging Cline.
- Build-time model policy: strong models for schema/auth/prompts/SDK; cheap models for
  Tailwind/copy/i18n/README. Record every notable Cline mistake → fix in `build-log.md`.




