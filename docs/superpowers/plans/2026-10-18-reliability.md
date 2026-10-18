# Analysis Reliability Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement this plan, with read-only review before delivery.

**Goal:** Fix confirmed settings/browser-test regressions and add one bounded, cancelable model-format repair; deliver PR without merge.
**Architecture:** Keep native browser/Node shared modules. Introduce typed validation reasons, reuse the same overall abort/timeout signal across at most two provider calls. The UI gets repair progress directly in Pages mode and via opt-in NDJSON from the existing local API; ordinary JSON clients stay compatible.
**Tech Stack:** Existing Node 22+, native fetch/HTTP, vanilla JavaScript and Playwright checks.

## Chunk 1: Reliability

### Task 1: Core format repair
Files: public/analysis.js, public/deepseek.js, lib/analysis.mjs, tests/analysis.test.mjs, tests/deepseek.test.mjs.
- [x] Add typed core validation errors with bounded, program-generated reasons (no secrets/raw provider data).
- [x] Retry only model content JSON syntax or core validation failures; never HTTP/network/abort/timeout/oversize or unrelated failures. At most two calls total, including unchanged original input, failed content and a clear correction instruction in the second request.
- [x] Use one combined cancellation/deadline for both calls; notify onRepair before second call and check cancellation after notification. Second response goes through full original validation.
- [x] Keep optional metadata behavior; malformed optional tense/tenseReason discarded rather than triggering a paid repair, unknown modifies/clauses ignored pending their own work.
- [x] Tests: bad→good, bad→bad, no third call, HTTP/nonformat failures no retry, cancellation before/during repair, shared timeout and optional invalid metadata fallback.

### Task 2: UI and API integration
Files: public/app.js, public/server-client.js, server.mjs, tests/server.test.mjs, scripts/browser-check.cjs.
- [x] Blank key input keeps current key when changing model/remember setting. Only explicit Clear removes key. Storage failures reported honestly; failed removal warning makes persistence limitations clear.
- [x] Show retry cost notice before analysis and progress text 正在修正格式，再试一次（会额外调用一次 DeepSeek） during retry.
- [x] Opt-in Accept application/x-ndjson: server emits {type:progress,stage:repairing}, then {type:result,data} or {type:error,error}. Initial auth/input failures stay HTTP JSON; do not expose raw model/errors. Existing JSON response remains default.
- [x] UI read bounded progress stream, preserve stale-response isolation and clear/edit cancellation, keep standard JSON fallback for tests/clients.
- [x] Fix demo-dependent test assertions and add browser Pages-mode scenarios using mocked provider responses and fake keys (never live secrets). Verify full pipeline including repair UI and cancellation.

### Task 3: Checks, docs and delivery
Files: .github/workflows/ci.yml, .github/workflows/pages.yml, docs/regression-cases.md, docs/roadmap.md, docs/verification.md, README.md.
- [x] Make browser checks part of CI and predeployment checks using pinned Playwright test tooling; no new runtime dependency.
- [x] Add 10 grammar reference cases pending human review with expected structure/tense, explicit manual model-evaluation status; do not pretend deterministic mocks prove model quality.
- [x] Update retry billing/timeout docs, line-gap wording (<50px in existing assertion), ordered roadmap A→merge+manual→B→feedback; distinguish JSON mode from strict schema support.
- [ ] Run full npm test and browser suite; code/JS/security review, resolve findings, push new branch, open and attach PR. Never merge.

Scope boundary: no A/B visualization implementation before required sequential acceptance, no external feedback service, no repository visibility changes, no paid model calls. Those roadmap items remain pending.
