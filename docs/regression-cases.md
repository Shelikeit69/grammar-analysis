# 语法回归样例

日期：2026-10-18。以下是供人工复核的参考预期，不是已通过的真实模型评测，也不是唯一允许的切分方式。2026-10-19 已用 deepseek-flash 实测 01、02、03、04、06、07、10，每句只测一到两次，结果见 verification.md；05、08、09 尚未实测；有歧义的判断先人工确认再固定成标准答案。

每次改提示词、模型或可视化，记录模型名、日期、是否发生格式修正、实际结果及偏差。检查原文是否完整、主干是否正确、原形与中文释义是否对应、标签是否指向正确位置。A/B 未实现的关系显示单独记为「待实现」，不计为模型误判。

| 编号 | 原句 | 参考检查点 |
|---|---|---|
| 01 | everyone in the stadium felt nervous; | `everyone` 是主语中心，`in the stadium` 修饰 everyone；`felt` 为系动词，框外显示 `feel－感到`；`nervous` 为表语，下方标签指向 nervous。一般过去时；保留小写与分号。 |
| 02 | She told him that she trusted him. | 重复的 she / him 必须按位置区分；主句 told 的原形 tell，从句 trusted 的原形 trust；that 引导宾语从句，him 为 told 的间接宾语（界面可归入宾语）。 |
| 03 | You should give it up. | should give … up 构成被宾语 it 隔开的谓语结构；原形 give up，释义「放弃」。不能把 it 一并标成谓语，也不能为合框而改写词序。当前分离短语动词规则待专项修正。 |
| 04 | Did you see him yesterday? | 一般过去时疑问句；Did 与 see 被主语 you 隔开，him 是宾语，yesterday 是状语；保留原顺序与问号。 |
| 05 | She has never seen it. | 现在完成时，seen 原形 see；never 表否定频率，it 是宾语。has 与 seen 之间的 never 不应被误判为主语或宾语。 |
| 06 | The book that you lent me is interesting. | 主干 The book … is interesting；is 为系动词，interesting 为表语；that you lent me 是修饰 book 的定语从句，lent 原形 lend。主句现在时、从句过去时。 |
| 07 | If it rains, we will stay at home. | 条件从句 If it rains；主句 we will stay at home；从句一般现在时、主句一般将来时；at home 修饰 stay。 |
| 08 | The book that the teacher who lives next door recommended is useful. | 主干 The book … is useful；外层定语从句修饰 book，内层 who lives next door 修饰 teacher；两个从句范围嵌套，不交叉。 |
| 09 | I know that she was working when you called. | 主句一般现在时；宾语从句中 was working 为过去进行时；when you called 为时间状语从句、一般过去时。不能只写一个时态就覆盖全句。 |
| 10 | Tom opened the door and Mary walked in. | 两个并列分句各有主语和谓语，均为一般过去时；opened 原形 open，walked 原形 walk；in 与第二个动作相关，不能附到 door 上。 |

涉及复杂或不连续结构时，优先检查原文对应和解释是否正确。不能为了让展示「好看」而强行合并不相邻的词。格式校验通过只说明数据可显示，不能充当语法正确性评分。
