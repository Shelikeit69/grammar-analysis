# AGENTS.md

Shared rules for every coding agent working in this repo (Codex, Trae, Claude Code, others). Claude Code also reads `CLAUDE.md`; its coding guidelines apply to all agents.

## Read first
- `docs/project/README.md`, then the file it points to for your task. Product backlog: `docs/roadmap.md`.
- Code, prompt text and tests are the source of truth. If `docs/project/` disagrees with the code, update the docs in the same PR.

## How to work
- Do not use subagent-driven or multi-agent workflows; work in one session.
- Do not commit planning files; put plans in the PR description.
- Do not commit generated files (screenshots etc.); write them under `artifacts/`, which is gitignored.
- Small changes (<300 lines): one review pass is enough.
- Always work on a branch and open a PR to `main`. Never push to `main`, never merge.
- PRs that fix an issue must use `Fixes #N`, not `Refs #N`.
- PR description in Chinese, three sections: 已自动验证 / 需要我手动验证 / 已知限制.

## Must not
- Do not loosen the core checks in `validateAnalysis` (`public/analysis.js`). New optional fields that fail validation are dropped, never rejecting the whole result and never triggering the paid repair retry.
- Do not remove or weaken the risk notes in README and the UI: AI can be wrong; validation only checks format, not grammar; the API key stays in the user's browser; feedback issues are public.
- Do not add a backend, database, analytics, or automatic issue submission.
- Do not change the CI job name `test` (branch protection depends on it) or touch `.github/workflows/` unless the task says so.

## Every PR
- Prompt change: add a test in `tests/deepseek.test.mjs` that `SYSTEM` contains the new rule's key sentence.
- Run `npm test` and `npm run test:browser`; both must pass.
- If the change affects analysis or feedback output, bump `TOOL_VERSION` in `public/version.js` to the actual merge date plus a sequence number (e.g. `2026-10-28.2`).
- Scan README, `docs/`, `public/demo.js`, `tests/`, `scripts/` for old wording, old numbers and old version strings, and list the grep results in the PR description.
- Update `docs/project/` and `docs/roadmap.md` when the change adds a feature, a decision or a known issue.
- User-reported sentences go into public tests only after being rewritten as a fictional sentence with the same structure.
