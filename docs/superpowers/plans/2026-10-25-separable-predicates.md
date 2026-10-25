# Separable predicates implementation plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development. User approved implementation and separate PRs, no merge.

**Goal:** Address Issue #19 with two red predicate parts in original order, explicit shared explanation, and a real-model acceptance checklist kept open until owner verification.
**Architecture:** Keep flat segments and existing roles. Add optional `predicateOf` (same-sentence segment index) on a later predicate particle pointing to its earlier main predicate. Main lemma and particle lemma carry the complete phrasal verb; invalid optional links are discarded. Render a part label from validated relation; neither connections nor linked selection. Preserve all strict text/role/lemma validation.
**Tech Stack:** Native JS/Node, Playwright existing harness, no new runtime dependencies.

## Chunk 1: Reproduction and implementation

### Task 1: Core contract and prompt
Files: public/analysis.js, public/deepseek.js, tests/analysis.test.mjs, tests/deepseek.test.mjs.
- [x] Add failing fixtures for `You should give it up.` and `She turned the light off.` preserving whitespace. Require main and particle red predicate/core, object separate, whole lemma give up / turn off. New optional index must point backward to a non-part predicate/core with matching nonempty lemma and meaningful separated spans; no self/cycle/forward/other roles. Invalid link dropped without paid retry. Old valid results unchanged.
- [x] Replace contradictory unconditional ONE-contiguous-span / never separate rules with contiguous-unless-interrupted guidance. Add full separated example with accurate indexes and Chinese detail; up not complement/standalone upward. Keep contiguous give up smoking / look after him examples and linking/predicative rule. Do not broaden this change into question inversion.
- [x] Run targeted node tests, confirm initial failure then pass; preserve original-coverage and retry tests.

### Task 2: Simple rendering
Files: public/app.js, scripts/browser-check.cjs (or a small dedicated browser test integrated in package.json).
- [x] Main label remains `谓语：give up－放弃`; particle `谓语组成部分：与 give 构成 give up` (generalize using main lemma/phrase; no hardcoded input matching). Both red, it green; click either explains shared predicate and intervening object. Do not add linked highlighting or cross-word lines. Explain should in detail, not base-lemma gloss.
- [x] Browser tests inject validated mock analysis; verify exact original, label, both click details, no modifier-target highlighting, default/detail modes, 390px layout; retain normal contiguous/linking regression behavior.

### Task 3: Evidence and delivery
Files: docs/regression-cases.md, docs/roadmap.md, docs/verification.md, README.md.
- [x] Add five-case acceptance worksheet with baseline from 2026-10-19 explicitly historical and missing results marked pending. New live runs are not authorized by possession of a key and must not be fabricated. Include model, version, trial count, errors, real vs mocked evidence.
- [x] Record issue link, implementation pending merge, real-model/postdeploy acceptance pending; do not automatically close Issue #19 on merge. PR should use `Refs #19`, not auto-closing keywords.
- [ ] Run full npm test + browser suites with bundled Playwright and Edge, review spec then code/JS, push branch and open PR; never merge. Owner handles final live acceptance and issue closure.
