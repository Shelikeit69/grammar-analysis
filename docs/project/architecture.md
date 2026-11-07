# 技术架构

最后更新：2026-11-05（PR-B2：clauses 写进 JSON 骨架，校验和渲染不变）

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
- `public/app.js`：界面逻辑（渲染批注、修饰高亮、分离谓语标签和说明、详细视图的从句清单与跨行范围条带、模式判断、密钥面板、三步引导、大字开关、错误提示、格式修正提示、反馈表单）。
- `public/styles.css`：样式。标签和英文放在同一格，高度为 0 向外溢出；只有带标签的片段才通过 `--label-space` 留出空间。详细视图的从句条带在英文下方按行绘制，深度 1/2/3 各占一条轨道，行内有底标签时额外留出 58px。大字模式用 `html.large-text` 加 CSS zoom 1.25（只放大 masthead、main、footer，不影响反馈弹窗），条带坐标按 zoom 换算回本地 CSS 像素。反馈按钮用 `.report-button`；反馈弹窗底部操作区固定（`.feedback-footer`），主按钮在 `.feedback-steps` 里（PR #28）。
- `public/deepseek.js`：Node 和浏览器共用的 DeepSeek 客户端，系统提示词常量 `SYSTEM` 和「格式或长从句重做一次」的逻辑都在这里。
- `public/analysis.js`：`validateInput`、`validateAnalysis`、`AnalysisValidationError`，Node 和浏览器共用。
- `public/feedback.js`：`FEEDBACK_TYPES`（5 个问题类型）、反馈标题和易读正文生成（只放白名单字段）、GitHub Issue 预填链接（上限 6000 字符；超过时只带真实标题和粘贴说明，正文由用户粘贴）（PR #21、#25、#28）。
- `public/version.js`：`TOOL_VERSION`，写进反馈正文。当前值为 `2026-11-07.2`。发布影响分析或反馈的改动时要更新，用实际合并日期加序号。
- `public/server-client.js`：本地和 Codespaces 模式下读取服务器返回结果（支持 NDJSON 进度消息，旧的纯 JSON 也兼容）。
- `public/demo.js`：内置例句和它的分析结果（含 `modifies` 和 `clauses`）。例句的 `who keep going every day` 是 5 词短从句，保持单片段，只显示清单不画条带。
- `lib/analysis.mjs`、`lib/deepseek.mjs`：只是转发 `public/` 里的共用模块。
- `lib/access.mjs`：本地和 Codespaces 的访问来源校验（只允许 127.0.0.1 和本 Codespace 的域名）。
- `server.mjs`：本地和 Codespaces 用的 HTTP 服务，只监听 127.0.0.1。新增的 `public/` 文件要加进它的资源白名单，也要加进 `scripts/browser-pages-check.cjs` 的白名单。
- `tests/`：node --test 单元测试，本次验证共 145 项（任务 B PR 1 新增 14 项：clauses 归一化/容错、提示词关键句、反馈从句清单与 HTML 安全；PR 2 新增 7 项：长从句拆分与 core/detail 提示词关键句、从句 `predicateOf` 边界、内置例句 clauses；PR-B2 新增 3 项：clauses 在 JSON 模板中位于 segments 之后、空数组规则、缺字段和空数组均不触发付费修正）。
- `tests/fixtures/clauses.mjs`：从句渲染夹具（条件、宾语、两层/三层嵌套、同终点、相邻范围，以及只用于验证同一片段内部换行的长状语），句子为虚构改写，供浏览器检查模拟响应使用。
- `scripts/browser-check.cjs`：Playwright 排版与交互检查（99 项，含 PR 2 的从句清单、跨行条带位置、嵌套轨道、单片段短从句、单片段内部换行、清理、窄屏和大字检查）；`scripts/browser-pages-check.cjs`：模拟 Pages 静态网页的检查（11 项）；`scripts/browser-feedback-check.cjs`：反馈流程检查（154 项断言，PR #28 起包含长链接两步流程和 380/390px 排版检查，任务 B PR 1 新增从句清单的 XSS/字段白名单断言，会生成截图到 `artifacts/feedback/`）。都用模拟响应，不调用真实 DeepSeek，也不提交真实 Issue。
- `.gitignore`：`artifacts/` 已加入（PR #28），测试生成的截图不提交。
- `.github/ISSUE_TEMPLATE/analysis-error.md`：「分析问题反馈」Issue 模板，标题和网页生成的正文一致：问题类型 / 具体说明 / 用户认为正确的 / 原句 / AI 分析结果 / 调用模型 / 工具版本。
- `.github/workflows/ci.yml`：每次 push 和 PR 都跑 `npm test`，再装 Playwright 跑 `npm run test:browser`。任务名叫 `test`（分支保护依赖这个名字，别改）。
- `.github/workflows/pages.yml`：推送到 main 时先跑单元测试和浏览器测试，再只发布 `public/`，不用任何 Secrets。
- `CLAUDE.md`：给 Claude Code 的编码准则。
- `AGENTS.md`：所有编码工具共用的规则（Codex、Trae、Claude Code、Qoder）：单会话、不用子代理、不提交计划文件和生成文件、走分支和 PR、修复 PR 用 `Fixes #N`、不放宽校验、版本号和旧说法检查（PR #23、#24，2026-10-29 扩充）。
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
       "modifies": 2, "predicateOf": 2, "form": "prep|to-inf|ing|ed|clause"}
    ],
    "clauses": [
      {"type": "relative|object|adverbial", "subtype": "可选，仅 adverbial", "text": "从句原文"}
    ]
  }],
  "translation": "整段翻译"
}
```
- `modifies`（可选）：这个片段修饰的是同一句 `segments` 里第几个片段，从 0 开始数，空格和标点也要算。只对 attribute、adverbial、complement 有效。
- `predicateOf`（可选，PR #20）：被宾语隔开的短语动词小品词（如 `give it up` 的 up）指向前面的主谓语片段下标。规则见 [prompt-rules.md](prompt-rules.md)。
- `form`（可选，#31）：结构类型标签，只给 attribute 和 adverbial 填。取值 `"prep"`（介词短语）、`"to-inf"`（不定式）、`"ing"`（现在分词）、`"ed"`（过去分词）、`"clause"`（作为一个整框的短从句）。单个形容词、副词、名词修饰语不填；拿不准就不填。界面显示为「定语 · 介词短语」格式；仅 attribute 且 modifies 合法且 modifies < 当前片段下标时追加「（后置）」，状语不加。
- `clauses`：上面的 JSON 是模型输入格式，模型每句必填，用 `{type,subtype?,text}` 照抄从句原文，不再数下标。没有定语从句、宾语从句或状语从句时输出空数组 []。normalizeClauses 在片段边界上唯一精确匹配后生成内部 `{start,end,type,subtype?}`；app.js、反馈、demo 和归一化夹具仍用内部范围。type 支持 relative、object、adverbial；subtype 仅给 adverbial，不确定就省略。范围从引导词到最后一词，不记录主句范围。
- 只有直接充当主句谓语宾语的宾语从句才保留自身 core 主干；被定语从句、状语从句或另一个从句包住的宾语从句不适用。反例 `She thanked the nurse who said that the results were good.` 中 the results、were、good 全部 detail，默认只显示 She thanked the nurse。
- `level`：主句主干和并列主句用 `core`；为解释长从句内部结构而拆出的主语、谓语等通常用 `detail`。仅主句的长宾语从句拆开时，其自身主语中心词、谓语或系动词、宾语或表语保留 core；引导词、修饰语及嵌套从句均为 detail。定语从句、状语从句拆开后仍全部 detail，宾语从句内嵌的定语或状语从句也不例外。6 词以内、无嵌套且保持整框的宾语从句仍是 object/core。拆开的从句内部不输出 predicateOf，即使宾语从句谓语为 core；主句分离谓语和 predicateOf 校验不变。默认视图只显示 `core`，详细视图显示全部。长从句（超过 6 个英文单词或内部含嵌套从句）按 SYSTEM 要求拆开，短从句可保留整框；客户端不猜测语法、不强行切分 segments。

## 校验（validateAnalysis）
严格检查（不合规就拒绝整个结果，并触发一次格式修正）：
- 每句所有片段拼起来必须和原文逐字一致，所有句子要覆盖全部输入。
- 字段类型和长度正确；谓语和系动词必须有原形 lemma；非 other 的片段必须有翻译。
- 不合规时抛出 `AnalysisValidationError`，带具体字段路径和原因（例如 `sentences[0].segments[3].role ...`），这个原因会发回给模型用于修正。

宽松处理（不合规只丢掉这个字段，结果照常显示，不触发修正）：
- `tense`、`tenseReason`：不是字符串或超长就当成空。
- `modifies`：必须是整数、在范围内、不指向自己、不指向 other、而且只放在修饰类角色上；否则丢掉。
- `predicateOf`：两端都是 predicate/core、只能向前指、目标不能再带 predicateOf、两端 lemma 相同、中间有实质成分；否则丢掉。
- `form`：必须是字符串且在 `prep`/`to-inf`/`ing`/`ed`/`clause` 枚举内，而且片段角色必须是 attribute 或 adverbial；否则丢掉。不抛 AnalysisValidationError，不触发付费修正。
- `clauses`：不是数组或候选超过 200 项时整句忽略；非对象项、非法 type、非字符串/空白/纯标点 text、text 长于句子、无精确匹配、多处片段边界匹配或仅有 start/end 时丢弃该项。text 首尾空白先去掉，再匹配；匹配后收掉首尾不含字母数字的片段。只拷贝内部 start/end/type 与有效 adverbial subtype。合法项仍按 start 升序、同起点 end 降序排序，同范围去重；部分交叉两项都丢、最多三层、非法项不影响独立合法项。任何错误都不抛 AnalysisValidationError、不触发付费修正。

校验**不能**保证语法判断是对的。

## 自动重做（最多一次）
- 首次结果通过校验后，检查超过 6 个英文词的单片段从句（归一化锚点，或定语、状语的 clause 形式）。重做通过完整校验就采用，即使仍未拆开。重做失败退回首次结果，主动取消仍抛出。
- 格式修正仅在模型返回内容的 JSON 语法错误，或核心字段没通过校验时自动把错误原因发回给模型，让它修正一次。
- 拼接与原文校验的报错附带第一处不一致位置，供修正请求使用；短上下文用 JSON 引号显示空格和标点，拼接报错还给相邻片段下标。上下文按转义后的长度缩短，完整 reason 不超过 280 字符，不在界面或反馈正文中展示。
- 格式修正结果同样走完整校验；第二次还不行就报错。
- 网络错误、HTTP 错误、超时、用户取消、响应超长或被截断，都**不**自动重试。
- 两次请求共用同一个截止时间和取消信号；用户清空或重新输入会取消。
- 修正会多调用一次 DeepSeek，用的是用户的额度。页面事先提示可能有额外费用，修正时显示「正在修正格式，再试一次」。

## 反馈流程（PR #21、#22、#25、#28）
- 每句卡片底部有「这句分析有问题？」；请求失败时状态栏下出现「报告分析问题」。
- 弹窗「这句哪里不对？」从上到下：只读原句 → 问题类型 5 选多（成分标错了 / 中文意思不对 / 时态不对 / 显示或排版有问题 / 其他；请求失败时隐藏）→「具体说说（选填）」→「正确的应该是？（选填）」→ 折叠的「查看会发送的完整内容」（只读，实时更新）。
- 底部固定：公开提示、「我知道内容会公开」、一行操作说明、左边「取消」、右边深绿实心主按钮（至少 44px、16px 加粗）。按钮禁用时旁边写明原因（PR #28）。
- 提交按钮要同时满足：勾了公开确认，且选了至少一个类型或写了说明。改动内容后要重新勾选。
- 标题自动生成：「分析问题：<原句前 40 字>…」，失败时为「请求失败：…」。
- 正文是易读 Markdown，不再是 JSON：问题类型 / 具体说明 / 用户认为正确的 / 原句 / AI 分析结果（翻译、时态、依据、每个成分一行「原文｜角色｜原形－释义｜说明」、整句说明、有合法 `clauses` 时追加「从句：」清单）/ 调用模型 / 工具版本。跳过空格和标点片段；`predicateOf` 写成「谓语组成部分（与 …）」，`modifies` 写成「（修饰 …）」。从句清单只写类型（定语/宾语/状语从句，状语可带时间、条件等小类）和按 `segments` 范围拼出的原文，不写模型可能重复生成的从句文本、id、depth 等未知字段；没有合法 clauses 时正文与旧版一致。
- 不带密钥、设置、请求头、浏览器存储、服务商原始错误。草稿只在内存里，关闭、清空、新请求、看例句都会清掉。
- 短链接模式（预填链接不超过 6000 字符，内置例句约 5200）：一个主按钮「去 GitHub 提交 →」，标题和正文都预填。
- 长链接模式（超过 6000 字符，PR #28）：链接带真实标题，正文只放粘贴说明（Ctrl+V / Cmd+V、手机长按粘贴，再点 Create）；底部两步「① 复制反馈内容」「② 打开 GitHub 粘贴 →」，复制成功或失败后才能点第 2 步；复制失败时展开预览并全选正文。改任何字段会重置复制状态和公开确认。剪贴板可能保留内容，有提醒。
- 不自动提交 Issue（需要后端和 token，见 decisions.md 2026-10-27）。用户需要 GitHub 账号。
- 2026-10-27 手机实测通过（短链接）：键盘弹出时底部按钮可见，GitHub 预填页标题和正文都带过去（没点 Create）。
- 2026-10-28 电脑实测通过（长链接两步、短链接）：标题预填、粘贴完整（没点 Create）。

## 从句条带渲染（任务 B PR 2）
- 只在详细视图渲染；默认视图不显示清单和条带，但显示一行从句数量提示（`<p class="clause-hint">`），写法为「这句有 N 个从句，勾选右上角「显示详细结构」查看从句范围和清单。」N = sentenceClauses(sentence).length，含单片段短从句。无从句或从句全部非法时不显示。
- 句子下方追加「从句清单」：按规范化后的 `clauses` 顺序编号，每项写编号、中文类型（状语可带小类）和按 `segments` 范围重建的原文。模型提供 text 锚点用于匹配，清单仍按内部范围重建文本。
- 范围跨两个及以上含字母或数字的片段时，在英文下方画细线，编号与清单一致；只有一个这样的片段时只列清单，写明「单片段短从句，不画范围线」。
- 跨行范围按实际文字矩形分行绘制，每行一条线；同一从句每行的编号相同，不在每行重复清单。深度 1/2/3 分别使用不同轨道（间隔 13px），行内有底标签时先留出 58px，避免与成分标签重叠。
- 条带层 `aria-hidden`、`pointer-events: none`、无 tabindex，不进入 Tab 顺序，也不拦截成分框点击；完整信息由清单的可访问文本提供。
- 布局刷新：`ResizeObserver` 观察句子列表，监听窗口 resize、字体加载完成、大字切换；先取消上一帧和定时器再重排。重新分析、换例句或清空时移除旧 `.clause-layer` 和 `.clause-panel`，避免残留。
- 大字模式的 CSS zoom 会放大测量结果，绘制前按 `实际宽度 / 本地宽度` 换算回本地 CSS 像素。
- 已知边界：SYSTEM 要求拆开的从句内部不输出 `predicateOf`，包括保留为 core 的宾语从句谓语；`predicateOf` 校验仍要求两端 predicate/core，只服务主句里被宾语隔开的短语动词。这条边界由 `tests/predicate.test.mjs` 覆盖。

## 数据结构的限制
- 片段仍是平铺的，不能嵌套。从句关系由句级 `clauses` 范围加上详细视图的条带和清单表达；默认视图只保留主句主干（`core`）。
- 长从句拆分依赖模型按 SYSTEM 规则输出，客户端不做语法猜测；2026-11-02 负责人真实复测 #27 长句 4 次均拆开，但从句范围 4 次均不对，#27 已重新打开。现已改为原文锚点唯一匹配得到 start/end，不能唯一匹配就丢弃该项，不抛错、不触发付费修正；内部结构和渲染不变，真实长句效果待上线实测。
- `clauses` 不记录主句范围；第一版只有定、宾、状三种从句，最多三层。中文小类只用于状语从句。
- `modifies` 只能指向一个片段。「状语修饰整个从句」这类关系，目前只能指向谓语。
- 目标片段如果在当前视图里是隐藏的细节，只显示「修饰：…」文字，没有高亮。
- 分离谓语的两个红框不联动高亮，也没有连线。点击时下方说明只用主谓语框的 detail；主谓语框没有 detail 时才用小品词框的（PR #26）。

## 密钥与隐私
- 网页版的密钥默认只存在内存里，关掉页面就没了；勾选「记住」后才存进 localStorage（键名 `grammar-analysis.deepseek`），可以一键清除。
- 密钥输入框留空再保存，表示保留原密钥（PR #15 修复了以前会被清空的 bug）；只有点「清除密钥」才删除。浏览器存储写入或删除失败时会提示。
- 大字设置存在 `grammar-analysis.textSize`。
- 不要把密钥放进 Actions Secrets 再注入网页：静态网页的内容对所有人可见。
- 请求上限：输出最多 16000 tokens，响应体最多 1.5 MB。
- 请求参数：`thinking` 关闭，`temperature` 为 0（2026-11-03 起，实验值，见 decisions.md）。
- 正常分析不保存；用户主动提交的反馈 Issue 会公开并长期保存在 GitHub。

## 内联纠错重新上线（2026-11-07）

corrections 为可选元数据，非法项单独丢弃，不拒绝整句或触发付费修正。唯一匹配原始锚点后，去掉 text/fix 两端相同整词并同步更新位置，两边至少留一词。纠错行用普通文本空格分隔删除和替换文字；波浪线仅覆盖非空白文本。长从句重做后的结果同样归一化 corrections，每次分析最多两次调用。
