# Issue feedback implementation plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development. User approved separate PR, no merge or automatic issue submission.

**Goal:** Every sentence and analysis failure can start a private editable preview, then explicitly open a prefilled public GitHub Issue; no backend/database/account system.
**Architecture:** A pure feedback module formats whitelisted analysis data and builds a bounded GitHub URL. A small dialog handles preview, editing, consent and clipboard fallback. App owns immutable source/model snapshots tied to the completed or failed request. GitHub navigation happens only on explicit confirmation; final issue submission remains on GitHub.
**Tech Stack:** Native DOM dialog, JS modules, Node tests, Playwright, existing GitHub Pages.

## Chunk 1: Safe feedback payload

### Task 1: Payload and navigation
Files: public/feedback.js, public/version.js, tests/feedback.test.mjs, .github/ISSUE_TEMPLATE/analysis-error.md.
- [ ] Test-first format a report containing selected original sentence, only its validated result fields, model used by that request, explicit app revision constant, optional user explanation and editable title/body. No key/settings/header/storage/raw provider response serialization. Preserve unknown-model label rather than guessing. Demo labeled not an AI run.
- [ ] Pure URL builder fixed to https://github.com/Shelikeit69/grammar-analysis/issues/new with URLSearchParams; only latest edited preview goes into URL after confirmation. For encoded URLs over 6000 characters, keep complete editable body available to copy and open a short GitHub URL with instructions to paste, never silently truncate analysis. Clipboard refusal must show manual copy fallback.
- [ ] Add a simple Markdown issue template with optional expected answer, model/version and a public-data reminder. No requested personal/contact information. Explicit user final submission; no API posting or GitHub token.

### Task 2: UI integration and snapshots
Files: public/app.js, public/index.html, public/styles.css, server.mjs, tests/server.test.mjs, browser test scripts/package.json.
- [ ] Small `这句分析有问题` button per result. Error area has `报告分析问题` for request failures and no-result cases. Clear/edit/new request/demo must remove stale failure data and close/reset stale preview; settings edits must never relabel an old analysis with the new model.
- [ ] A single accessible dialog: title/body editable, optional explanation or editable placeholder, visible warning that opening link sends content to GitHub and submission is public/requires GitHub account, no need to know the right answer; checkbox confirmation, cancel/Escape and focus return. No outbound data before confirmation. Show copy fallback before navigating long reports.
- [ ] Browser mode captures requested model before call; local mode status returns configured model (nonsecret) so reports can identify it. Older status response => model unknown. Preserve existing clients and tests, no provider/error internals exposed.
- [ ] Keep report state in memory. Add module assets to server and static-test allowlists. Use textContent/value, not innerHTML. Keep analysis status/retry/cancel behavior and layout unchanged.
- [ ] Browser tests: sentence-specific payload, edited-preview URL, consent gate/no-navigation cancel/Escape, error with no results, model snapshot after settings changes, clearing/edit/new analysis stale isolation, long-body clipboard failure fallback, malicious text safe rendering, mobile dialog. All external requests mocked; no real Issue created by tests.

### Task 3: Documentation and verification
Files: README.md, docs/roadmap.md, docs/verification.md.
- [ ] Explain ordinary analysis is not stored by app; explicitly confirmed reports go to GitHub and public submitted Issues persist there. Mention copied reports remain in clipboard until overwritten. No database/telemetry. Cite official query-parameter docs: https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-an-issue .
- [ ] Move feedback before B with status implemented pending review, not deployed. Link real Issue #19 as first tracked correction. Closure rule: related PR → owner merge → real-model deployed retest → close Issue; do not auto-close #19 or claim live success.
- [ ] Run npm test and all browser suites, spec review then code/JS/security review; create separate PR against main, no merge. Verify both PRs can integrate (resolve any conflicts in branch if needed after preparing first PR).
