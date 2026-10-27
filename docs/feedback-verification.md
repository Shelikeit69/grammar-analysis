# 反馈功能验证记录

日期：2026-10-26。版本：2026-10-26-feedback-preview。当前分支实现，待审核和发布。

## 自动验证

- 单独运行反馈模块测试：3 项通过。
- npm test：55 项通过，0 失败。
- npm run test:browser：原有浏览器检查 30 项通过，静态 Pages 检查 11 项通过，反馈流程 39 个实际断言通过。
- 浏览器使用本机 Microsoft Edge；保留 BROWSER_EXECUTABLE 自定义浏览器支持。

反馈检查包括：示例标记、默认禁用提交入口、取消和 Escape 焦点返回、编辑后重新确认、特殊字符正确编码与不执行 HTML、390px 无横向溢出、超过 6000 字符链接的完整正文保留及复制失败手动全选、单句不包含其他句子、本地失败提示与页面一致、旧服务模型未知、Pages 实际请求模型快照、改设置后旧结果仍用原模型、失败模型与安全提示、清空/编辑/示例隔离，以及旧对话框异步复制失败不得改写新预览。

Pages 反馈场景使用同一 HTML 与 meta CSP，模拟静态托管时不附加本地后端的 connect-src self 响应头。DeepSeek 请求均由浏览器路由模拟，其他 HTTPS 请求拦截；window.open 被替换为参数记录。没有真实付费 API 调用，也没有打开或提交真实 GitHub Issue。服务测试验证新增 feedback.js 与 version.js 可被访问。

## 边界

上述证据证明本地模拟流程，不代表真实模型语法正确性、真实 GitHub 登录/最终提交、在线 Pages 或 Codespaces 已验证。尚未合并或上线。本轮关联 #19，后续 PR 使用 Refs 关联；上线复测后再手动关闭对应 Issue。

## 接手复核（2026-10-27）

重新运行 npm test（55/55）和 npm run test:browser（30 + 11 + 39），均通过；git diff --check 通过。仍全部使用模拟响应，未调用真实模型或提交真实 Issue。
