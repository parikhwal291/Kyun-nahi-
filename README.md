# AI Practice Companion for Indian Classrooms

A mobile-first web app that helps students explain what they understand, while giving teachers a clearer view of what may need to be re-taught.

Students practise by explaining a concept to an AI **“confused junior”** in English or Hindi. The junior asks one question at a time instead of immediately giving away the answer. Teachers can review concept-level results, inspect possible learning gaps, override AI evaluations, and ask a Cline SDK-powered **teacher coach** questions about their class.

> **Hackathon prototype:** built in a five-hour sprint with Cline. The app uses simulated demo data and has not been validated through real-school trials.

**Live demo:** `[Add your deployed app URL]`  
**Repository:** `[Add your repository URL if this README is being shared separately]`

---

## The problem

In the classroom context this prototype is designed for, students may memorise answers without developing strong foundations. A teacher working with a large class—or several grades together—has limited time to hear every student's reasoning. Misconceptions can therefore remain hidden until a test or exam.

This is especially challenging when students learn in a language different from the one they think in, or when a class shares one phone and students do not have individual devices or email addresses.

## The solution

The app creates a short practice loop:

1. **Teacher prepares the lesson:** pastes notes, reviews the extracted text, and confirms the concepts and evaluation guidance.
2. **Student explains:** signs in with a class code, roll number, and teacher-issued four-digit PIN, then explains a selected concept to the AI junior over a short private chat.
3. **Teacher reviews:** sees concept-level results and potential gaps, reviews low-confidence evaluations, and decides what to revisit.
4. **Teacher coach helps plan:** a Cline SDK-powered assistant can answer questions about the teacher's class data using read-only tools.

The AI is assistive, not the final authority. Teachers can review and override evaluations.

## Try the student demo

Use these demo credentials to explore the student experience:

| Field | Demo value |
|---|---|
| Class code | `RAIN7` |
| Roll number | `1` |
| Four-digit PIN | `1001` |

### How to try it

1. Open the student login page in the deployed app.
2. Enter the class code, roll number, and PIN above.
3. Choose an available concept and explain it to the AI junior.
4. Use **Switch student** when you finish.

> **Demo-account note:** these are shared hackathon credentials for simulated data only. Do not use them for real student records or sensitive information. Anyone who can access the public demo may be able to use this account.

**Teacher demo access:** `[Add teacher demo instructions or credentials only if you have a safe demo account configured]`

---

## Features

### For teachers

- Sign in using Clerk (email and password).
- Paste lesson notes, review the text, and confirm it before practice content is prepared.
- Review and edit rubrics, possible misconceptions, and prerequisite concepts before approving them.
- View a dashboard with per-concept status counts, misconception tag counts and sample IDs, prerequisite-gap counts, a low-confidence review queue, and a count of simulated rows.
- Review AI evaluations and override them when needed.
- Ask the AI teacher coach questions such as **“What should I re-teach tomorrow?”**
- Use the teacher coach through read-only tools scoped to the teacher's classes.

### For students

- Log in with a class code, roll number, and teacher-issued four-digit PIN; no student email is required.
- Choose a concept from the practice list.
- Explain the concept in English or Hindi over a short, private chat of approximately 3–5 turns.
- Respond to a junior that asks one question at a time and is instructed not to reveal the answer.
- Use **Switch student** on a shared device to end the current session before the next student begins.

### Shared-device session handling

The student flow is designed for classrooms where multiple students may share one phone. Switching students revokes the active session, expires the session cookie, and marks the conversation as finished. This prototype's four-digit PIN is intended for low-stakes practice, not exam-grade identity verification or access to sensitive records.

---

## Screenshots

Add screenshots from the **running application** before submitting the repository. Prefer cropped images without browser clutter, and make sure all student information shown is simulated.

Suggested files and locations:

- `docs/screenshots/student-chat.png` — student chat with the AI junior
- `docs/screenshots/teacher-dashboard.png` — teacher dashboard and learning-gap summary
- `docs/screenshots/teacher-coach.png` — teacher coach response and, if available, its tool trace

Once the images are committed, uncomment or adapt these lines:

```md
![Student chat](docs/screenshots/student-chat.png)

![Teacher dashboard](docs/screenshots/teacher-dashboard.png)

![Teacher coach](docs/screenshots/teacher-coach.png)
```

Use only screenshots that reflect the current build. Label sample conversations and seeded examples as simulated; do not present them as real student data or evidence of real-school outcomes.

---

## How Cline was used

We built the prototype in a five-hour sprint with Cline as our AI coding partner. We used it to help implement and iterate on the application, investigate framework and API issues, and refine prompts and safety-related behaviour.

### Cline inside the product

- **Cline API:** model calls are routed through the Cline API using an OpenAI-compatible interface.
- **Cline SDK:** the teacher coach is implemented as an agent that uses read-only tools scoped to the teacher's class data.
- **Task-based model routing:** the application uses different model configurations for tasks such as concept extraction, student chat, answer evaluation, and teacher coaching. Model IDs can change as the provider catalog changes, so verify the IDs configured in the current repository before documenting specific names.
- **Teacher oversight:** AI evaluations are intended to support teacher judgement, not replace it. Teachers can review and override results.

### Build lessons and bugs we addressed

During the build, we encountered and worked through several integration issues:

- **Next.js 16 routing conventions:** updated the route-guard approach after discovering the framework's `proxy.ts` convention.
- **Clerk authentication changes:** moved away from a deprecated route-matcher pattern and used resource-based authentication checks for teacher routes.
- **Prerendering and runtime data:** handled Clerk authentication and sign-in components in the relevant rendering context, including the use of `Suspense` where needed.
- **Cache Components:** removed a `force-dynamic` setting that conflicted with `cacheComponents: true` in the project configuration.
- **Model catalog drift:** checked available model identifiers against the live catalog instead of assuming documented prefixes were still valid.
- **Cline API response shape:** added custom response and error extraction for the API's wrapped completion response.
- **Reasoning-model token limits:** diagnosed empty output from a test configured with `max_tokens=5` and increased the test budget to provide more room for reasoning and output.
- **Prompt construction:** fixed missing closing braces that caused a TypeScript parse error and reinforced the instruction not to reveal the answer.
- **Misconception-tag safety:** constrained generated tags to an allowed whitelist in deterministic code rather than accepting arbitrary model-generated tags.
- **TypeScript narrowing:** changed a text-checking helper to use a type predicate so TypeScript could narrow the value correctly.

These are implementation lessons from the sprint, not claims of a formal benchmark. Make sure the repository's build notes reflect the final fixes before referring judges to them.

---

## Architecture and tech stack

| Area | Technology / approach |
|---|---|
| Web framework | Next.js 16 App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Database | MongoDB Atlas (M0/free shared tier for the prototype) |
| Data access and validation | MongoDB native driver (`mongodb` 7.x) and Zod; no Prisma or other ORM |
| Teacher authentication | Clerk |
| Student authentication | Custom class-code + roll-number + PIN login |
| PIN verification | Node.js built-in `crypto.scrypt` |
| Student session | Rate-limited login and opaque signed cookie with a 30-minute sliding TTL |
| AI integration | Cline API and Cline SDK |

### High-level flow

```text
Teacher
  └─ Pastes notes → reviews extracted text → confirms concepts and guidance
                                      │
                                      ▼
Student ── class code + roll number + PIN ──► Concept practice
                                                 │
                                                 ▼
                                      AI “confused junior” chat
                                                 │
                                                 ▼
                                      Evaluation and class data
                                                 │
                              ┌──────────────────┴──────────────────┐
                              ▼                                     ▼
                       Teacher dashboard                     Teacher coach
                                                         (Cline SDK, read-only tools)
```

---

## Getting started

### Prerequisites

- Node.js version supported by the project's Next.js setup
- npm
- A MongoDB Atlas connection string
- Clerk application keys
- A Cline API key

### Run locally

1. Clone the repository:

   ```bash
   git clone <your-repository-url>
   cd <your-repository-directory>
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy the example environment file:

   ```bash
   cp .env.example .env
   ```

   On Windows PowerShell, you can use:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Fill in the environment variables documented in `.env.example`, including the Clerk keys, MongoDB URI, and `CLINE_API_KEY`. Keep real secret values in your local environment; **never commit `.env` or API keys**.

5. Start the development server:

   ```bash
   npm run dev
   ```

6. Open the local URL printed by Next.js in your terminal.

> If `.env.example` is missing or variable names differ, update these instructions to match the actual repository before publishing this README.

---

## Honest limitations

- **Prototype PIN security:** a four-digit PIN is suitable only for low-stakes classroom practice, not exams or sensitive student records.
- **Plain-text input only:** teacher notes can be pasted as text; photo and PDF ingestion are not implemented.
- **Simulated data:** seeded student and evaluation data are simulated and should be marked clearly in the interface.
- **Internet required:** there is no offline mode.
- **AI evaluation is assistive:** teachers retain the final word and can override evaluations.
- **Hindi quality needs more testing:** Hindi support has only been lightly tested.
- **No real-school outcome claims:** the prototype has not been validated through real-school trials.
- **Not every planned capability is complete:** check the running build and repository before presenting any feature as implemented.

---

## Future scope

- Add photo and PDF ingestion for teacher notes.
- Add Google login for teachers.
- Explore model-assisted misconception clustering; the current approach uses deterministic tag counts.
- Add streaming responses for the teacher coach.
- Expand offline capabilities and improve language support.
- Test with teachers and students in real classroom settings, with appropriate consent and privacy safeguards, before making learning-outcome claims.

---

## Privacy and responsible use

This is a hackathon prototype that uses simulated data. Do not enter real student names, grades, personal information, or other sensitive records into a public demo. The public student credentials above are intended only for the seeded demo account. Before any real classroom deployment, review authentication, session isolation, data retention, access controls, consent, and applicable school privacy requirements.

---

## Team

- **[Pari Khandelwal]** - Worked on AI prompts, concept extraction, student–junior conversations, answer evaluation, and integrating the Cline SDK teacher coach.
- **[Parth Sandeep Maliye]** — Worked on the teacher and student interfaces, PIN-based student login, session handling, MongoDB integration, and the teacher dashboard.

**Built in eight hours with Cline.**
