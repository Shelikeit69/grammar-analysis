# 句间 · 英文语法分析器

贴一句英文进去，它会像老师在课本上批注那样，用不同底色标出主语、谓语、宾语，旁边写中文意思，再告诉你这句是什么时态，最后给出整句翻译。句子有语法错误时，还会标出来并给出改法。

**直接打开就能用：https://shelikeit69.github.io/grammar-analysis/**

不用下载安装。打开网页点「试试一个例句」，什么都不填就能先看效果。

## 怎么用

分析自己的句子需要一把 DeepSeek 密钥。工具本身免费，分析由 DeepSeek 的 AI 完成，按用量从你自己的账户扣费，价格见 [DeepSeek 官网](https://platform.deepseek.com/)。

1. **拿密钥**：在 https://platform.deepseek.com/ 注册，先充少量金额试用，到「API Keys」页面创建密钥，复制那串 `sk-` 开头的字符。它一般只显示一次，先存好。
2. **填进网页**：点「设置 DeepSeek 密钥」，粘贴后保存。自己的电脑或手机可以勾「在这台设备上记住密钥」，公用电脑不要勾。
3. **开始分析**：粘贴英文，点「分析句子」。一次最多 300 个单词。

AI 返回的格式不对时，工具会自动让它重做一次，可能多花一次调用费用。

## 怎么看结果

| 颜色 | 成分 | 例子 |
|---|---|---|
| 蓝 | 主语（谁） | Tired **learners** … |
| 橙 | 谓语 / 系动词（做什么、是什么状态） | … **will see** the beauty … |
| 绿 | 宾语 / 表语（做的对象、状态的内容） | … will see **the beauty** … |
| 紫 | 状语（什么时候、在哪里、怎么样） | … **in the end**. |
| 灰 | 定语（修饰名词的部分） | **Tired** learners **who keep going every day** … |
| 青 | 补语 | |
| 淡黄 | 时态和语态，在句子上方的黄框里 | 一般将来时 · 主动语态 |

- 刚出来时只高亮句子主干。勾选右上角的「显示详细结构」，能看到定语、状语和从句范围。
- 点任意一个有底色的成分，下方会出现详细解释。点定语或状语时，它修饰的那个词会一起高亮。
- 标签里写的是词的原形，比如原句是 felt，标签写「feel－感到」，方便查词典。
- 句子有错时，错处标红色波浪线和红圆字母，下方列出改后的整句和每处错误的原因。纠错只改错误，不润色。
- 字太小可以点右上角的「大字」。

完整说明和常见报错见 [docs/usage.md](docs/usage.md)。

## 靠不靠谱

AI 会判错。长句和多层从句更容易标错，短句相对可靠。网页会检查 AI 返回的结果能不能和原文逐字对上，但这只保证格式，不保证语法判断正确。

为什么做不到百分之百准确？简单说有三点：AI 是按概率猜出最像的答案，不是按语法规则推出来的，同一句话多跑几次，结果也可能不同；一次分析要同时做切分、标注、翻译、纠错等十几件事，句子越长，出错的机会越多；还有些语法本来就没有唯一答案，不同教材的分法也不一样。详细解释见 [docs/why-not-perfect.md](docs/why-not-perfect.md)。

纠错部分我做了重复测试（当前版本，共 120 次请求），按错误类型统计如下：

![纠错实测：当前版本按错误类型统计的改对次数](docs/images/correction-reliability.svg)

主谓一致、搭配这类错误基本能改对；时态最弱，动词时态怎么改，请结合上下文自己判断。每类只有 1 到 3 个测试，数字只表示大致趋势，逐次记录见 [docs/verification.md](docs/verification.md)。

## 密钥与隐私

这是我的个人试验项目，不收费，页面里没有广告和统计代码。

- 密钥只发给 `api.deepseek.com`。网页版没有自己的服务器，页面的内容安全策略（CSP）也只允许连接本站和 DeepSeek。
- 不勾「记住」，密钥只留在当前页面，关掉就没了；勾了才会存进你自己的浏览器，随时可以点「清除密钥」。
- 你输入的英文会发给 DeepSeek，按它的隐私政策处理。
- 提交反馈时，原句和分析结果会出现在公开的 GitHub Issue 里。原句里有个人信息就不要提交。

以上只适用于官方地址，别人复制的网页我没法担保。想自己核实，可以打开浏览器开发者工具的「网络」页，看请求是不是只发到了 `api.deepseek.com`。完整说明见 [docs/usage.md](docs/usage.md)。

## 反馈与参与

觉得哪里标错了，点这句下面的「这句分析有问题？」，勾一下问题类型，再点「去 GitHub 提交 →」。内容会自动填好，在 GitHub 点 Create 就提交了。不知道正确答案也没关系，需要 GitHub 账号。

也欢迎测试不同句型、改提示词或排版，直接提 PR。教英语或学英语的人，告诉我哪些标注有用、哪些看不懂，也很有帮助。

**English summary.** This is a free, open-source (MIT) experiment that draws colored grammar boxes, Chinese glosses and a tense note over English sentences. It runs entirely in your browser. You paste your own DeepSeek API key, and the page sends it only to `api.deepseek.com` (enforced by a Content-Security-Policy; there are no analytics, ads or third-party scripts). The key is kept in memory unless you tick "remember", and you can clear it any time. Normal analysis history is not stored by this app. The "这句分析有问题？" button opens a prefilled GitHub issue with the sentence, its analysis and your note; nothing is sent until you confirm, and issues you submit are public. Your sentences go to DeepSeek and are handled under its policy. The AI sometimes labels things wrongly, so bug reports with example sentences are the most useful contribution.

## 给开发者

本地运行、部署、代码结构、测试和校验规则见 [docs/development.md](docs/development.md)。

## 许可证

[MIT](LICENSE)
