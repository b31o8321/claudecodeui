<div align="center">
  <img src="public/logo.svg" alt="CloudCLI UI" width="64" height="64">
  <h1>Cloud CLI（又名 Claude Code UI）</h1>
  <p><a href="https://docs.anthropic.com/en/docs/claude-code">Claude Code</a>、<a href="https://docs.cursor.com/en/cli/overview">Cursor CLI</a>、<a href="https://developers.openai.com/codex">Codex</a> 和 <a href="https://geminicli.com/">Gemini-CLI</a> 的桌面和移动端 UI。可在本地或远程使用，从任何地方查看激活的项目与会话。</p>
</div>

<p align="center">
  <a href="https://cloudcli.ai">CloudCLI Cloud</a> · <a href="https://cloudcli.ai/docs">文档</a> · <a href="https://discord.gg/buxwujPNRE">Discord</a> · <a href="https://github.com/siteboon/claudecodeui/issues">Bug 报告</a> · <a href="CONTRIBUTING.md">贡献指南</a>
</p>

<p align="center">
  <a href="https://cloudcli.ai"><img src="https://img.shields.io/badge/☁️_CloudCLI_Cloud-Try_Now-0066FF?style=for-the-badge" alt="CloudCLI Cloud"></a>
  <a href="https://discord.gg/buxwujPNRE"><img src="https://img.shields.io/badge/Discord-Join%20Community-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="加入 Discord 社区"></a>
  <br><br>
  <a href="https://trendshift.io/repositories/15586" target="_blank"><img src="https://trendshift.io/api/badge/repositories/15586" alt="siteboon%2Fclaudecodeui | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

<div align="right"><i><a href="./README.md">English</a> · <a href="./README.ru.md">Русский</a> · <a href="./README.de.md">Deutsch</a> · <a href="./README.ko.md">한국어</a> · <b>中文</b> · <a href="./README.ja.md">日本語</a> · <a href="./README.tr.md">Türkçe</a></i></div>

---

> **Fork 说明** — 本仓库是 [siteboon/claudecodeui](https://github.com/siteboon/claudecodeui) 的 fork，在原项目基础上进行了大量定制，主要聚焦于会话管理的简洁性、移动端体验以及个人工作流优化。所有基础工作的功劳归属于上游项目；本 fork 所做的修改带有较强的个人偏好，不一定适合所有用户。

---

## 项目定位

本 fork **面向单用户在自己电脑上使用**——不是多用户部署，也不是托管型产品。设计上的取舍都基于这个前提：

- **以对话为中心，而非项目为中心**：侧边栏默认是扁平的对话列表（用户选对话的频率远高于选项目）
- **激进的噪音过滤**：sub-agent 转录、claude-mem 观察会话、临时 agent worktree 都默认隐藏（这些是 CLI 用于自身记录的，对用户没有展示价值）
- **无遥测 / 无共享状态**：所有数据都在 `~/.claude/`（Claude CLI 的数据）和 `~/.cloudcli/`（本 app 自己的 DB + 配置）
- **后台服务优先于网页应用**：设计成一个用 `brew services` 跑在后台、可以忘掉的服务，而不是一个需要一直开着的浏览器标签
- **认真对待移动端体验**：stale-while-revalidate 缓存、按 session 持久化滚动位置、"上次看到"分隔线、紧凑的升级提示药丸——目标是 app 即使被移动端系统回收也能从容恢复

如果你需要多用户认证、团队协作、或托管服务，请使用[上游 cloudcli.ai](https://cloudcli.ai)。

---

## 本 fork 的改进

以下改动基于上游 v1.32.0 版本。完整变更记录见 [CHANGELOG.md](CHANGELOG.md)。

### 侧边栏与会话管理

- 过滤子代理会话（`isSidechain: true` 或位于 `subagents/` 目录下），不在侧边栏显示
- 过滤临时项目路径（`.claude/worktrees/agent-*`、`.slock/agents/`、`.claude-mem/`、`.claude/agents/`）
- 过滤 claude-mem 观察者会话（通过消息流第一行的 `queue-operation` 标记识别）
- 会话置顶，支持乐观 UI 更新
- 会话按时间分组：置顶 / 今天 / 昨天 / 本周 / 更早
- 项目按时间分组：收藏 / 今天 / 昨天 / 本周 / 更早，"更早"默认折叠
- 在「设置 → 外观」中可设置默认工作区路径，自动填入新建项目对话框

### 会话标题

- 当 AI 未生成标题时，回退显示首条用户消息的前 60 个字符作为预览
- 支持按需调用 LLM（Haiku 4.5）重新生成标题，取前 3 条 + 后 3 条消息，每会话有节流限制

### 聊天与上下文展示

- 修复 Token / 上下文计算逻辑：改为按请求计算输入 + 缓存 Token（非累计值），分母使用 Claude 4.x 的 200K 上下文窗口
- 输入框下方新增状态条：显示模型 / Git 分支 / 耗时 / 上下文占比 / 工具调用次数，点击可展开详情弹窗
- 详情弹窗：上下文明细、累计 Token 数、费用估算（按模型计价）、工具调用统计，以及来自 `~/.claude/stats-cache.json` 的今日活动数据
- 会话滚动位置持久化，重新加载或切换应用后恢复至上次位置
- 消息流中的「上次访问」分隔线：在上次访问后第一条新消息上方显示标记

### Shell 标签页稳定性

- WebSocket 心跳：服务端每 30 秒 ping / 60 秒无 pong 则超时
- 前端自动重连，采用指数退避策略（2s → 最大 30s）
- 50KB 滚动输出缓冲区，重连后自动回放
- 可视连接状态指示器（绿 / 黄 / 红圆点）

### 性能与首屏加载

- 项目列表使用 `localStorage` 的过期重验证缓存（7 天 TTL），后续访问无需全页加载

### 更新通知

- 移除自动更新机制（原机制会覆盖 fork 中的修改）
- 新增两个独立的版本更新徽章：上游版本（`siteboon/claudecodeui`）与本 fork 版本（`b31o8321/claudecodeui`），各自打开说明弹窗，提供手动更新步骤

### 品牌调整

- GitHub Star 徽章与问题反馈链接均指向本 fork
- 移除 Discord / 社区相关链接
- 移除后端 `POST /api/system/update` 接口

### 代码清理

- 完整移除 TaskMaster 功能（约 110 个文件，删除约 5600 行代码）

---

## 作为后台服务运行（Homebrew）

> 仅支持 macOS。需要 [Homebrew](https://brew.sh) 和 Node 22+。

### 安装

```sh
brew tap b31o8321/cloudcli https://github.com/b31o8321/claudecodeui
brew install --HEAD cloudcli-fork
brew services start cloudcli-fork
```

服务会在登录时自动启动，崩溃后自动重启。

### 停止 / 重启

```sh
brew services stop cloudcli-fork
brew services restart cloudcli-fork
```

### 查看日志

```sh
tail -f $(brew --prefix)/var/log/cloudcli-fork.log
tail -f $(brew --prefix)/var/log/cloudcli-fork.err.log
```

### 配置文件 — `~/.cloudcli/config.json`

`brew install` 安装时会自动生成默认配置文件。编辑该文件可控制网络访问范围：

```json
{
  "bind": "lan",
  "port": 3001,
  "publicUrl": null
}
```

| 字段 | 取值 | 效果 |
|---|---|---|
| `bind` | `"localhost"` | 服务监听 `127.0.0.1`，仅本机可访问 |
| `bind` | `"lan"`（默认） | 服务监听 `0.0.0.0`，局域网内均可访问（例如从手机访问） |
| `port` | 整数 | 监听端口（默认 `3001`） |
| `publicUrl` | 字符串或 `null` | 仅作展示用途 — UI 会显示该 URL；配合 ngrok 使用时填写 |

**从手机访问局域网** — 使用 `"bind": "lan"`（默认值），在手机浏览器中打开 `http://<Mac 的 IP 地址>:3001`。

**仅本机访问（私有开发环境）：**
```json
{ "bind": "localhost", "port": 3001, "publicUrl": null }
```

**通过 ngrok 实现外网访问** — 本服务不内置外网穿透功能。请单独运行 ngrok，并将其打印的 URL 填入 `publicUrl`：
```sh
ngrok http 3001
# 然后更新 ~/.cloudcli/config.json：
# { "bind": "lan", "port": 3001, "publicUrl": "https://abc123.ngrok-free.app" }
```

修改配置后，重启服务使其生效：
```sh
brew services restart cloudcli-fork
```

---

## 路线图

本 fork 的后续计划（不跟踪至上游）：

- 修复加载状态机中「工具执行后无限转圈」问题
- 移动端优先的响应式重构：小屏单列布局、安全区域内边距、触控目标 ≥44px
- 修复长代码块的 Markdown 溢出与换行问题
- 深色模式稳定性提升
- 用户与助手消息气泡视觉区分
- 会话导出为 Markdown / JSON
- 键盘快捷键界面
- PWA / Service Worker 支持离线使用
- Windows 路径兼容性审计
- 死代码与依赖安全审计

---

## 截图

<div align="center">

<table>
<tr>
<td align="center">
<h3>桌面视图</h3>
<img src="public/screenshots/desktop-main.png" alt="桌面界面" width="400">
<br>
<em>显示项目概览和聊天的主界面</em>
</td>
<td align="center">
<h3>移动体验</h3>
<img src="public/screenshots/mobile-chat.png" alt="移动界面" width="250">
<br>
<em>具有触控导航的响应式移动设计</em>
</td>
</tr>
<tr>
<td align="center" colspan="2">
<h3>CLI 选择</h3>
<img src="public/screenshots/cli-selection.png" alt="CLI 选择" width="400">
<br>
<em>在 Claude Code、Gemini、Cursor CLI 与 Codex 之间进行选择</em>
</td>
</tr>
</table>

</div>

## 功能

- **响应式设计** - 在桌面、平板和移动设备上无缝运行，让您随时随地使用 Agents
- **交互聊天界面** - 内置聊天 UI，轻松与 Agents 交流
- **集成 Shell 终端** - 通过内置 shell 功能直接访问 Agents CLI
- **文件浏览器** - 交互式文件树，支持语法高亮与实时编辑
- **Git 浏览器** - 查看、暂存并提交更改，还可切换分支
- **会话管理** - 恢复对话、管理多个会话并跟踪历史记录
- **插件系统** - 通过自定义选项卡、后端服务与集成扩展 CloudCLI。 [开始构建 →](https://github.com/cloudcli-ai/cloudcli-plugin-starter)
- **TaskMaster AI 集成** *(可选)* - 结合 AI 任务规划、PRD 分析与工作流自动化，实现高级项目管理
- **模型兼容性** - 支持 Claude、GPT、Gemini 模型家族（完整支持列表见 [`shared/modelConstants.js`](shared/modelConstants.js)）

## 快速开始

### CloudCLI Cloud（推荐）

无需本地设置即可快速启动。提供可通过网络浏览器、移动应用、API 或喜欢的 IDE 访问的完全集装式托管开发环境。

**[立即开始 CloudCLI Cloud](https://cloudcli.ai)**

### 自托管（开源）

#### npm

启动 CloudCLI UI，只需一行 `npx`（需要 Node.js v22+）：

```bash
npx @cloudcli-ai/cloudcli
```

或进行全局安装，便于日常使用：

```bash
npm install -g @cloudcli-ai/cloudcli
cloudcli
```

打开 `http://localhost:3001`，系统会自动发现所有现有会话。

更多配置选项、PM2、远程服务器设置等，请参阅 **[文档 →](https://cloudcli.ai/docs)**。

#### Docker Sandboxes（实验性）

在隔离的沙箱中运行代理，具有虚拟机管理程序级别的隔离。默认启动 Claude Code。需要 [`sbx` CLI](https://docs.docker.com/ai/sandboxes/get-started/)。

```
npx @cloudcli-ai/cloudcli@latest sandbox ~/my-project
```

支持 Claude Code、Codex 和 Gemini CLI。详情请参阅 [沙箱文档](docker/)。

---

## 哪个选项更适合你？

CloudCLI UI 是 CloudCLI Cloud 的开源 UI 层。你可以在本地机器上自托管它，也可以使用提供团队功能与深入集成的 CloudCLI Cloud。

| | CloudCLI UI（自托管） | CloudCLI Cloud |
|---|---|---|
| **适合对象** | 需要为本地代理会话提供完整 UI 的开发者 | 需要部署在云端，随时从任何地方访问代理的团队与开发者 |
| **访问方式** | 通过 `[yourip]:port` 在浏览器中访问 | 浏览器、任意 IDE、REST API、n8n |
| **设置** | `npx @cloudcli-ai/cloudcli` | 无需设置 |
| **机器需保持开机吗** | 是 | 否 |
| **移动端访问** | 网络内任意浏览器 | 任意设备（原生应用即将推出） |
| **可用会话** | 自动发现 `~/.claude` 中的所有会话 | 云端环境内的会话 |
| **支持的 Agents** | Claude Code、Cursor CLI、Codex、Gemini CLI | Claude Code、Cursor CLI、Codex、Gemini CLI |
| **文件浏览与 Git** | 内置于 UI | 内置于 UI |
| **MCP 配置** | UI 管理，与本地 `~/.claude` 配置同步 | UI 管理 |
| **IDE 访问** | 本地 IDE | 任何连接到云环境的 IDE |
| **REST API** | 是 | 是 |
| **n8n 节点** | 否 | 是 |
| **团队共享** | 否 | 是 |
| **平台费用** | 免费开源 | 起价 $7/月 |

> 两种方式都使用你自己的 AI 订阅（Claude、Cursor 等）— CloudCLI 提供环境，而非 AI。

---

## 安全与工具配置

**🔒 重要提示**: 所有 Claude Code 工具默认**禁用**，可防止潜在的有害操作自动运行。

### 启用工具

1. **打开工具设置** - 点击侧边栏齿轮图标
2. **选择性启用** - 仅启用所需工具
3. **应用设置** - 偏好设置保存在本地

<div align="center">

![工具设置弹窗](public/screenshots/tools-modal.png)
*工具设置界面 - 只启用你需要的内容*

</div>

**推荐做法**: 先启用基础工具，再根据需要添加其他工具。随时可以调整。

---

## 插件

CloudCLI 配备插件系统，允许你添加带自定义前端 UI 和可选 Node.js 后端的选项卡。在 Settings > Plugins 中直接从 Git 仓库安装插件，或自行开发。

### 可用插件

| 插件 | 描述 |
|---|---|
| **[Project Stats](https://github.com/cloudcli-ai/cloudcli-plugin-starter)** | 展示当前项目的文件数、代码行数、文件类型分布、最大文件以及最近修改的文件 |

### 自行构建

**[Plugin Starter Template →](https://github.com/cloudcli-ai/cloudcli-plugin-starter)** — Fork 该仓库以构建自己的插件。示例包括前端渲染、实时上下文更新和 RPC 通信。

**[插件文档 →](https://cloudcli.ai/docs/plugin-overview)** — 提供插件 API、清单格式、安全模型等完整指南。

---

## 常见问题

<details>
<summary>与 Claude Code Remote Control 有何不同？</summary>

Claude Code Remote Control 让你发送消息到本地终端中已经运行的会话。该方式要求你的机器保持开机，终端保持开启，断开网络后约 10 分钟会话会超时。

CloudCLI UI 与 CloudCLI Cloud 是对 Claude Code 的扩展，而非旁观 — MCP 服务器、权限、设置、会话与 Claude Code 完全一致。

- **覆盖全部会话** — CloudCLI UI 会自动扫描 `~/.claude` 文件夹中的每个会话。Remote Control 只暴露当前活动的会话。
- **设置统一** — 在 CloudCLI UI 中修改的 MCP、工具权限等设置会立即写入 Claude Code。
- **支持更多 Agents** — Claude Code、Cursor CLI、Codex、Gemini CLI。
- **完整 UI** — 除了聊天界面，还包括文件浏览器、Git 集成、MCP 管理和 Shell 终端。
- **CloudCLI Cloud 保持运行于云端** — 关闭本地设备也不会中断代理运行，无需监控终端。

</details>

<details>
<summary>需要额外购买 AI 订阅吗？</summary>

需要。CloudCLI 只提供环境。你仍需自行获取 Claude、Cursor、Codex 或 Gemini 订阅。CloudCLI Cloud 从 $7/月起提供托管环境。

</details>

<details>
<summary>能在手机上使用 CloudCLI UI 吗？</summary>

可以。自托管时，在你的设备上运行服务器，然后在网络中的任意浏览器打开 `[yourip]:port`。CloudCLI Cloud 可从任意设备访问，内置原生应用也在开发中。

</details>

<details>
<summary>UI 中的更改会影响本地 Claude Code 配置吗？</summary>

会的。自托管模式下，CloudCLI UI 读取并写入 Claude Code 使用的 `~/.claude` 配置。通过 UI 添加的 MCP 服务器会立即在 Claude Code 中可见。

</details>

---

## 社区与支持

- **[文档](https://cloudcli.ai/docs)** — 安装、配置、功能与故障排除指南
- **[Discord](https://discord.gg/buxwujPNRE)** — 获取帮助并与社区交流
- **[GitHub Issues](https://github.com/siteboon/claudecodeui/issues)** — 报告 Bug 与建议功能
- **[贡献指南](CONTRIBUTING.md)** — 如何参与项目贡献

## 许可证

GNU 通用公共许可证 v3.0 - 详见 [LICENSE](LICENSE) 文件。

该项目为开源软件，在 GPL v3 许可证下可自由使用、修改与分发。

## 致谢

### 使用技术
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - Anthropic 官方 CLI
- **[Cursor CLI](https://docs.cursor.com/en/cli/overview)** - Cursor 官方 CLI
- **[Codex](https://developers.openai.com/codex)** - OpenAI Codex
- **[Gemini-CLI](https://geminicli.com/)** - Google Gemini CLI
- **[React](https://react.dev/)** - 用户界面库
- **[Vite](https://vitejs.dev/)** - 快速构建工具与开发服务器
- **[Tailwind CSS](https://tailwindcss.com/)** - 实用先行 CSS 框架
- **[CodeMirror](https://codemirror.net/)** - 高级代码编辑器
- **[TaskMaster AI](https://github.com/eyaltoledano/claude-task-master)** *(可选)* - AI 驱动的项目管理与任务规划

### 赞助商
- [Siteboon - AI powered website builder](https://siteboon.ai)
---

<div align="center">
  <strong>为 Claude Code、Cursor 和 Codex 社区精心打造。</strong>
</div>
