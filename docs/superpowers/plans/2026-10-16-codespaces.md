# GitHub-only testing implementation plan

Goal: Run the existing frontend and DeepSeek backend inside GitHub Codespaces with a private forwarded port, no external hosting. No Pages deployment, no secrets in frontend or Actions artifacts.

- [x] Add .devcontainer/devcontainer.json with Node 22 image, forwarded port 3000, documented private visibility (GitHub default), and recommended DEEPSEEK_API_KEY secret. Start explicitly with npm start so no API requests happen on creation.
- [x] Add exact Codespaces host/origin detection from trusted process environment. Accept only this codespace and port, never arbitrary forwarded headers, other codespaces or HTTP origins. Preserve localhost behavior and binding.
- [x] Add tests for disabled/malformed configuration, expected HTTPS origin with forwarded/local Host, wrong port/name/domain and spoofed headers. Update missing-key guidance for Codespaces.
- [x] Document private repository setup, Codespaces Secrets, selecting feature branch before merge, create Codespace, npm start, private port preview and stop/restart. Explain quota and no live verification without key.
- [x] Code/JS review, npm test, browser regression, commit/push to PR1 and verify CI.
