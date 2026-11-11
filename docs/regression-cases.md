# 语法回归样例

日期：2026-10-18；2026-11-01 补充任务 B PR 2 的从句条带检查点。以下是供人工复核的参考预期，不是已通过的真实模型评测，也不是唯一允许的切分方式。2026-10-19 已用 deepseek-flash 实测 01、02、03、04、06、07、10，每句只测一到两次，结果见 verification.md；05 尚未实测；08、09 已于 2026-11-02 各实测 2 次（PR #35 合并后），结果见 verification.md；有歧义的判断先人工确认再固定成标准答案。2026-11-01 的有限真实验收补测了 07、08 的结构，记录见 verification.md「任务 B PR 1」。

每次改提示词、模型或可视化，记录模型名、日期、是否发生格式修正、实际结果及偏差。检查原文是否完整、主干是否正确、原形与中文释义是否对应、标签是否指向正确位置。A/B 未实现的关系显示单独记为「待实现」，不计为模型误判。

| 编号 | 原句 | 参考检查点 |
|---|---|---|
| 01 | everyone in the stadium felt nervous; | `everyone` 是主语中心，`in the stadium` 修饰 everyone；`felt` 为系动词，框外显示 `feel－感到`；`nervous` 为表语，下方标签指向 nervous。一般过去时；保留小写与分号。 |
| 02 | She told him that she trusted him. | 重复的 she / him 必须按位置区分；主句 told 的原形 tell，从句 trusted 的原形 trust；that 引导宾语从句，him 为 told 的间接宾语（界面可归入宾语）。 |
| 03 | You should give it up. | should give … up 构成被宾语 it 隔开的谓语结构；原形 give up，释义「放弃」。不能把 it 一并标成谓语，也不能为合框而改写词序。粒子可用 predicateOf 关联主谓语；两个橙框点击解释同一 give up，不联动高亮。2026-10-27 上线复测两次均通过（Issue #19 已关闭）。 |
| 04 | Did you see him yesterday? | 一般过去时疑问句；Did 与 see 被主语 you 隔开，him 是宾语，yesterday 是状语；保留原顺序与问号。 |
| 05 | She has never seen it. | 现在完成时，seen 原形 see；never 表否定频率，it 是宾语。has 与 seen 之间的 never 不应被误判为主语或宾语。 |
| 06 | The book that you lent me is interesting. | 主干 The book … is interesting；is 为系动词，interesting 为表语；that you lent me 是修饰 book 的定语从句，lent 原形 lend。主句现在时、从句过去时。 |
| 07 | If it rains, we will stay at home. | 条件从句 If it rains；主句 we will stay at home；从句一般现在时、主句一般将来时；at home 修饰 stay。 |
| 08 | The book that the teacher who lives next door recommended is useful. | 主干 The book … is useful；外层定语从句修饰 book，内层 who lives next door 修饰 teacher；两个从句范围嵌套，不交叉。 |
| 09 | I know that she was working when you called. | 主句一般现在时；宾语从句中 was working 为过去进行时；when you called 为时间状语从句、一般过去时。不能只写一个时态就覆盖全句。默认视图应显示 I know … she was working，不能只剩 I know。 |
| 10 | Tom opened the door and Mary walked in. | 两个并列分句各有主语和谓语，均为一般过去时；opened 原形 open，walked 原形 walk；in 与第二个动作相关，不能附到 door 上。 |

涉及复杂或不连续结构时，优先检查原文对应和解释是否正确。不能为了让展示「好看」而强行合并不相邻的词。格式校验通过只说明数据可显示，不能充当语法正确性评分。

## 从句显示检查点（2026-11-08 更新 C4 框模式）

下面这些检查用于人工复核详细视图的从句清单、短从句嵌套框和长从句范围条带；句子是改写过的虚构句，来自 Issue #27 同类结构，不直接复制用户原句。浏览器自动检查使用同样结构，但模拟响应不等于真实模型。

| 结构 | 虚构句 | 参考检查点 |
|---|---|---|
| 两层嵌套定语从句 | The guide that the caretaker who works upstairs recommended is helpful. | 外层 `that the caretaker who works upstairs recommended` 和内层 `who works upstairs` 都在清单里；两层范围不交叉；详细视图两个嵌套框；默认视图只留主句主干；时态依据要提到 `works`（若依据了这层时态）。 |
| 三层嵌套 | The guide that the caretaker who works in the office that stands upstairs recommended is helpful. | 三层范围按包含关系排列，嵌套框按三层包含、互不交叉；不超过三层。 |
| 简单定语从句 | The book that you lent me is interesting. | 拆成多个片段时画从句外框、编号与清单一致；`lent` 和 `me` 在详细视图里可见。 |
| 简单宾语从句 | I know that she was working. | 宾语从句范围正确；6 词以内、无嵌套且保持整框时仍是 object/core，行为不变。 |
| 条件状语从句 | If it rains, we will stay at home. | 从句范围覆盖 `If it rains`；类型为条件状语从句；主句将来时在前、从句现在时在后。 |
| 单片段短从句 | 内置例句中的 `who keep going every day`（5 词） | 清单显示编号、定语从句、原文；不画框或条带，并标明「单片段短从句，不画范围线」；不要为展示条带改写原句。 |
| 同终点/相邻范围 | `I know that she left because he called.`；`I know that she was working and that he was resting.` | 两个范围可区分，编号不同，框按范围包含或相邻排列；相邻范围不合并成一个。 |
| 单片段内部换行 | 上表三层句中的 `upstairs` 换成 `near the very old and unusually spacious reception room on the far eastern side of the building`（仍是一个 adverbial 片段、同一组三层范围） | 手机宽度下这个片段自身折成多行；每一行英文下方各有该行需要的三层条带和编号，不压下一行文字、成分标签或清单；末行条带不碰撞后续内容；普通、大字、380/390px 都成立。这是渲染夹具，不代表模型必须这样切分。 |

人工检查顺序：先确认原文完整和主干正确，再确认清单编号/类型/原文，最后确认短从句框包含正确片段、长从句条带属于哪一行并落在对应文字下方。手机 390px 和 380px、大字模式各看一次；切换详细视图、重新分析、换例句、清空后不应有旧框或旧线残留。

## Issue #19 专项验收

五句真实调用工作表见 [verification.md](verification.md)。除上表 03 外，补查 `You should give up smoking.`（连续谓语）、`She turned the light off.`（分离谓语）、`She looked after him.`（连续介词动词）和 `Everyone in the stadium felt nervous.`（系表结构）。保留原文、宾语独立、两个橙框可分别点击且不联动高亮；模型是否输出合法字段与语法是否正确分别记录。
