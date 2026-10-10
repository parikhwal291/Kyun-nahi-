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

## Entry 07 — 2:25 — A4 evaluateConversation + evaluator red-team (A)
**Task:** Build `evaluateConversation` (plain call) + `/api/chat/evaluate` route; grade causal points, not vocabulary.
**Model tier:** strong (evaluateConversation → `anthropic/claude-sonnet-5.5`).
**Prompt excerpt:** "Grade the causal ideas… A student who explains the idea in their own words, without the textbook term, can still be 'understood'." transcript wrapped as DATA only.
**What Cline got wrong:** Nothing in the model output — the risky edges were anticipated in code: a deterministic fast path handles "I don't know"/too-short (not_yet + honest confidence) before any model call, and `misconceptionTag` is clamped to the concept's own `wrongIdeas[].label` so the model can never return an invented tag.
**Fix:** n/a (guards pre-empted the failures); added `tsx` devDependency so the git-ignored `scripts/redteam.ts` can run (`node --env-file=.env --import tsx`).
**Outcome:** 4/4 evaluator cases pass — clearly correct → understood (conf 82); wrong + known misconception → not_yet + tag "Clouds are smoke" (conf 92); vague/short → not_yet (conf 20); correct without textbook term → understood. `npm run build` green.
**Lesson:** Put safety clamps (tag whitelist, not_yet fast path) in code, not just the prompt — the schema gate alone doesn't know the concept's labels.

## Entry 06 — 2:05 — A3 juniorTurn + 4 templates + red-team (A)
**Task:** Build `juniorTurn` (primary/secondary × en/hi), the `/api/chat/turn` route with `requireStudent` + DB seams, and the git-ignored red-team script.
**Model tier:** cheap (juniorTurn → `google/gemini-2.5-flash`; fallback `cline-pass/deepseek-v4.1-flash`).
**Prompt excerpt:** "You are the student's much younger sibling… You NEVER give answers. … NEVER reveal the answer." (start + end); student text wrapped in `<student_message>` as DATA only.
**What Cline got wrong:** Chunking the large `junior.ts` prompt and the test script across editor calls dropped a closing brace in `scripts/redteam.ts` — `next build` failed with TS1005. Also the "never reveal" rule was initially a single line; moved it to the start AND end of the prompt.
**Fix:** Rebalanced braces; stated "NEVER reveal the answer" at both ends; added deterministic `detectDistress`/`stopMessage` and a `nearlyCopiesRubric` (≥5 shared significant words → regenerate once).
**Outcome:** Red-team 13/13 PASS on the first run — asks-for-answer ×3 (incl. Hindi), off-topic, distress, 5000-char injection, wrong/correct answers, full 5-turn chat, plus the 4 evaluator cases. `npm run build` green.
**Lesson:** Big single-file edits must be split into small, brace-balanced chunks — and always re-run the type check after multi-part edits.


## Entry 05 — 1:55 — max_tokens=5 probe starved reasoning models (A)
**Task:** Re-probe cline-pass/* slugs and harden the AI client.
**Model tier:** cheap (probe: "Reply with the single word: ok", max_tokens=300).
**Prompt excerpt:** "Reply with the single word: ok".
**What Cline got wrong:** The first probe used max_tokens=5. Reasoning models (qwen3.7-plus, glm-5.3, deepseek, gemini-2.5-pro) spent all 5 tokens on hidden reasoning, leaving empty visible content — the gateway returned 500 "empty response content", which Cline misread as "slug doesn't exist" (Entries 01/03).
**Fix:** Re-probed with max_tokens=300; everything except cline-pass/qwen3.8-max (timeout >40s) returns 200 with content. Restored cline-pass/glm-5.3 + cline-pass/mimo-v2.6-flash; added per-job max_tokens (800/1500/3000) with reasoning headroom, empty+length → double-and-retry, and per-request timeouts (30s/60s). probeModel now reports status/empty/finish/reasoning.
**Outcome:** `npm run build` green; deep probe reports per-model status/empty/finish/reasoning.
**Lesson:** For reasoning models, token budget must cover reasoning + answer; "empty response content" is token starvation, not a missing model.

## Entry 04 — 1:35 — completion response is wrapped in `data` (A)
**Task:** A1/A2 follow-up — add a per-model probe and restore `cline-pass/*` slugs.
**Model tier:** cheap (probe: `max_tokens=5`, "hi").
**Prompt excerpt:** n/a.
**What Cline got wrong:** The client parsed `/chat/completions` as bare OpenAI `{ choices: [...] }`, but api.cline.bot wraps it as `{ data: { choices: [...] } }`, so every completion would have returned empty text. Error bodies are also flat `{ error: "..." }`, not `{ error: { message } }`.
**Fix:** Added `extractCompletionText` (handles both shapes) and `extractErrorMessage` (handles both error shapes); `attempt()` and `probeModel()` use them.
**Outcome:** `npm run build` green; a live `cline-pass/qwen3.7-plus` probe now parses its content.
**Lesson:** Inspect one real completion response before writing the parser — don't trust the documented shape.

## Entry 03 — 1:25 — cline-pass/* slugs are callable but not in the catalog list (A)
**Task:** Determine which `cline-pass/*` slugs are actually ClinePass-tier.
**Model tier:** cheap (probe: `max_tokens=5`, "hi", 2 attempts each).
**Prompt excerpt:** `hi`.
**What Cline got wrong:** Entry 01 treated the catalog list as authoritative and "corrected" `cline-pass/*` → `deepseek//qwen//z-ai/`. The list omits `cline-pass/*`, but the slugs are still callable.
**Fix:** Probed 5 slugs — `qwen3.7-plus` 200/200, `deepseek-v4.1-flash` 200/500 (flaky), `glm-5.3`/`mimo-v2.6-flash`/`qwen3.8-max` 500/500 ("empty response content"). Restored the passing slugs as ClinePass-tier; kept `deepseek//qwen//z-ai/` as credit fallbacks; the 402 fallback set now holds only `cline-pass/*`.
**Outcome:** `/api/health?deep=1` now probes every model in `models.ts`; `cline-pass/qwen3.7-plus` is the group primary and `cline-pass/deepseek-v4.1-flash` is the junior-turn ClinePass fallback.
**Lesson:** For `cline-pass/*`, a real completion probe is the only authority — never the catalog list.

## Entry 02 — 1:20 — `export const dynamic` breaks with `cacheComponents` (A)
**Task:** A1/A2 — build the AI routes (`/api/health`, notes, concepts) and validate with `npm run build`.
**Model tier:** n/a (Next 16 build).
**Prompt excerpt:** n/a.
**What Cline got wrong:** Cline added `export const dynamic = "force-dynamic"` to three route handlers. With `next.config.ts`'s `cacheComponents: true`, Next 16 rejects that segment config ("not compatible with `nextConfig.cacheComponents`").
**Fix:** Removed `export const dynamic` from `src/app/api/health/route.ts`, `src/app/api/teacher/notes/route.ts`, `src/app/api/teacher/concepts/route.ts`. Route handlers are dynamic by default (GET touches `request.url` / DB).
**Outcome:** `npm run build` green; routes listed as `ƒ` (dynamic).
**Lesson:** With `cacheComponents` enabled, don't declare `dynamic` on route handlers — Next 16 handles it.

## Entry 01 — 0:45 — ClinePass model IDs missing from live catalog (A)
**Task:** A1 — create `ai/models.ts` with the exact model IDs from PLAN §6.
**Model tier:** n/a (catalog assertion against `GET /api/v1/models`).
**Prompt excerpt:** n/a.
**What Cline got wrong:** PLAN §6 routes three models through a `cline-pass/*` namespace (`cline-pass/deepseek-v4.1-flash`, `cline-pass/qwen3.7-plus`, `cline-pass/glm-5.3`), but the live catalog (458 models) exposes no `cline-pass/*` prefix at all.
**Fix:** Asserted the live catalog; mapped to the closest real IDs (`deepseek/deepseek-v4.1-flash`, `qwen/qwen3.7-plus`, `z-ai/glm-5.3`) in `models.ts`, and encoded the 402→ClinePass fallback on the corrected IDs.
**Outcome:** `/api/health` catalog assertion now passes; mapping documented in the `models.ts` header.
**Lesson:** The live catalog is authoritative — verify model slugs at setup, never trust the docs.
