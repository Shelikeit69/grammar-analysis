# 完全使用 GitHub 测试

使用 **GitHub Codespaces** 同时运行前端与后端；无需外部托管，也无需本机常开。不是 GitHub Pages 常驻站点：Codespace 停止后，预览网址也停止服务。

## 1. 仓库可见性

Codespaces 在 Public 或 Private 仓库都能使用。若同时开启了 GitHub Pages 网页版，仓库需为 Public（免费账户）。代码中没有密钥，公开仓库是安全的；密钥只放在下面的 Codespaces Secrets 中。

## 2. 配置 DeepSeek 密钥

打开仓库 Settings → Secrets and variables → **Codespaces** → New repository secret。

- Name：`DEEPSEEK_API_KEY`
- Secret：你的 DeepSeek API 密钥

这里选择 Codespaces，不是 Actions。Actions Secrets 不会自动提供给 Codespace。不要把密钥放到 Variables、代码、网页或 Issue 中。

若已创建 Codespace，再添加/修改密钥，需要停止并重新启动 Codespace，让新环境变量生效。只刷新网页或重启 Node 不能保证新密钥被注入。

## 3. 创建测试环境

1. 在仓库分支下拉框选择 `main`。
2. 点击绿色 Code → Codespaces → Create codespace（或 New with options，确认分支）。
3. 选择最小可用机器，等待环境启动。仓库的 `.devcontainer/devcontainer.json` 会配置 Node 22 和 3000 端口。
4. 在网页编辑器底部 Terminal 运行：

```sh
npm start
```

无需 npm install，无需创建 .env。Codespaces Secret 已作为环境变量传给后端。没有密钥时也能运行并查看示例。

## 4. 打开私有交互页面

打开 Ports 面板，找到 3000，确认 Visibility 为 **Private**，点击浏览器图标或 Open in Browser。

网址形如 `https://你的codespace名称-3000.app.github.dev`。Private 端口默认仅你能访问，需要登录 GitHub。保持 Private；本应用没有自建登录系统，不能把端口改成 Public。

页面可以粘贴英文，后端会调用 DeepSeek。密钥不发送给浏览器。仅输入的英文会发给 DeepSeek，调用按 DeepSeek 账户计费。

## 5. 测完停止

在 GitHub 的 Codespaces 管理页停止该 Codespace。下次重新打开并运行 `npm start` 即可继续。Codespaces 有计算和存储用量额度；停止可结束计算用量，存储会保留，删除不再使用的环境可释放存储。不要把停止 Codespace 当成永久在线部署。

## 当前验证范围

已在本地模拟 Codespaces 的 Host/Origin 转发做测试，确认只接受当前环境对应的 HTTPS 域名，不接受其他 Codespace 或伪造转发头。完整 GitHub 云端环境与真实 DeepSeek 请求仍需创建 Codespace、配置密钥后验证。

参考：[端口预览与 Private 访问](https://docs.github.com/en/codespaces/developing-in-a-codespace/forwarding-ports-in-your-codespace)、[Codespaces 密钥](https://docs.github.com/en/codespaces/managing-codespaces-for-your-organization/managing-development-environment-secrets-for-your-repository-or-organization)、[额度说明](https://docs.github.com/en/codespaces/troubleshooting/troubleshooting-included-usage)。
