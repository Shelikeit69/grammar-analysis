---
alwaysApply: true
---

# Project rules for Trae

Before any change, read and follow `AGENTS.md` and `CLAUDE.md` in the repo root. They are the shared rules for all coding agents in this repo; this file only points to them so the rules live in one place.

Then read `docs/project/README.md` and the project doc it points to for the task. The product backlog is `docs/roadmap.md`.

Key reminders (full list in `AGENTS.md`):
- Work on a branch and open a PR. Never push to `main`, never merge.
- One session, no subagents, no committed plan files or generated screenshots.
- Do not loosen `validateAnalysis` or weaken the README / UI risk notes.
- Fix PRs use `Fixes #N`. PR description in Chinese: 已自动验证 / 需要我手动验证 / 已知限制.
- Run `npm test` and `npm run test:browser`, and grep for leftover old wording and version strings before opening the PR.
