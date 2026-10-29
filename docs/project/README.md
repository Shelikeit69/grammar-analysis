# 项目资料

这一组文件记录项目是什么、怎么搭的、提示词定了哪些规则、做过哪些决定、怎么协作。无论用哪个编码工具（Codex、Trae、Claude Code），动手前先读这里和根目录的 `AGENTS.md`。

| 文件 | 内容 | 什么时候读 |
|---|---|---|
| [overview.md](overview.md) | 做什么、给谁用、现在能做什么、已知问题 | 第一次接手 |
| [architecture.md](architecture.md) | 文件结构、数据格式、校验、反馈流程、密钥与隐私 | 改代码前 |
| [prompt-rules.md](prompt-rules.md) | `SYSTEM` 提示词规则的中文摘要、已知问题 | 改提示词或处理错句前 |
| [decisions.md](decisions.md) | 按时间记录的决定和原因 | 想推翻或绕开某个做法前 |
| [workflow.md](workflow.md) | 分工、PR 流程、任务单模板、反馈处理、合并前清单 | 每次开工 |

相关文件：
- [`docs/roadmap.md`](../roadmap.md)：产品待办的唯一来源，下一步做什么看这里。
- [`docs/regression-cases.md`](../regression-cases.md)：人工复核用的语法样例。
- [`docs/verification.md`](../verification.md)、[`docs/feedback-verification.md`](../feedback-verification.md)：历史验证记录。

## 同步规则
- 这里是项目资料的唯一来源。其他地方（例如 claude.ai 项目里的摘要）与这里不一致时，以这里为准。
- 代码、提示词原文和测试以代码为准；这里的摘要和代码冲突时，改这里。
- 新决定、新功能、新发现的问题，跟着对应的 PR 一起更新这里，不另开记录。
