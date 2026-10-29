# 工作流程

最后更新：2026-10-29

## 分工
- **项目负责人（Shelikeit69）**：决定做什么、合并 PR、在网页上做真实验收。
- **编码工具**（Codex、Trae、Claude Code 等）：建分支、改代码、开 PR。不合并。
- **验收方**：看 PR 的改动、跑测试、全文扫旧说法。**验收方不能是这次写代码的那个工具或会话**，否则等于自己检查自己。小改动至少要有 CI `test` 绿勾加负责人上线实测；大改动（如任务 B）再找一个没参与编码的工具看一遍 PR。

所有编码工具共用仓库根目录的 `AGENTS.md`；Trae 另有 `.trae/rules/project_rules.md` 指向它，Claude Code 另读 `CLAUDE.md`。

## 一次改动的标准流程
1. 讨论清楚：要改什么、为什么改、怎么算改好了。
2. 按下面的模板写好任务单，交给编码工具执行。
3. 编码工具新建分支，修改后开 PR。**不直接推 main，也不自动合并。**
4. 等 PR 页面的 `test` 检查变成绿勾。
5. 验收 PR：改了哪些文件、测试结果、有没有旧说法残留、PR 描述里「已自动验证」「需要我手动验证」「已知限制」三部分。
6. 合并。Pages 会自动重新部署，等 Actions 显示绿勾。如果在 claude.ai 项目里讨论，再点项目页 GitHub 来源的「Sync now」，让代码快照跟上 main。
7. 打开网页版按 `Ctrl+F5` 强制刷新，用触发问题的原句实测一次。没修好就重新打开（Reopen）对应的 Issue。
8. 把结论写进 [decisions.md](decisions.md)；产品待办改 [`docs/roadmap.md`](../roadmap.md)；功能或架构变了，同步 [overview.md](overview.md)、[architecture.md](architecture.md)、[prompt-rules.md](prompt-rules.md)。这些都走 PR。

## 编码工具注意事项
- 不用子代理、多代理或「计划 → 子代理实现 → 多轮复审」这类流程，小改动非常耗额度（PR #20、#21 都是这样）。
- 计划类文件（如 `docs/superpowers/`）不提交进仓库，计划写在 PR 描述里。
- 测试生成的截图等文件放 `artifacts/`（已在 `.gitignore`），不提交。
- 修复 Issue 的 PR 写 `Fixes #编号`，不要写 `Refs`。
- 每个任务单开头都写：`Single session. Do not use subagents or commit plan files.`

## 任务单模板
```
Single session. Do not use subagents or commit plan files.

# 背景
项目：句间 · 英文语法分析器（github.com/Shelikeit69/grammar-analysis）。
先读 AGENTS.md 和 docs/project/README.md。
相关文件：<比如 public/deepseek.js 的 SYSTEM、public/analysis.js、public/app.js>

# 问题
输入：<原句>
实际结果：<错误的标注或现象，最好附截图>
期望结果：<正确的标注>

# 要做什么
<具体改动>

# 不能做什么
- 不放宽 validateAnalysis。
- 不删除或弱化 README 里的风险说明。
- 不直接推 main，不自动合并。

# 测试与验收
1. 补充对应测试（改提示词就加一条「SYSTEM 包含新规则关键句」的测试）。
2. npm test 和 npm run test:browser 全部通过。
3. 全文扫一遍：README、docs、demo.js、tests 里有没有旧说法或旧数值残留，把 grep 结果列进 PR 描述。
4. PR 描述用中文，分三部分：已自动验证、需要我手动验证、已知限制。

# 分支与 PR
新建分支 <名字>，开 PR 到 main。修复 Issue 时 PR 描述写 `Fixes #<编号>`（不要用 Refs）。
```

## 外部反馈的处理流程
1. 收到错句（网页反馈按钮、Reddit 回复、Issue、朋友反馈）。网页上的「这句分析有问题？」会预填 Issue，由用户自己提交。
2. 开一个 GitHub Issue，写清：原句、实际结果（截图）、正确答案（可留空）、反馈来源。
3. 判断问题类型：
   - **提示词问题**：成分或时态判断错 → 改 `SYSTEM`。
   - **校验问题**：结果被拒绝显示，或者明显错误的格式却通过了 → 改 `validateAnalysis`。
   - **排版问题**：标签重叠、换行异常、手机显示异常 → 改 `styles.css` 或 `app.js`。
   - **模型随机性**：重试一次就对了 → 记录下来，先不改。
   - **数据结构不够**：现有字段表达不了（如 Issue #27 的长从句）→ 并入对应的结构任务。
4. 修复 PR 的描述里写 `Fixes #编号`，合并时 Issue 会自动关闭。上线复测没修好就 Reopen。
5. 回复反馈的人，告诉对方已经修好了。

## 外部贡献者提的 PR
- 首次贡献者的 PR，Actions 不会自动运行，要手动批准。
- 批准前先看改了哪些文件，**特别确认 `.github/workflows/` 没被改动**。
- 没问题就点「Approve and run」，等 `test` 通过后再合并。

## 合并前自查清单
- [ ] `test` 是绿勾。
- [ ] 改动范围和任务一致，没有夹带别的修改。
- [ ] 没有提交计划类文件或测试生成的文件。
- [ ] 修复 Issue 的 PR 写的是 `Fixes #编号`。
- [ ] README、docs、demo.js 的说法和新行为一致；没有「待审核」「当前分支」「pending」这类合并后就过时的字样。
- [ ] `public/version.js` 的 `TOOL_VERSION` 在影响分析或反馈时已更新（实际合并日期加序号）。
- [ ] 风险说明没有被删掉或弱化。
- [ ] 截图或实测结果和 PR 描述一致。
