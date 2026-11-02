# 第一版验证记录

日期：2026-10-16

- `npm test`：14 passed，0 failed。涵盖原文片段完整对应、动词原形、空翻译拒绝、输入限制、DeepSeek 输出异常、取消/超时、密钥不泄露、来源限制、资源白名单、单请求并发与取消后替代请求。
- `npm run test:browser`：13 项通过。使用本机 Edge 无界面浏览器和模拟响应，验证桌面/390px 手机布局、引线居中且批注不碰撞、原文与详细结构、空输入/未配置密钥提示、粘贴自动分析、多句翻译、清空和旧结果隔离、长短语首行对齐。
- 桌面与手机截图人工检查：felt 原文保留，系动词标签为 feel－感到；nervous 对应绿色表语框及下方引线。
- 规格复审、代码/安全复审、JavaScript 异步复审均通过。

修复的具体问题：
1. 多行短语与短词混排时，原先整个单元垂直居中导致英文首行错位；现按顶部对齐，测试对比两个英文首行的位置相同。
2. 浏览器取消请求后后端继续占用分析名额；现将客户端取消信号传给上游，并在结束时释放名额。回归测试确认替代请求成功。

限制：未配置真实 DeepSeek 密钥，未执行付费模型请求。因此本记录不声明真实模型分析质量、账户可用性或实网延迟已经验证。

## GitHub-only 测试适配

新增 Codespaces 配置及精确转发来源校验后：`npm test` 18 项通过，`npm run test:browser` 13 项通过；配置 JSON 解析与代码/安全/JavaScript 复审通过。未创建真实 Codespace、未更改仓库可见性、未配置密钥；云端与实网验证仍待用户环境就绪。

## 谓语合并与换行空白修复

- `npm test`：23 项通过（新增多词谓语 `can shop for` 的校验用例、提示词关键规则防删用例）。`npm run test:browser`：17 项通过（新增 380px/800px 换行布局断言：当前行上方与前一行下方均无标签时，两行的 top 坐标差小于 50px；标签不压住任何文字、无横向滚动）；已确认新断言在旧样式下会失败。
- 排版空白原因：`.phrase` 固定 `grid-template-rows:61px auto 61px`，对每个片段（含纯文本和空格）都预留上下各 61px。现改为标签与英文同格、高度为 0 向外溢出，只有带标签的片段才按 `--label-space` 预留空间。
- 限制：提示词只能降低 AI 把谓语拆碎的概率，不能保证每次正确；`validateAnalysis` 不校验语法正确性。真实模型效果需在 Pages 网页版用真实密钥人工验证。

## 整句时态标注

- 每句新增可选字段 `tense`（中文时态 + 语态），以淡黄色标签显示在卡片顶部；缺失时不显示，不影响其余分析。`npm test` 25 项通过，`npm run test:browser` 18 项通过（含时态标签文本断言），桌面与 360px 截图目视检查。
- 限制：时态由 AI 判断，未经真实模型验证；含多个不同时态的从句时，只标主句，其余写在 note 里。

新增可选字段 `tenseReason`（判断依据），与时态一起显示在黄框内；`npm test` 26 项、`npm run test:browser` 18 项通过。依据文字由 AI 生成，可能引用错误，未经真实模型验证。

## 可靠性修正（2026-10-18）

- 本机 `npm test`：44 项通过。新增核心格式一次修正、重试仍严格校验、非格式错误不重试、两次共用截止时间、取消、可选时态字段容错；本地接口覆盖修正进度、旧 JSON 客户端兼容、错误信息隔离和取消后释放名额。
- 本机 Edge 无界面浏览器：原有排版与交互 18 项、静态 Pages 路径 11 项，均通过。Pages 检查覆盖模型单独保存不丢密钥、刷新后设置保留、存储写入/删除失败提示、格式修正费用提示、两次不合规终止、401/402/429 不重试、修正途中清空以及会话密钥不持久化。
- 修正内置例句变化后遗留的旧测试断言，改为与当前例句数据核对。CI 和 Pages 发布前新增固定版本 Playwright 1.62.1 的 Chromium 检查。
- 所有请求均使用模拟响应和假密钥；未执行真实 DeepSeek 调用、未评估真实模型准确率、未实测云端 Codespaces。10 条语法样例是待人工核对的参考预期，不是评测通过记录。

## 修饰对象高亮（modifies）

日期：2026-10-16 首次实现；2026-10-18 在含 PR #15 的 main 上重做

- 每个片段新增可选字段 `modifies`（同句 segments 下标）。`validateAnalysis` 只对 attribute / adverbial / complement 保留它；越界、指向自己、指向 role 为 other 的片段、非整数、或出现在其他角色上时，只丢弃该字段，整体结果仍有效；其余校验未放宽。缺失时（旧格式）照常显示。
- 2026-10-18 已在最新 main（含 PR #15 可靠性修正）上重做：`modifies` 的校验写进 #15 的 `validateAnalysis`（沿用 `AnalysisValidationError` 之外的“只丢字段”思路，与 `tense` 一致），不合规不触发格式修正调用。
- `npm test`：52 项通过（main 的 44 项全部保留，新增 8 项：合法 `modifies` 保留、五类非法值只丢字段、旧格式、不放宽其他校验、提示词关键句防删、内置例句修饰关系、经 `analyzeWithDeepSeek` 时合法值保留且非法值不触发修正）。
- `npm run test:browser`：排版与交互 30 项（含 #15 之前的原有项）+ 静态 Pages 11 项，均通过。用预装 Chromium（`BROWSER_EXECUTABLE`）和模拟响应，覆盖点击定语/状语后目标高亮与「修饰：…」说明、再点一次取消、切换到别的片段、回车键操作、关闭详细结构后无残留高亮且目标仍在主干视图、1280px 与 390px 下无横向滚动且标签不重叠。已确认把 `app.js` 换回旧版时这些断言会失败。
- 顺带修复：该脚本原有三处断言仍按旧例句（felt / nervous）写，在 main 上已经失败，现按当前内置例句更新。
- 桌面与 390px 截图目视检查：目标框以加粗描边加浅色底显示，说明区出现「修饰：the beauty」。
- 限制：`modifies` 由 AI 给出，合规不等于正确，可能指错对象；提示词只能降低概率。未使用真实 DeepSeek 密钥，真实模型是否会稳定输出该字段、下标是否数对，尚未验证，需在 Pages 上用真实密钥人工试。

## 人工验收：#14、#15（2026-10-19）

在 GitHub Pages 网页版上，用真实 DeepSeek 密钥手动操作，模型 `deepseek-flash`。

- 修饰高亮（内置例句）：电脑上依次点击 Tired、who keep going every day、of English grammar、in the end，高亮分别为 learners、learners、the beauty、will see，下方显示「修饰：…」；再点一次取消，点别的框高亮跟着换。手机端点击尚未测试。
- 密钥保留：勾选「记住」后只改模型名称并保存，密钥仍在。模型名填成无效值时，DeepSeek 返回 400，页面提示检查模型名称；改回默认后恢复正常。
- 真实模型实测语法回归样例 01、02、03、04、06、07、10（05、08、09 未测）：

| 样例 | 格式 | 语法判断 | 修饰高亮 |
|---|---|---|---|
| 01 | 正常 | 正确 | in the stadium → everyone |
| 02 | 正常 | 正确（重复的 she/him 按位置区分） | 无修饰语 |
| 03 | 一次分析触发格式修正，修正后正常显示 | 错误：谓语框成 should give（释义「应该给」），up 被标为补语（已知问题） | up → should give |
| 04 | 正常 | 不理想：两次分析中，Did 一次被单独标为谓语，一次被标为 other（已知问题） | yesterday → see |
| 06 | 正常 | 正确（主语一次框 The book，一次只框 book） | that you lent me → book |
| 07 | 正常 | 正确；两次分析的时态排列顺序不同 | at home → will stay |
| 10 | 正常 | 正确（walked in 合为一个谓语） | 未点击 |

- 新发现（未修）：原形释义混入时态或情态的意思，如 stay 写成「将待」「将停留」，walk in 写成「走了进来」，give 写成「应该给」；多个时态用「；」列出时，排列顺序（主句优先还是按原文顺序）不固定。
- 限制：每句只分析了一到两次，样本很少。`modifies` 指向合理不代表模型每次都会输出、每次都对；同一句多次分析，框的划分和措辞会变。本记录不是准确率评测。

## 可分离短语动词：Issue #19（2026-10-25）

[Issue #19](https://github.com/Shelikeit69/grammar-analysis/issues/19) 的第一阶段实现可选 `predicateOf`：同句零起始片段下标，空白与标点也计数，只允许粒子 predicate/core 指向较早的主 predicate/core，两端完整 lemma 相同，目标不能再带 predicateOf，中间须有实质成分。非法可选关系单独丢弃，不触发付费修正；核心字段与原文覆盖仍严格校验。

显示保留原文顺序与独立宾语。should give 和 up 各有红框，点击任一框解释同一 give up（放弃），should 的情态意义在说明中；不联动高亮。连续的 should give up、looked after 仍为一个谓语框，felt / nervous 仍分别为系动词和表语。

### 真实模型验收工作表（2026-10-25 时未执行；2026-10-27 上线复测结果见下一节）

以下为 2026-10-25 当时的记录，保留原样。本次没有调用真实 API。下面的新版本结果全部 pending；历史基线仅引用 2026-10-19 已有记录，不补造旧版本调用。历史 felt 句采用小写开头与分号，与本表大小写和句末标点不同。

| 原句 | 历史基线 | 新版本格式 / 语法 / 显示 | 模型、日期、修正次数、实际结果 |
|---|---|---|---|
| You should give it up. | 2026-10-19：should give 释义为“应该给”，up 错标补语；一次分析触发修正 | pending / pending / pending | pending |
| You should give up smoking. | 未记录 | pending / pending / pending | pending |
| She turned the light off. | 未记录 | pending / pending / pending | pending |
| She looked after him. | 未记录 | pending / pending / pending | pending |
| Everyone in the stadium felt nervous. | 2026-10-19 同结构旧句：语法正确 | pending / pending / pending | pending |

验收时分别记录 predicateOf 是否出现且合法、语法是否正确、两个红框点击解释是否一致、宾语是否独立、should 是否只在说明中表达情态；连续短语与系表句不能回归。模拟测试不代表真实模型稳定输出正确关系，Issue 仍待真实验收。

自动检查（本机 Edge，全部模拟响应）：`npm test` 57 项通过，0 失败，退出码 0；`npm run test:browser` 排版与交互 46 项、静态 Pages 11 项通过，退出码 0。覆盖分离谓语关系校验、非法可选字段不付费修正、原文和宾语保留、红框分别点击及窄屏展示；本记录不包含真实 API、真实模型准确率或云端验证。

### 上线复测：Issue #19（2026-10-27，GitHub Pages，deepseek-flash）

上表的 pending 已在 PR #20、#23、#26 合并后用真实模型复测，结果如下。[Issue #19](https://github.com/Shelikeit69/grammar-analysis/issues/19) 已于 2026-10-27 关闭。

| 原句 | 次数 | 格式 / 语法 / 显示 | 实际结果 |
|---|---|---|---|
| You should give it up. | 2 | 通过 / 通过 / 通过 | 两次都是 should give / it / up 两个红框，「give up－放弃」，没再出现「应该给」，up 没被标成补语 |
| You should give up smoking. | 1 | 通过 / 通过 / 通过 | should give up 一个框，smoking 宾语 |
| She turned the light off. | 3 | 通过 / 通过 / 通过 | 三次都是 turned / the light / off 两个红框，「turn off－关掉」；#23 后标签为「与 turn 构成」；#26 后点击说明不再重复 |
| She looked after him. | 1 | 通过 / 通过 / 通过 | looked after 一个框，him 宾语 |
| Everyone in the stadium felt nervous. | 1 | 通过 / 通过 / 通过 | felt 系动词，nervous 表语 |

没记录：是否触发格式修正；in the stadium 的修饰高亮没截图确认。每句只测一到三次，样本少，不代表模型每次都稳定输出正确关系；本记录不是准确率评测。

## 任务 B PR 1：从句数据基础（2026-11-01，分支 `feat/clause-data`，已合并 #33）

**已实现**
- `public/analysis.js` 新增可选句级 `clauses` 的归一化与容错：只保留 `start`、`end`、`type`、合法 `subtype`；缺失或非法时输出形状与旧版一致。合法项按 `start` 升序、同起点 `end` 降序；同范围去重；部分交叉的两项先整体标记再一起删除；非法项不参与冲突判定；嵌套深度从包含关系计算，超过 3 层的内层项丢弃；候选超过 200 项（`MAX_CLAUSE_CANDIDATES`）时忽略整句 clauses。任何 clauses 错误都不抛 `AnalysisValidationError`，也不触发格式修正。核心逐字覆盖和字段校验未放宽。
- `public/deepseek.js` 的 `SYSTEM`：新增 clauses 可选格式、三种类型、状语小类、索引口径、范围边界、禁止输出 id/depth/编号/重复原文/parent、最多三层、无从句时省略等约定；时态改为「主句优先，再按从句原文顺序，相同组合只写一次」，要求判断依据区分主句与从句。**未**加入长从句强制拆分规则（PR 2）。
- `public/feedback.js`：`serializeSentence` 白名单支持 clauses；易读正文在「AI 分析结果」追加「从句：」清单，名称使用中文类型/小类，原文按 `segments` 范围拼接，不采用模型重复文本或未知字段。
- `TOOL_VERSION` 为 `2026-11-01.1`（预定合并日 + 序号，合并日变更时由负责人合并前调整）。
- 文档已同步 README、架构、提示词规则、决策记录、概况、路线图和本记录，明确 PR 1 仅是数据基础、Issue #27 尚未修复、PR 不写 `Fixes #27`。

**已自动验证（本机，全部模拟响应，未调用真实 DeepSeek）**
- `npm test`：78 项通过，0 失败，退出码 0。新增覆盖：clauses 缺失与旧数据兼容；三种类型、8 个合法状语小类、单片段、相邻范围；null/错误类型/分数/NaN/Infinity/字符串下标/越界/反向/纯空白/纯标点被丢弃且不拒绝整句；非法 subtype 只丢该字段；重复范围确定性去重；交叉两项都丢且不受数组顺序影响、非法项不连带删除合法项；无冲突时输入顺序不影响结果；同起点/同终点嵌套保留三层、第四层丢弃；200 项上限与 201 项超限忽略；`analyzeWithDeepSeek` 真实校验路径中合法 clauses 保留、非法 clauses 不触发第二次调用且原文覆盖仍严格；`SYSTEM` 含新增关键规则；反馈从句原文按范围准确拼接、未知字段不泄露、无 clauses 时旧正文一致、特殊字符按字面输出。
- `npm run test:browser`（本机 Edge，全部模拟响应）：排版与交互 62 项、静态 Pages 11 项、反馈 154 项断言通过，退出码 0。反馈检查新增从句清单渲染、原文重建、`<img onerror>` 不执行、未知字段不显示等断言。
- `git diff --check` 通过。

**状态**：PR 1 已合并（#33），合并前自动检查通过；下面的有限真实验收只覆盖了 PR 1 的输出规则，不构成准确率评测。

**待真实验收（负责人）**
- 用真实密钥在 Pages 或本地分析真实句子，确认模型是否输出合法 `clauses`、类型和小类是否合理、时态是否真的主句优先。
- 确认反馈正文的从句清单在真实长结果、6000 字符两步流程下仍完整且不泄露字段。
- Issue #27 在 PR 1 阶段未修复（长从句仍可能被整块标成一个框）；长从句拆分和范围条带在 PR 2，需真实模型与上线实测。
- 本记录不声明真实模型准确率、实网延迟或云端环境已验证。

**有限真实验收（2026-11-01，版本 2026-11-01.1，deepseek-flash，GitHub Pages）**
负责人做了少量真实调用，只记录观察，不是准确率评测：

| 原句 | 观察 | 分类 |
|---|---|---|
| If it rains, we will stay at home. | 条件状语从句范围 `If it rains` 正确；时态主句将来时在前、从句现在时在后，依据正确 | 通过 |
| The book that the teacher who lives next door recommended is useful. | 时态现在时在前、过去时在后，重复的现在时没有重复列出；但外层长定语从句仍整块一个片段，反馈只有外层范围、缺少 `who lives next door`，范围数据没有完整表达两层嵌套，时态依据未提 `lives` | 限制 / PR 2 复测重点 |
| I know that she was working. | 宾语从句范围、时态顺序和依据通过；原形释义出现「work－正在工作」，属于既有释义混入时态问题 | 通过（释义限制另记） |
| The children played outside yesterday. | 时态和依据正确，没有多余从句清单 | 通过 |
| 长正文复制到 GitHub | 标题、从句清单、模型名、版本号保留；直接粘贴时会残留占位提示尾部，先全选替换后正常 | 通过（文案优化另开小修） |

这轮观察**不**证明嵌套范围已经通过；第二句正是 PR 2 要复测的结构。

## 任务 B PR 2：长从句拆分与从句条带渲染（2026-11-01，分支 `feat/clause-brackets`）

**已实现**
- `public/deepseek.js` 的 `SYSTEM` 重写长从句规则：超过 6 个英文单词或内部含嵌套从句时拆出内部主语、谓语和其他必要成分；6 词及以下且无嵌套的短从句可整框（6 词 `who lives next door to me`、7 词 `...my parents` 作为边界示例）；仅介词短语不强制拆、不逐词拆。清理旧的「一成分一框」措辞（限定为 `Outside the long-clause rule below, one constituent is one span`），旧示例的 5 词短从句保留整框。
- `level` 规则：主句主干和并列主句 `core`；从句内部拆分成分（含内部主谓）`detail`。长从句拆开后 `clauses` 范围仍覆盖全部片段，嵌套时内外层都输出。
- 时态依据要求覆盖去重后从句的关键谓语（如 `lives`、`rains`）。
- `predicateOf` 边界保持原契约：两端 predicate/core，只服务主句分离短语动词；SYSTEM 明确从句 `detail` 不输出不适用的 predicateOf。校验未放宽，主句分离谓语行为保留。
- `public/app.js`：详细视图渲染「从句清单」和英文下方范围条带。编号按规范化 `clauses` 顺序；原文由 `segments` 重建；单片段短从句只列清单并标注不画线；范围跨多片段时按文字矩形分视觉行绘制，深度 1/2/3 不同轨道；条带层 `aria-hidden`、`pointer-events:none`、无 tabindex。
- 布局刷新与清理：ResizeObserver、窗口 resize、字体加载、大字切换后重排；重分析、换例句、清空移除旧 `.clause-layer` 和 `.clause-panel`。大字 CSS zoom 下先把测量矩形换算回本地 CSS 像素再绘制。
- `public/demo.js` 内置例句补 `clauses`（`who keep going every day`，5 词短从句，保持单片段）。
- `TOOL_VERSION` 为 `2026-11-01.2`（预定合并日 + 序号，合并日变更时由负责人合并前调整）。

**已自动验证（本机，全部模拟响应，未调用真实 DeepSeek）**
- `npm test`：85 项通过，0 失败，退出码 0。新增覆盖：SYSTEM 长/短/嵌套拆分关键句、6/7 词边界和含嵌套短从句示例、core/detail 规则、从句 detail 的 `predicateOf` 被丢弃、主句分离谓语保留、内置例句 clauses。PR 1 的 clauses 归一化、容错和反馈断言全部保留。
- `npm run test:browser`（本机 Chromium，全部模拟响应）：排版与交互 86 项、静态 Pages 11 项、反馈 154 项断言通过，退出码 0。新增断言不只检查元素存在，还检查：
  - 清单编号/类型/原文与规范化 clauses 一致；条带编号与清单对应。
  - 每条轨道属于哪一行、横向落在该从句文字范围内、纵向在该行文字下方；同一从句跨行时每行一段且编号相同。
  - 两层、三层嵌套的轨道深度不重叠；相邻、同起点、同终点范围可区分。
  - 单片段短从句有清单、无条带。
  - 默认视图只显示 `core`，详细视图显示从句内部 `detail` 和外层范围。
  - 桌面 1280、900、390、380px、大字模式、动态改宽后位置更新；无横向溢出。
  - 条带不在 Tab 顺序、不拦截成分点击；清单文本完整。
  - 重新分析、换例句、清空后无 `.clause-track`/`.clause-panel` 残留，无 pageerror。
  - 无 clauses、全非法 clauses、旧结果正常显示。
  - `modifies` 点击高亮、`predicateOf` 主句分离谓语和反馈长短流程不回归。
- `git diff --check` 通过。

**待真实验收（负责人，PR 2 上线后）**
- 用真实密钥复测 `The book that the teacher who lives next door recommended is useful.` 同类结构：外层长定语从句是否拆开、内外层 `clauses` 是否完整、详细视图是否出现两层条带、默认视图主干是否简洁、`tenseReason` 是否提及 `lives`。
- 复测简单定语、宾语、条件状语从句，确认条文位置和清单没有错位。
- 复测手机 390/380px、大字模式和长正文反馈；确认条带不遮挡成分标签，复制到 GitHub 的清单完整。
- Issue #27 只有在上述复测通过后才能视为修复；未通过就 Reopen。
- 本记录不声明真实模型拆分质量、准确率、实网延迟或云端环境已验证；上述工具夹具只证明渲染和数据路径。

## 任务 B PR 2 追加修复：单个长片段内部换行（2026-11-01，分支 `feat/clause-brackets`，未合并）

**问题**
- 独立审核在 PR #34 基线 `6b015ec` 上复现 `[P2]`：手机宽度下，同一个合法片段自身折成多行时，三层从句条带和编号压住下一行英文；390px 普通与大字体模式均可复现。
- 根因：`.clause-brackets .english` 的固定 `line-height:2` 只给行间约 20px 空间，而三层轨道需要约 45px。片段内部的换行发生在同一个 `.phrase` 行内盒里，内部行距只由行高决定；`.phrase` 的 `margin-bottom` 只移动片段之后的内容，无法解决片段内部各行之间的碰撞。

**修复**
- `public/styles.css`：固定行高改为 `line-height:var(--clause-row-height, var(--clause-base-row))`，`--clause-base-row:2` 作为未换行/短行的下限；新增 `.clause-probe`（绝对定位、隐藏、宽 1000px）精确测量 CSS zoom。
- `public/app.js`：`drawClauseLayer` 先测量整行实际文字行和每个从句在每行的范围，按最深层轨道算出该行需要的行高（文字高 + 10 + 13×(层数-1) + 6 + 3，向上取整），只在行内有两个及以上文字行时写入该行的 `--clause-row-height`；单行保持基础行高，不用固定大行距掩盖问题。值相同不重设，避免观察器循环。轨道仍从每行文字下方起算，`hasBottom` 行保留标签空间。
- `localScale` 从 `lineRect.width / line.offsetWidth` 改为探针测量：`offsetWidth` 取整使缩放系数偏高约 0.15%，长句底部累计漂移约 2.5px，大字模式下编号与文字矩形亚像素接触；探针测得精确 zoom（大字 1.25）。
- `tests/fixtures/clauses.mjs` 新增 `longAdverbialSpan()`：`nestedThree()` 的 `segments[16]` 换成 `near the very old and unusually spacious reception room on the far eastern side of the building`，仍是同一个 adverbial 片段和同一组三层 clauses，`sentence.text` 由 segments 重建。原有夹具未改动，未削弱断言。该夹具只证明布局，不代表模型一定这样切分，也不要求该短语只有一种语法切分。
- `scripts/browser-check.cjs`：`clauseGeometry` 增加目标片段内部行数、整行文字行、`--clause-row-height`、末行与清单/翻译/反馈按钮的碰撞测量；条带的绘制区域按「细线 + 4px 端点竖线 × zoom」计算，避免只检查 1.5px 边框盒。新增长片段内部换行用例。
- `TOOL_VERSION` 仍为 `2026-11-01.2`：本次追加提交仍属未合并的 PR #34，不新增发布序号；仅实际合并日期变化时按仓库规则统一调整。

**已自动验证（本机，全部模拟响应，未调用真实 DeepSeek）**
- `npm test`：85 项通过，0 失败，退出码 0。
- `npm run test:browser`：排版与交互 95 项（新增 9 项）、静态 Pages 11 项、反馈 154 项断言通过，退出码 0。
- 390px 普通模式实测：目标长片段自身 4 个文字行，整行 11 个文字行，`--clause-row-height:73px`（基础 50px）；三层共 22 段条带（9/7/6）与 22 个编号。
- 390px 大字模式实测：目标长片段 5 个文字行，整行 12 个文字行，`--clause-row-height:74px`；三层共 24 段条带（10/8/6）与 24 个编号。
- 新增断言覆盖：390 普通/大字、380、1280 桌面、桌面→手机→桌面、详细视图关闭再打开、重新分析、清空。断言目标单个 `.english` 确实产生多个文字行；三层深度都存在；条带与编号不与任何英文行文字矩形、成分标签、清单/翻译/反馈按钮相交；同一行内不同深度轨道分离、同深度只有一条；每条轨道按横向范围归属到自己的文字行，纵向在该行文字下方且不越过下一行；两次测量行高与位置一致（无观察器循环）；清空后无 `.clause-layer` / `.clause-panel` 残留；无 pageerror、无横向溢出。
- `git diff --check` 通过。

**待真实验收（负责人）**
- 用真实密钥确认移动端长片段自身换行时条带不压字；本记录不声明模型会生成同样的片段切分。
- 截图 `artifacts/wrap-390-normal.png`、`artifacts/wrap-390-normal-span.png`、`artifacts/wrap-390-large.png`、`artifacts/wrap-390-large-span.png` 为本地生成，未提交。
