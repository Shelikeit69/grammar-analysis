# 评测集

日期：2026-11-11。40 条虚构句，213 个检查项，放在 [`scripts/eval-cases.mjs`](../scripts/eval-cases.mjs)。用途是改提示词、换模型或换参数时，在同一批句子上前后对照，不用每次肉眼看结果。

## 先看限制

- **参考答案是草稿。** 由 AI 按 SYSTEM 现有约定起草，负责人和老师还没有逐条确认。确认前，分数只能用来比较「同一评测集上改动前后」，不能当成准确率对外说。
- 检查项只覆盖能自动判断的点（成分、原形、主干、从句范围和类型、时态组合、修饰指向等）。中文释义和说明文字写得好不好，还得人看。
- 7 条句子已出现在 SYSTEM 例句里（`inPrompt: true`），通过只说明没有倒退。
- 格式校验通过只说明数据可显示，不代表语法判断正确；本评测集检查的是后者，但受上面几条限制。

## 怎么跑

```
DEEPSEEK_API_KEY=… npm run ab:clauses -- --eval --runs 3
```

- 每句单独请求、不重做，和纠错统计（verification.md 2026-11-10）口径一致：格式校验没通过的那次，这一次的所有检查项都算未通过。
- `--runs 3` 是 120 次请求；不写 `--runs` 默认 5 次（200 次请求）。
- 加 `--ref <git ref>` 可以换成某个提交的 SYSTEM，用来做前后对照。
- 结果按检查类型和按句子各汇总一次，原始返回和 `summary.json` 存在 `ab-results/`（已 gitignore）。

## 检查类型

| 类型 | 检查什么 | 条数 |
|---|---|---:|
| role | 含这个词（组）的片段，成分标签对不对 | 65 |
| lemma | 谓语或系动词片段的原形 | 37 |
| tense | 时态 + 语态组合及顺序，逐字比较 | 35 |
| clause | 从句原文、类型，状语从句的小类 | 25 |
| clauseCount | 从句总数 | 16 |
| level | 主干（core）还是修饰（detail） | 14 |
| modifies | 修饰语指向的词 | 7 |
| split | 长从句有没有拆成多个片段 | 5 |
| separated | 分离短语动词的小品词有没有连回动词 | 4 |
| form | 定语 / 状语的结构类型 | 4 |
| gloss-excludes | 谓语释义里没有混入情态 | 1 |

词组按完整单词、连续出现来匹配，所以把一个成分切成几段会被判为未通过。

## 需要你或老师拍板的 6 处

这些地方没有唯一答案，或者现有标签体系表达不了，目前不设检查。定下来后补检查项。

| 用例 | 句子 | 待定的问题 |
|---|---|---|
| n04 | The engineer explained that the old bridge could carry heavy trucks. | could carry 的时态名称怎么写 |
| n09 | They have been waiting for the bus since seven o'clock. | wait for 算短语动词，还是 wait 加介词短语（目前两种原形都接受） |
| n11 | My father, an engineer who loves history, explained the plan. | 同位语标什么。现有 9 个成分标签里没有同位语，「被标为定语」算不算错要先定 |
| n14 | There are three apples on the table. | There 和 three apples 各标什么 |
| n19 | If you had told me earlier, I would have helped you. | 虚拟语气的时态名称怎么写 |
| n24 | He was so tired that he fell asleep on the sofa. | fell asleep 按系动词加表语，还是整体作谓语（目前两种原形都接受） |

## 维护

- 用户报来的句子改写成同结构的虚构句后再加进来，不直接复制原句。
- 改了检查项的含义或参考答案，在 PR 里写明，旧分数不再可比。
