# 英文语法分析器

像在课本上做批注：粘贴英文，在原句上显示彩色语法框、上下引线和中文释义，最后给出整句翻译。

- 保留原文和实际词形：`felt` 仍然是 `felt`，框外显示 **系动词：feel－感到**。
- 主语蓝色、谓语/系动词红色、宾语/表语绿色；其他结构用文字标签与颜色共同区分。
- 默认展示主干，展开详细结构查看定语、状语等。原文始终完整保留。
- 短段落逐句分析，支持整段翻译和手机浏览。
- DeepSeek 负责分析与翻译；没有密钥也可查看明确标注的内置示例。

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

- 第一版面向个人本地使用，服务仅监听 `127.0.0.1`，不提供账号系统。
- 输入最多 300 个英文单词、6000 个字符，适合单句与短段落。
- GitHub 保存代码和版本。GitHub Pages 只能托管静态前端，不能运行本项目的 DeepSeek 后端；本版不自动部署公开接口。
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
