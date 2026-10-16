# 英文语法分析器

像在课本上做批注：粘贴英文，在原句上显示彩色语法框、上下引线和中文释义，最后给出整句翻译。

- 保留原文和实际词形：`felt` 仍然是 `felt`，框外显示 **系动词：feel－感到**。
- 谓语是一个连续的整体：情态动词、助动词、否定词、主动词以及短语动词的小品词/介词合并成一个框（如 `can shop for` → 谓语：shop for－选购）；介词本身不会被单独标成谓语。
- 每句在卡片顶部用淡黄色框标出整句（主句）的时态和语态，如「时态：一般将来时 · 被动语态」。
- 主语蓝色、谓语/系动词红色、宾语/表语绿色；其他结构用文字标签与颜色共同区分。
- 默认展示主干，展开详细结构查看定语、状语等。原文始终完整保留。
- 短段落逐句分析，支持整段翻译和手机浏览。
- DeepSeek 负责分析与翻译；没有密钥也可查看明确标注的内置示例。
- 免费开源：网页版由每位用户填写自己的 DeepSeek 密钥。

## 三种使用方式

| 方式 | 密钥放在哪里 | 适合 |
|---|---|---|
| **网页版（GitHub Pages）** | 访问者自己的浏览器 | 打开网址即用，每人用自己的 DeepSeek 密钥 |
| Codespaces | Codespaces Secrets | 不装软件、在 GitHub 云端私有测试 |
| 本地运行 | 本机 `.env` | 离线开发、修改代码 |

## 网页版（GitHub Pages）

网页版是纯静态页面，没有服务器。分析时由**你的浏览器直接请求 DeepSeek**，使用你在页面上填写的密钥，按你的 DeepSeek 账户计费。

- 密钥不会上传到本网站、GitHub 或仓库。默认只在当前页面有效；勾选“在这台设备上记住密钥”后才保存在本机浏览器（localStorage）。公用电脑请不要勾选，用完可点“清除密钥”。
- 页面设置了内容安全策略，只允许连接本站和 `api.deepseek.com`。
- 不要把密钥放进 Actions Secrets 再“注入”网页：静态网页里的任何内容都能被访问者看到，等于公开密钥。

### 开启步骤（仓库维护者）

1. 仓库 Settings → General → Danger Zone，把仓库改为 **Public**（免费账户的 Pages 需要公开仓库）。仓库中没有密钥。
2. 仓库 Settings → **Pages** → Build and deployment → Source 选择 **GitHub Actions**。
3. 推送到 `main`（或在 Actions 页手动运行 “Deploy to GitHub Pages”）。工作流先跑测试，再只发布 `public/` 目录。
4. 完成后网址为 `https://<用户名>.github.io/grammar-analysis/`。

### 已知限制

- 网页版能否工作，取决于 DeepSeek 是否允许浏览器跨域调用（CORS）。若点击分析后提示“浏览器无法直接连接 DeepSeek”，说明被浏览器拦截，此时请改用 Codespaces 或本地运行。
- 模型名称可在页面上修改，需填写你的账户实际可用的模型。

## 在 GitHub 上测试（Codespaces）

使用 Codespaces 同时运行前端与后端，端口保持 Private。把密钥放到 Codespaces Secrets，按[GitHub 测试指南](docs/github-testing.md)操作。从 `main` 分支创建即可。

## 本地运行

需要 **Node.js 22.9 或更新版本**。无需安装第三方运行时依赖。

```sh
git clone https://github.com/Shelikeit69/grammar-analysis.git
cd grammar-analysis
```

将 `.env.example` 复制为 `.env`，用本地文本编辑器填写 `DEEPSEEK_API_KEY`。Windows PowerShell 可运行：

```powershell
Copy-Item .env.example .env
```

macOS / Linux：

```sh
cp .env.example .env
```

然后启动：

```sh
npm start
```

打开终端显示的本地网址（默认 `http://127.0.0.1:3000`）。保持终端运行；按 Ctrl+C 停止。

在网页输入英文并点击“分析句子”，或直接粘贴英文自动分析。先用“查看示例”可检查界面，无需调用 API。

## DeepSeek 配置

密钥在 [DeepSeek 开放平台](https://platform.deepseek.com/) 创建，只填写在本机 `.env` 中，不要放到网页、截图、Issue 或提交记录。

默认模型为 `deepseek-flash`，可通过 `DEEPSEEK_MODEL` 修改为账户可用的模型。接入依据：[官方 API 文档](https://api-docs.deepseek.com/)与 [JSON 输出说明](https://api-docs.deepseek.com/guides/json_mode/)。修改环境文件后需要重启服务。

真实分析会把输入英文发送至 DeepSeek，并按你的账户计费；内置示例不会发送请求。应用不保存输入或分析历史，不记录输入正文。AI 可能误判语法或翻译；结构校验只能保证格式与原文对应，不能证明语义一定正确。

## 使用范围与限制

- 本地与 Codespaces 版本的服务仅监听 `127.0.0.1`；Codespaces 通过私有端口转发访问，不提供自建账号系统。
- 输入最多 300 个英文单词、6000 个字符，适合单句与短段落。
- GitHub Pages 只托管静态前端，不运行后端，也不保存任何人的密钥；网页版的 AI 调用都使用访问者自己的密钥。
- 不要通过公网隧道或反向代理直接暴露此服务。若以后需要远程使用，应先增加身份验证、限额和部署配置。
- 不自动纠正原文拼写或时态，歧义解释以当前分析为准。

## 检查与开发

```sh
npm test
```

测试使用模拟的 DeepSeek 响应，不消耗 API 额度。GitHub Actions 在 push/PR 时运行测试。真实模型调用需配置本地密钥后另行验证。

代码结构：

- `server.mjs`：本地 HTTP 服务与访问边界。
- `lib/`：输入/输出校验和 DeepSeek 请求。
- `public/`：界面、批注布局和内置示例。
- `tests/`：原文对应、接口错误和安全边界测试。
- `docs/superpowers/`：本版设计与实施计划。

## 常见问题

**提示没有配置密钥**：确认文件叫 `.env`（不是 `.env.txt`），位于仓库根目录；填写后重启服务。

**分析超时或失败**：检查网络与 DeepSeek 账户状态，再重试。模型返回不完整或无法对应原文的结构时，应用会拒绝显示该结果。

**端口被占用**：关闭已有服务，或在 `.env` 设置其他 `PORT` 后重启。

## 许可证

[MIT](LICENSE)。

### 可选：浏览器回归检查

基础测试不需要额外依赖。如需运行排版和交互检查：

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
npm run test:browser
```

检查使用本地模拟响应，不会调用 DeepSeek。覆盖原文保留、批注引线、390px 手机布局、长短语基线、详情切换、粘贴、清空、多句翻译和旧响应隔离。可设置 `BROWSER_CHANNEL=msedge` 使用本机 Edge；否则使用 Playwright Chromium。
