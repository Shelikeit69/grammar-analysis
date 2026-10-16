# 句间 · 英文语法分析器

把一句英文贴进去，它会像老师在课本上做批注一样，把主语、谓语、宾语用不同颜色框出来，旁边写上中文意思，最后给出整句翻译。

**直接打开就能用：https://shelikeit69.github.io/grammar-analysis/**

不用下载，不用安装，电脑和手机都能打开。

## 第一次使用

不填任何东西也能先看效果：打开网页，点「试试一个例句」，就能看到一句分析好的示范。

页面顶部有三个步骤提示，做完一步会打上勾。想分析你自己的句子，需要一把 DeepSeek 的「密钥」。这个工具本身免费，但分析是由 DeepSeek 的 AI 完成的，DeepSeek 按使用量收费，所以每个人用自己的账户。具体价格以 [DeepSeek 官网](https://platform.deepseek.com/) 为准。

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

### 3. 开始分析

把英文粘贴进上方的输入框。粘贴后会自动开始分析，也可以手动点「分析句子」。一次最多 300 个单词，适合一句话或一小段。

## 怎么看结果

颜色对应的成分：

| 颜色 | 成分 | 例子 |
|---|---|---|
| 蓝 | 主语（谁） | **Everyone** felt nervous. |
| 红 | 谓语 / 系动词（做什么、是什么状态） | Everyone **felt** nervous. |
| 绿 | 宾语 / 表语（做的对象、状态的内容） | Everyone felt **nervous**. |
| 紫 | 状语（什么时候、在哪里、怎么样） | |
| 灰 | 定语（修饰名词的部分） | Everyone **in the stadium** … |
| 橙 | 补语 | |
| 淡黄 | 整句的时态和语态，显示在句子上方的黄框里；句子有并列分句或不同时态的从句时，会用「；」分别列出 | 一般过去时 · 主动语态 |

几个小提示：

- 刚出来的结果只框出句子的主干。想看定语、状语这些修饰部分，勾选右上角的「显示详细结构」。
- 点任意一个彩色框，下方会出现更详细的解释。
- 框旁边写的是这个词的原形。比如原句是 `felt`，框外会写「系动词：feel－感到」，方便你查词典。`can shop for` 这样的多个词会合成一个谓语框，不会拆开。
- 句子上方的淡黄色框写着这句的时态和语态，下面的「判断依据」会说明是根据哪个动词形式、哪个时间词判断的。句子里有并列分句或不同时态的从句时，黄框会用「；」按顺序分别列出，相同时态只写一次。
- 一段话里有好几句时，最下面可以展开「查看整段翻译」。
- 字太小看不清，点右上角的「大字」，整页会放大。再点一次恢复。这个设置会记在这台设备上。

## 常见问题

**密钥安全吗？**
密钥只留在你自己的浏览器里，不会传到这个网站、GitHub 或任何别的地方。分析时，你的浏览器直接把句子发给 DeepSeek。不勾「记住」，关掉网页密钥就没了；勾了也可以随时点「清除密钥」删掉。

**AI 会分析错吗？**
会。大多数时候是对的，但它偶尔会把成分标错，尤其是很长、很绕的句子。拿来辅助理解很合适，考试前最好再对照课本或问一下老师。

**提示「DeepSeek 拒绝了这个密钥」**
密钥可能没复制完整，或者前后多了空格。重新复制一遍再保存。

**提示「账户余额不足」**
去 DeepSeek 官网充值。

**提示「请检查模型名称」**
在「模型名称」一栏填 DeepSeek 官网上写的、你账户能用的模型名，然后保存。

**提示「浏览器无法直接连接 DeepSeek」**
先检查网络。如果网络正常仍然出现，可以在 GitHub 上提一个 Issue 告诉我。

**这个工具会保存我输入的句子吗？**
不会。网页版没有自己的后端，也没有数据库，输入的英文只发给 DeepSeek 做分析。

## 密钥与隐私：这个网页会拿你的密钥做什么

这是个人试验项目，目前不收费，页面里没有广告和统计代码。关于你填进去的 DeepSeek 密钥，实际情况如下：

- 密钥只会作为请求头发给 `api.deepseek.com`，用来替你调用 DeepSeek。网页版没有自己的服务器，没有别的地方会收到它。
- 页面带有内容安全策略（CSP），浏览器只允许它连接本站和 `api.deepseek.com`，不能把数据发到其他域名。可以在 `public/index.html` 里看到这一行。
- 页面只加载自己的 `app.js` 和 `styles.css`，没有第三方脚本、字体或图片。
- 默认只在当前页面里保存密钥，关掉网页就没了。勾选「在这台设备上记住密钥」后才会存进你自己浏览器的 localStorage，点「清除密钥」即可删除。
- 你输入的英文会发给 DeepSeek，由 DeepSeek 按它自己的规则处理。这一点我管不了，用之前请自己看一下它的隐私政策。
- 费用由你的 DeepSeek 账户承担。每次分析最多输出 16000 个 token，输入限制在 300 词以内。

以上只适用于官方地址 https://shelikeit69.github.io/grammar-analysis/ 。别人 fork 或搬走的副本我没法担保，请不要往来路不明的网页里填密钥。

不想直接信我的话，可以自己核实：

1. 打开浏览器开发者工具的「网络」页，点一次分析，看请求是不是只发到了 `api.deepseek.com`。
2. 代码全部公开，搜 `apiKey` 就能看到它被用在哪里。
3. 先在 DeepSeek 开放平台新建一个只充少量余额的密钥来试，用完直接删除。这是任何网页工具都适用的做法。

## 试验与合作

这个项目还很早，AI 的判断会出错，我也还在摸索怎么让它更稳。欢迎一起改进，最有用的是这几种：

- 提交判错的句子：在 GitHub 开一个 Issue，贴上原句、你看到的结果和你认为正确的答案。
- 测试不同的句型、时态和模型，告诉我哪里不稳定。
- 改提示词、改排版、补测试，直接提 PR。
- 教英语或学英语的人提意见：哪些标注对初学者有用，哪些看不懂。

代码用 MIT 许可证开源，你可以自由使用和修改。想一起做，直接在 GitHub 上开 Issue 或 PR 就行。

**English summary.** This is a free, open-source (MIT) experiment that draws colored grammar boxes, Chinese glosses and a tense note over English sentences. It runs entirely in your browser. You paste your own DeepSeek API key, and the page sends it only to `api.deepseek.com` (enforced by a Content-Security-Policy; there are no analytics, ads or third-party scripts). The key is kept in memory unless you tick "remember", and you can clear it any time. There is no backend and nothing is stored on a server. Your sentences go to DeepSeek and are handled under its policy. The AI sometimes labels things wrongly, so bug reports with example sentences are the most useful contribution.

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

真实分析会把输入的英文发给 DeepSeek，并按密钥所属账户计费；内置例句不会发送请求。应用不保存输入或分析历史。

### 校验与限制

- AI 返回的结果会先经过 `validateAnalysis` 校验：每句的片段必须和原文逐字对上，缺字段或对不上就拒绝显示。这只能保证格式和原文一致，不能保证语法判断正确。
- 提示词要求把情态动词、助动词、短语动词的介词并入同一个谓语框，介词不会被单独标成谓语。这只能降低出错概率，不能保证每次都对。
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

可选的浏览器排版检查：

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:browser
```

它同样使用模拟响应，覆盖原文保留、批注引线、手机宽度布局、换行间距、详情切换、粘贴、清空和多句翻译。设置 `BROWSER_CHANNEL=msedge` 可改用本机 Edge。

## 许可证

[MIT](LICENSE)
