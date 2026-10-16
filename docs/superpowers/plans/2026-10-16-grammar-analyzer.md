# Grammar Analyzer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build the approved personal English grammar annotation tool with DeepSeek and MIT licensing.
**Architecture:** Same-origin static UI and localhost-only Node server. Validate structured AI output before rendering original-text annotations; no persistence or exposed secrets.
**Tech Stack:** Node.js 22+, native HTTP/fetch/test runner, browser HTML/CSS/ES modules.

## Chunk 1: Working MVP

### Task 1: Backend and contract
Files: package.json, server.mjs, lib/analysis.mjs, lib/deepseek.mjs, tests/analysis.test.mjs, tests/server.test.mjs, .env.example, .gitignore.
- [x] Define JSON response: {sentences:[{text,translation,note,segments:[{text,role,translation,lemma,detail,level}]}],translation}. Segments exactly concatenate to sentence text; sentences cover input ignoring inter-sentence whitespace only. role enum subject,predicate,linking,object,predicative,complement,adverbial,attribute,other; level core/detail; all properties bounded strings. Whitespace/punctuation may use other role.
- [x] Write node:test cases for original text preservation, repeated words, invalid roles, missing lemma on verbs, whitespace, input limits, malformed/truncated provider responses, no-key errors, Host/Origin blocking and static file allowlist.
- [x] Implement validation and DeepSeek adapter with a bounded timeout, JSON mode, no raw provider errors returned; use injectable fetch for offline tests.
- [x] Implement localhost-only HTTP server with bounded JSON request body, same-origin checks, one active analysis request, no input logging, explicit static allowlist, safe error messages.
- [x] Run node --test; expected all tests pass. No real paid request without locally configured key.

### Task 2: Annotated UI
Files: public/index.html, public/styles.css, public/app.js, public/demo.js, tests/demo.test.mjs.
- [x] Build warm paper/ink reading surface with restrained colors, one input area and annotation output. No external assets or frameworks.
- [x] Render contiguous original text as phrase units, bind each label and connector to its exact unit, alternate top/bottom annotations with shared baseline, preserve spaces/punctuation, ensure wrapping without collisions.
- [x] Show felt unchanged with linking label feel－感到 and nervous with predicative label 紧张的. Supply explicit sample result, detail toggle, selected phrase explanation and sentence/paragraph translation.
- [x] Paste triggers debounced analysis; ignore IME composition; manual analyze, clear and example buttons; cancel stale requests when input changes, safe DOM text rendering, accessible status/errors/focus.
- [x] Check example validates against contract using node --test. Browser verify desktop and 390px/mobile, label attachment, long phrases, repeated analysis, errors, clear and stale-response behavior.

### Task 3: Documentation and delivery
Files: README.md, .github/workflows/ci.yml.
- [x] Document Node requirements, copy .env.example to .env, enter key locally, npm start, browser URL, API/data privacy, configurable model, localhost restriction, limitations and troubleshooting.
- [x] Add CI using node --test, preserve MIT license.
- [x] Review spec compliance then code/security quality, resolve findings, run final tests and syntax checks.
- [ ] Commit only intended files, push feature branch, open and attach PR. Report live DeepSeek verification limitation if key absent.
