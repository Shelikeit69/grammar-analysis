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

### 真实模型验收工作表（未执行）

本次没有调用真实 API。下面的新版本结果全部 pending；历史基线仅引用 2026-10-19 已有记录，不补造旧版本调用。历史 felt 句采用小写开头与分号，与本表大小写和句末标点不同。

| 原句 | 历史基线 | 新版本格式 / 语法 / 显示 | 模型、日期、修正次数、实际结果 |
|---|---|---|---|
| You should give it up. | 2026-10-19：should give 释义为“应该给”，up 错标补语；一次分析触发修正 | pending / pending / pending | pending |
| You should give up smoking. | 未记录 | pending / pending / pending | pending |
| She turned the light off. | 未记录 | pending / pending / pending | pending |
| She looked after him. | 未记录 | pending / pending / pending | pending |
| Everyone in the stadium felt nervous. | 2026-10-19 同结构旧句：语法正确 | pending / pending / pending | pending |

验收时分别记录 predicateOf 是否出现且合法、语法是否正确、两个红框点击解释是否一致、宾语是否独立、should 是否只在说明中表达情态；连续短语与系表句不能回归。模拟测试不代表真实模型稳定输出正确关系，Issue 仍待真实验收。

自动检查（本机 Edge，全部模拟响应）：`npm test` 57 项通过，0 失败，退出码 0；`npm run test:browser` 排版与交互 46 项、静态 Pages 11 项通过，退出码 0。覆盖分离谓语关系校验、非法可选字段不付费修正、原文和宾语保留、红框分别点击及窄屏展示；本记录不包含真实 API、真实模型准确率或云端验证。
