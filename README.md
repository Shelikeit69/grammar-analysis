# 句间 · 英文语法分析器

贴一句英文进去，它会像老师在课本上批注那样，用不同颜色框出主语、谓语、宾语，旁边写中文意思，再告诉你这句是什么时态，最后给出整句翻译。

**直接打开就能用：https://shelikeit69.github.io/grammar-analysis/**

不用下载，不用安装，电脑和手机都能打开。

## 第一次使用

什么都不填也能先看效果：打开网页，点「试试一个例句」。

要分析自己的句子，得有一把 DeepSeek 的「密钥」。工具本身免费，但分析是 DeepSeek 的 AI 做的，它按用量收费，所以每人用自己的账户，价格看 [DeepSeek 官网](https://platform.deepseek.com/)。输入框上方有三步提示，做完一步打一个勾。

### 1. 拿到 DeepSeek 密钥

1. 打开 https://platform.deepseek.com/ ，注册并登录。
2. 先给账户充一点钱。余额为零时无法分析。
3. 找到「API Keys」页面，点创建，给它起个名字，比如「句间」。
4. 复制生成的那串字符，它以 `sk-` 开头。这串字符一般只显示一次，建议先存到备忘录里。

### 2. 填进网页

1. 回到 [句间网页](https://shelikeit69.github.io/grammar-analysis/)，点开「设置 DeepSeek 密钥」。
2. 把 `sk-` 开头的密钥粘贴进「API 密钥」一栏。「模型名称」可以先空着。
3. 如果是你自己的电脑或手机，可以勾上「在这台设备上记住密钥」，下次就不用再填。在网吧、学校机房这类公用电脑上不要勾。
4. 点「保存」。

以后只改模型名称时，密钥一栏留空即可保留已有密钥；删除请点「清除密钥」。如果浏览器不允许保存或删除记录，页面会明确提示，当前页面中的设置仍可使用。

### 3. 开始分析

把英文粘贴进上方的输入框。粘贴后会自动开始分析，也可以手动点「分析句子」。一次最多 300 个单词，适合一句话或一小段。

如果 AI 返回的格式不合规，工具会自动要求它修正一次，并显示「正在修正格式，再试一次」。这可能额外产生一次 DeepSeek 调用费用；仍不合规就报错。清空或修改原文会取消正在进行的分析，但已经发送的请求可能已计费。

## 怎么看结果

颜色对应的成分：

| 颜色 | 成分 | 例子 |
|---|---|---|
| 蓝 | 主语（谁） | Tired **learners** … |
| 红 | 谓语 / 系动词（做什么、是什么状态） | … **will see** the beauty … |
| 绿 | 宾语 / 表语（做的对象、状态的内容） | … will see **the beauty** … |
| 紫 | 状语（什么时候、在哪里、怎么样） | … **in the end**. |
| 灰 | 定语（修饰名词的部分） | **Tired** learners **who keep going every day** … |
| 橙 | 补语 | |
| 淡黄 | 时态和语态，在句子上方的黄框里 | 一般将来时 · 主动语态 |

几个小提示：

- 刚出来的结果只框出句子的主干。想看定语、状语这些修饰部分，勾选右上角的「显示详细结构」。
- 点任意一个彩色框，下方会出现更详细的解释。点定语、状语这类修饰成分时，它修饰的那个词会同时加粗高亮，说明里多一句「修饰：……」；再点一次或点别的框就取消。AI 拿不准修饰对象时会不标，这时只显示说明、没有高亮。
- 框旁边写的是这个词的原形。比如原句是 `felt`，框外会写「系动词：feel－感到」，方便你查词典。`can shop for` 这样的多个词会合成一个谓语框，不会拆开。
- 黄框里的「判断依据」会写明是看哪个动词形式、哪个时间词判断出的时态。一句话里有并列分句或时态不同的从句时，黄框用「；」按顺序分开写，相同的时态只写一次。
- 一段话里有好几句时，最下面可以展开「查看整段翻译」。
- 字太小就点右上角的「大字」，整页放大，再点一次恢复。这台设备会记住你的选择。

## 常见问题

**密钥安全吗？**
密钥只从你的浏览器发给 DeepSeek，不经过别的地方。不勾「记住」，关掉网页就没了。详细说明和自己核实的方法见下面的「密钥与隐私」。

**AI 会分析错吗？**
会，尤其是很长、很绕的句子，成分和时态都可能标错。把它当成帮你理解的工具，拿不准的地方对照课本或问老师。

**提示「DeepSeek 拒绝了这个密钥」**
密钥可能没复制完整，或者前后多了空格。重新复制一遍再保存。

**提示「账户余额不足」**
去 DeepSeek 官网充值。

**提示「请检查模型名称」**
在「模型名称」一栏填 DeepSeek 官网上写的、你账户能用的模型名，然后保存。

**提示「浏览器无法直接连接 DeepSeek」**
先检查网络。如果网络正常仍然出现，可以在 GitHub 上提一个 Issue 告诉我。

**这个工具会保存我输入的句子吗？**
平常分析时，应用不保存输入或分析历史，英文会发给 DeepSeek。主动反馈是例外：请先在本页检查、编辑并确认，打开预填链接就会把确认的内容带到 GitHub；由你最终提交的公开 Issue 会持久保存。

## 密钥与隐私：这个网页会拿你的密钥做什么

这是我的个人试验项目，不收费，页面里没有广告和统计代码。你填的 DeepSeek 密钥会经历这些：

- 密钥只会作为请求头发给 `api.deepseek.com`，用来替你调用 DeepSeek。网页版没有自己的服务器，没有别的地方会收到它。
- 页面带有内容安全策略（CSP），浏览器只允许它连接本站和 `api.deepseek.com`，不能把数据发到其他域名。可以在 `public/index.html` 里看到这一行。
- 页面只加载自己的 `app.js` 和 `styles.css`，没有第三方脚本、字体或图片。
- 默认只在当前页面里保存密钥，关掉网页就没了。勾选「在这台设备上记住密钥」后才会存进你自己浏览器的 localStorage。点「清除密钥」会尝试删除；如果浏览器阻止删除，页面会提示你手动清除本站数据。
- 你输入的英文会发给 DeepSeek，按它的规则处理。这部分我管不了，介意的话先看看它的隐私政策。
- 费用从你的 DeepSeek 账户扣。每次分析输入不超过 300 词，每次模型调用输出最多 16000 个 token；格式修正最多额外调用一次，并会附上第一次的错误输出供模型纠正。

以上只适用于官方地址 https://shelikeit69.github.io/grammar-analysis/ 。别人 fork 或搬走的副本我没法担保，请不要往来路不明的网页里填密钥。

不想光听我说，可以自己查：

1. 打开浏览器开发者工具的「网络」页，点一次分析，看请求是不是只发到了 `api.deepseek.com`。
2. 代码全部公开，搜 `apiKey` 就能看到它被用在哪里。
3. 在 DeepSeek 开放平台单独建一个密钥，账户里只留少量余额，试完就删。用任何网页工具都可以这么做。

## 试验与合作

项目刚起步，AI 时不时会判错，我也还在摸索怎么让它稳一点。想帮忙的话，下面这些最有用：

- 提交判错的句子：在 GitHub 开一个 Issue，贴上原句、你看到的结果和哪里不对；正确答案选填，不确定可留空。
- 测试不同的句型、时态和模型，告诉我哪里不稳定。
- 改提示词、改排版、补测试，直接提 PR。
- 教英语或学英语的人提意见：哪些标注对初学者有用，哪些看不懂。

代码用 MIT 许可证开源，可以随便用、随便改。

**English summary.** This is a free, open-source (MIT) experiment that draws colored grammar boxes, Chinese glosses and a tense note over English sentences. It runs entirely in your browser. You paste your own DeepSeek API key, and the page sends it only to `api.deepseek.com` (enforced by a Content-Security-Policy; there are no analytics, ads or third-party scripts). The key is kept in memory unless you tick "remember", and you can clear it any time. Normal analysis history is not stored by this app. Opening a confirmed feedback link sends the edited content to GitHub; Issues you choose to submit are public and persist. Your sentences go to DeepSeek and are handled under its policy. The AI sometimes labels things wrongly, so bug reports with example sentences are the most useful contribution.

---

## 给开发者

下面的内容是给想自己运行、修改代码的人看的。只是使用网页版的话不需要读。

### 三种运行方式

| 方式 | 密钥放在哪里 | 适合 |
|---|---|---|
| 网页版（GitHub Pages） | 访问者自己的浏览器 | 普通使用，每人用自己的密钥 |
| Codespaces | Codespaces Secrets | 不装软件，在 GitHub 云端私有测试 |
| 本地运行 | 本机 `.env` | 开发、修改代码 |

三种方式共用 `public/` 里的同一套页面。页面会先请求 `./api/status`：有后端回应就用后端保管的密钥（本地和 Codespaces），没有回应就显示密钥面板，由浏览器直连 DeepSeek（Pages）。

### 网页版的部署

`.github/workflows/pages.yml` 会在每次推送到 `main` 时先跑测试，再只发布 `public/` 目录，不使用任何 Secrets。

第一次开启需要两步：仓库 Settings → General 改为 Public（免费账户的 Pages 要求公开仓库，仓库里没有密钥），然后 Settings → Pages → Source 选 GitHub Actions。

页面通过 meta 标签设置了内容安全策略，只允许连接本站和 `api.deepseek.com`。不要把密钥放进 Actions Secrets 再注入网页：静态网页里的任何内容访问者都能看到，等于公开了密钥。

### Codespaces

把密钥存为 Codespaces Secret（名字 `DEEPSEEK_API_KEY`，放在 Codespaces 而不是 Actions 下），从 `main` 创建 Codespace，在终端运行 `npm start`，在「端口」面板打开 3000。端口保持 Private。详细步骤见 [GitHub 测试指南](docs/github-testing.md)。

### 本地运行

需要 Node.js 22.9 或更新版本，没有第三方运行时依赖。

```sh
git clone https://github.com/Shelikeit69/grammar-analysis.git
cd grammar-analysis
cp .env.example .env        # Windows PowerShell：Copy-Item .env.example .env
```

用文本编辑器在 `.env` 里填写 `DEEPSEEK_API_KEY`，然后：

```sh
npm start
```

打开终端显示的地址（默认 `http://127.0.0.1:3000`），按 Ctrl+C 停止。修改 `.env` 后需要重启服务。

本地常见问题：提示没有配置密钥时，确认文件名是 `.env` 而不是 `.env.txt`，并且放在仓库根目录；端口被占用时，在 `.env` 里改 `PORT`。

### DeepSeek 配置

默认模型为 `deepseek-flash`，本地可用 `DEEPSEEK_MODEL` 修改，网页版在页面上的「模型名称」修改。接入依据：[官方 API 文档](https://api-docs.deepseek.com/)和 [JSON 输出说明](https://api-docs.deepseek.com/guides/json_mode/)。

真实分析会把输入的英文发给 DeepSeek，并按密钥所属账户计费；内置例句不会发送请求。应用不保存正常分析的输入或历史；主动提交到 GitHub 的公开反馈会持久保存。

### 校验与限制

- AI 返回的结果会先经过 `validateAnalysis` 校验：每句的片段必须和原文逐字对上。模型内容不是有效 JSON、缺少核心字段或与原文对不上时，最多自动修正一次；第二次仍执行完整校验，失败则拒绝显示。这只能检查格式和原文对应，不能保证语法判断正确。
- 不合规的可选 `tense` / `tenseReason` 会被丢弃，不触发额外调用。网络错误、HTTP 错误、超时、取消、超长或截断响应、服务商响应外层解析失败均不会触发格式修正。
- 两次调用共用一个截止时间：网页版总计 90 秒，本地 / Codespaces 默认总计 45 秒；不会因修正而重新计时。
- 修饰关系（片段的可选字段 `modifies`，指向它所修饰的片段下标）不合规时（越界、指向自己、指向标点空白、不是整数）只会丢掉这一条，整句分析照常显示，所以不会因此拒绝整个结果。合规不代表对：AI 可能把修饰对象标错，高亮只作参考，请对照原句判断。
- 相邻的情态动词、助动词和短语动词仍合为一个谓语框。被宾语隔开的短语动词保留原文顺序，显示两个红框，例如 should give / it / up；it 独立为宾语。点击任一红框都解释 give up（放弃），should 的情态含义写在说明中；两个红框不联动高亮。提示词只能降低出错概率。
- 分离粒子的可选字段 `predicateOf` 指向同句较早的主谓语片段下标（从 0 开始，空格和标点也计数）。两端必须均为 predicate/core、原形完全一致，目标不能再带 predicateOf，两端之间须有实质成分；相邻粒子仍合框。不合法时只丢弃该字段，不触发付费修正。旧结果无此字段也可显示。
- 时态和判断依据也是 AI 给的，可能判断错或引用错，同样没有自动校验。
- 句子结构是平铺的，不能嵌套：`If it rains` 这样的从句不会被整体框成一个状语，而是拆成它自己的主语和谓语，靠下方说明文字解释从句关系。
- `must have been working` 这类情态完成结构的时态名称可能被简化；模型输出有随机波动，同一句多次分析的框和措辞可能略有不同。
- 输入最多 300 个英文单词、6000 个字符。
- 不会自动纠正原文的拼写或时态。
- 本地和 Codespaces 的服务只监听 `127.0.0.1`，没有账号系统。不要通过公网隧道或反向代理直接暴露它。

### 代码结构

- `public/`：页面、样式、批注排版、内置例句，以及和后端共用的 `analysis.js`（校验）和 `deepseek.js`（DeepSeek 请求与提示词）。
- `lib/`：转发 `public/` 里的共用模块，供 Node 使用。
- `server.mjs`：本地和 Codespaces 用的 HTTP 服务与访问边界。
- `tests/`：原文对应、接口错误、安全边界和提示词规则测试。
- `docs/`：测试指南、验证记录和设计文档。

### 测试

```sh
npm test
```

测试使用模拟的 DeepSeek 响应，不消耗额度。GitHub Actions 在每次 push 和 PR 时运行。

浏览器检查（CI 与 Pages 发布前也会执行）：

```sh
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
npm run test:browser
```

它同样使用模拟响应，覆盖原文保留、批注引线、手机宽度布局、换行间距、详情切换、修饰对象高亮（点击、再点取消、回车键、390px 无横向滚动）、粘贴、清空和多句翻译；也覆盖静态 Pages 下的密钥设置、存储失败、一次格式修正及取消。设置 `BROWSER_CHANNEL=msedge` 可改用本机 Edge，或用 `BROWSER_EXECUTABLE` 指定浏览器可执行文件。

后续顺序见[待办与路线图](docs/roadmap.md)，人工检查用的句子见[语法回归样例](docs/regression-cases.md)。模拟响应测试不代表真实模型已经通过这些语法样例。

## 分析问题反馈

每句结果及请求失败提示旁都有反馈入口。表单先显示只读原句，再选择问题类型、填写「具体说说」及可选的正确答案；请求失败不显示类型选项，需填写说明。至少选择一个问题类型或填写说明，再勾选「我知道内容会公开」，才能点「去 GitHub 提交 →」。如原句有个人信息，请取消反馈，修改输入后重新分析。

标题和易读的分析正文会自动生成，展开「查看会发送的完整内容」可查看只读预览，其中包括单句分析、请求时实际模型和工具版本；失败反馈只含安全提示。打开链接会把预览内容带到 GitHub，新标签页已填好内容，仍需你在那里点 Create 完成提交，需要 GitHub 账号。提交后会公开，请不要填写姓名、联系方式等个人信息。不会自动提交 Issue，也不会附带设置、密钥、请求头或原始提供方响应。手机端操作区固定在弹窗底部。

预填链接超过 6000 字符时不会截断正文：请复制完整正文，在 GitHub 填写标题并粘贴；自动复制失败会全选正文供手动复制。剪贴板可能保留内容，需要时请自行清除。反馈草稿不保存到浏览器存储，关闭预览或更换输入会清除草稿。

## 许可证

[MIT](LICENSE)
