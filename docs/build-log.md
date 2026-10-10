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
