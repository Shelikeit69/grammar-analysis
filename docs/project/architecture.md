# 技术架构

最后更新：2026-10-29（对应仓库 main 提交 676ecb0，含 PR #20–#28）

## 三种运行方式（共用同一套页面 public/）
| 方式 | 密钥在哪里 | 页面怎么判断 |
|---|---|---|
| 网页版（GitHub Pages） | 访问者自己的浏览器 | 请求 `./api/status` 没有 JSON 回应 → 浏览器模式，显示密钥面板和三步引导，由浏览器直连 DeepSeek |
| Codespaces | Codespaces Secret `DEEPSEEK_API_KEY` | `./api/status` 有回应 → 服务器模式，不显示密钥面板 |
| 本地运行 | 本机 `.env` | 同上 |

- 已实测：浏览器直连 `api.deepseek.com` 不会被跨域拦截。
- Node 需要 22.9 或更新版本，没有第三方运行时依赖。
- `./api/status` 现在返回 `{configured, model}`（PR #21），反馈里用来写服务器模式的模型名；旧服务没有 `model` 时显示「未知」。

## 文件结构
- `public/index.html`：页面，含反馈对话框 `#feedback-dialog`。meta CSP 只允许连接本站和 `https://api.deepseek.com`，资源用相对路径（适配 `/grammar-analysis/` 子路径）。
- `public/app.js`：界面逻辑（渲染批注、修饰高亮、分离谓语标签和说明、模式判断、密钥面板、三步引导、大字开关、错误提示、格式修正提示、反馈表单）。
- `public/styles.css`：样式。标签和英文放在同一格，高度为 0 向外溢出；只有带标签的片段才通过 `--label-space` 留出空间。大字模式用 `html.large-text` 加 CSS zoom 1.25（只放大 masthead、main、footer，不影响反馈弹窗）。反馈按钮用 `.report-button`；反馈弹窗底部操作区固定（`.feedback-footer`），主按钮在 `.feedback-steps` 里（PR #28）。
- `public/deepseek.js`：Node 和浏览器共用的 DeepSeek 客户端，系统提示词常量 `SYSTEM` 和「格式修正一次」的逻辑都在这里。
- `public/analysis.js`：`validateInput`、`validateAnalysis`、`AnalysisValidationError`，Node 和浏览器共用。
- `public/feedback.js`：`FEEDBACK_TYPES`（5 个问题类型）、反馈标题和易读正文生成（只放白名单字段）、GitHub Issue 预填链接（上限 6000 字符；超过时只带真实标题和粘贴说明，正文由用户粘贴）（PR #21、#25、#28）。
- `public/version.js`：`TOOL_VERSION`，写进反馈正文。当前为 `2026-10-28.2`（PR #28）。发布影响分析或反馈的改动时要更新，用实际合并日期加序号。
- `public/server-client.js`：本地和 Codespaces 模式下读取服务器返回结果（支持 NDJSON 进度消息，旧的纯 JSON 也兼容）。
- `public/demo.js`：内置例句和它的分析结果（含 `modifies`）。
- `lib/analysis.mjs`、`lib/deepseek.mjs`：只是转发 `public/` 里的共用模块。
- `lib/access.mjs`：本地和 Codespaces 的访问来源校验（只允许 127.0.0.1 和本 Codespace 的域名）。
- `server.mjs`：本地和 Codespaces 用的 HTTP 服务，只监听 127.0.0.1。新增的 `public/` 文件要加进它的资源白名单，也要加进 `scripts/browser-pages-check.cjs` 的白名单。
- `tests/`：node --test 单元测试，共 64 项。
- `scripts/browser-check.cjs`：Playwright 排版与交互检查（62 项，含 #26 新增的分离谓语点击说明检查）；`scripts/browser-pages-check.cjs`：模拟 Pages 静态网页的检查（11 项）；`scripts/browser-feedback-check.cjs`：反馈流程检查（150 项断言，PR #28 起包含长链接两步流程和 380/390px 排版检查，会生成截图到 `artifacts/feedback/`）。都用模拟响应，不调用真实 DeepSeek，也不提交真实 Issue。
- `.gitignore`：`artifacts/` 已加入（PR #28），测试生成的截图不提交。
- `.github/ISSUE_TEMPLATE/analysis-error.md`：「分析问题反馈」Issue 模板，标题和网页生成的正文一致：问题类型 / 具体说明 / 用户认为正确的 / 原句 / AI 分析结果 / 调用模型 / 工具版本。
- `.github/workflows/ci.yml`：每次 push 和 PR 都跑 `npm test`，再装 Playwright 跑 `npm run test:browser`。任务名叫 `test`（分支保护依赖这个名字，别改）。
- `.github/workflows/pages.yml`：推送到 main 时先跑单元测试和浏览器测试，再只发布 `public/`，不用任何 Secrets。
- `CLAUDE.md`：给 Claude Code 的编码准则。
- `AGENTS.md`：所有编码工具共用的规则（Codex、Trae、Claude Code）：单会话、不用子代理、不提交计划文件和生成文件、走分支和 PR、修复 PR 用 `Fixes #N`、不放宽校验、版本号和旧说法检查（PR #23、#24，2026-10-29 扩充）。
- `.trae/rules/project_rules.md`：Trae 的项目规则，始终生效，只指向 `AGENTS.md` 和 `CLAUDE.md`。
- `docs/`：Codespaces 测试指南、验证记录（`verification.md`、`feedback-verification.md`）、`roadmap.md`（仓库里的路线图）、`regression-cases.md`（10 条语法样例 + Issue #19 五句）、`project/`（项目资料，见 `docs/project/README.md`）。

## AI 返回的数据格式
```json
{
  "sentences": [{
    "text": "原句",
    "translation": "整句翻译",
    "note": "结构说明",
    "tense": "一般将来时 · 主动语态；一般现在时 · 主动语态",
    "tenseReason": "判断依据",
    "segments": [
      {"text": "原文片段", "role": "subject|predicate|linking|object|predicative|complement|adverbial|attribute|other",
       "translation": "中文", "lemma": "原形", "detail": "说明", "level": "core|detail",
       "modifies": 2, "predicateOf": 2}
    ]
  }],
  "translation": "整段翻译"
}
```
- `modifies`（可选）：这个片段修饰的是同一句 `segments` 里第几个片段，从 0 开始数，空格和标点也要算。只对 attribute、adverbial、complement 有效。
- `predicateOf`（可选，PR #20）：被宾语隔开的短语动词小品词（如 `give it up` 的 up）指向前面的主谓语片段下标。规则见 [prompt-rules.md](prompt-rules.md)。

## 校验（validateAnalysis）
严格检查（不合规就拒绝整个结果，并触发一次格式修正）：
- 每句所有片段拼起来必须和原文逐字一致，所有句子要覆盖全部输入。
- 字段类型和长度正确；谓语和系动词必须有原形 lemma；非 other 的片段必须有翻译。
- 不合规时抛出 `AnalysisValidationError`，带具体字段路径和原因（例如 `sentences[0].segments[3].role ...`），这个原因会发回给模型用于修正。

宽松处理（不合规只丢掉这个字段，结果照常显示，不触发修正）：
- `tense`、`tenseReason`：不是字符串或超长就当成空。
- `modifies`：必须是整数、在范围内、不指向自己、不指向 other、而且只放在修饰类角色上；否则丢掉。
- `predicateOf`：两端都是 predicate/core、只能向前指、目标不能再带 predicateOf、两端 lemma 相同、中间有实质成分；否则丢掉。

校验**不能**保证语法判断是对的。

## 格式修正一次（PR #15）
- 只有模型返回内容的 JSON 语法错误，或核心字段没通过校验时，才自动把错误原因发回给模型，让它修正一次。
- 修正结果同样走完整校验；第二次还不行就报错。
- 网络错误、HTTP 错误、超时、用户取消、响应超长或被截断，都**不**自动重试。
- 两次请求共用同一个截止时间和取消信号；用户清空或重新输入会取消。
- 修正会多调用一次 DeepSeek，用的是用户的额度。页面事先提示可能有额外费用，修正时显示「正在修正格式，再试一次」。

## 反馈流程（PR #21、#22、#25、#28）
- 每句卡片底部有「这句分析有问题？」；请求失败时状态栏下出现「报告分析问题」。
- 弹窗「这句哪里不对？」从上到下：只读原句 → 问题类型 5 选多（成分标错了 / 中文意思不对 / 时态不对 / 显示或排版有问题 / 其他；请求失败时隐藏）→「具体说说（选填）」→「正确的应该是？（选填）」→ 折叠的「查看会发送的完整内容」（只读，实时更新）。
- 底部固定：公开提示、「我知道内容会公开」、一行操作说明、左边「取消」、右边深绿实心主按钮（至少 44px、16px 加粗）。按钮禁用时旁边写明原因（PR #28）。
- 提交按钮要同时满足：勾了公开确认，且选了至少一个类型或写了说明。改动内容后要重新勾选。
- 标题自动生成：「分析问题：<原句前 40 字>…」，失败时为「请求失败：…」。
- 正文是易读 Markdown，不再是 JSON：问题类型 / 具体说明 / 用户认为正确的 / 原句 / AI 分析结果（翻译、时态、依据、每个成分一行「原文｜角色｜原形－释义｜说明」、整句说明）/ 调用模型 / 工具版本。跳过空格和标点片段；`predicateOf` 写成「谓语组成部分（与 …）」，`modifies` 写成「（修饰 …）」。
- 不带密钥、设置、请求头、浏览器存储、服务商原始错误。草稿只在内存里，关闭、清空、新请求、看例句都会清掉。
- 短链接模式（预填链接不超过 6000 字符，内置例句约 5200）：一个主按钮「去 GitHub 提交 →」，标题和正文都预填。
- 长链接模式（超过 6000 字符，PR #28）：链接带真实标题，正文只放粘贴说明（Ctrl+V / Cmd+V、手机长按粘贴，再点 Create）；底部两步「① 复制反馈内容」「② 打开 GitHub 粘贴 →」，复制成功或失败后才能点第 2 步；复制失败时展开预览并全选正文。改任何字段会重置复制状态和公开确认。剪贴板可能保留内容，有提醒。
- 不自动提交 Issue（需要后端和 token，见 decisions.md 2026-10-27）。用户需要 GitHub 账号。
- 2026-10-27 手机实测通过（短链接）：键盘弹出时底部按钮可见，GitHub 预填页标题和正文都带过去（没点 Create）。
- 2026-10-28 电脑实测通过（长链接两步、短链接）：标题预填、粘贴完整（没点 Create）。

## 数据结构的限制
- 片段是平铺的，不能嵌套。从句不能整体框成一个状语，只能拆成从句里的主谓宾，再靠说明文字解释。任务 B（`clauses`）用来解决这个问题。
- 长从句常被整块标成一个片段（Issue #27），内部结构只能靠说明文字讲；按片段下标画括号也画不出来。见 decisions.md 2026-10-28。
- `modifies` 只能指向一个片段。「状语修饰整个从句」这类关系，目前只能指向谓语。
- 目标片段如果在当前视图里是隐藏的细节，只显示「修饰：…」文字，没有高亮。
- 分离谓语的两个红框不联动高亮，也没有连线。点击时下方说明只用主谓语框的 detail；主谓语框没有 detail 时才用小品词框的（PR #26）。

## 密钥与隐私
- 网页版的密钥默认只存在内存里，关掉页面就没了；勾选「记住」后才存进 localStorage（键名 `grammar-analysis.deepseek`），可以一键清除。
- 密钥输入框留空再保存，表示保留原密钥（PR #15 修复了以前会被清空的 bug）；只有点「清除密钥」才删除。浏览器存储写入或删除失败时会提示。
- 大字设置存在 `grammar-analysis.textSize`。
- 不要把密钥放进 Actions Secrets 再注入网页：静态网页的内容对所有人可见。
- 请求上限：输出最多 16000 tokens，响应体最多 1.5 MB。
- 正常分析不保存；用户主动提交的反馈 Issue 会公开并长期保存在 GitHub。
