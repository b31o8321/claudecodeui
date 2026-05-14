# Cloud CLI — 个人 Fork

Claude Code 的自托管 Web UI，针对单用户场景深度定制。

---

## Fork 说明

本仓库 fork 自 [siteboon/claudecodeui](https://github.com/siteboon/claudecodeui)，基于上游 **v1.32.0** 版本分叉。

由 [b31o8321](https://github.com/b31o8321) 个人维护，供日常使用。这不是通用发行版，所有改动带有较强个人偏好，未必适合其他工作流。

---

## 项目定位

本 fork **面向单用户在自己电脑上使用**——不是多用户部署，也不是托管型产品。设计取舍都基于这个前提：

- **以对话为中心，而非项目为中心**：侧边栏默认是扁平的对话列表（选对话的频率远高于选项目）
- **激进的噪音过滤**：sub-agent 转录、claude-mem 观察会话、临时 agent worktree 都默认隐藏（这些是 CLI 内部记录用的，对用户没有展示价值）
- **无遥测 / 无共享状态**：所有数据都在 `~/.claude/`（Claude CLI 的数据）和 `~/.cloudcli/`（本 app 的 DB + 配置）
- **后台服务优先于网页应用**：设计成用 `brew services` 静默运行在后台、可以忘掉的服务，而不是需要一直开着的浏览器标签
- **认真对待移动端体验**：stale-while-revalidate 缓存、按会话持久化滚动位置、"上次看到"分隔线、紧凑的更新提示——目标是 app 被移动端系统回收后也能从容恢复

如果你需要多用户认证、团队协作或托管服务，请使用[上游 cloudcli.ai](https://cloudcli.ai)。

---

## 本 Fork 的改进

以下改动基于上游 v1.32.0。完整变更记录见 [CHANGELOG.md](CHANGELOG.md)。

### 侧边栏与会话管理

- 过滤子代理会话（`isSidechain: true` 或位于 `subagents/` 目录），不在侧边栏显示
- 过滤临时项目路径（`.claude/worktrees/agent-*`、`.slock/agents/`、`.claude-mem/`、`.claude/agents/`）
- 过滤 claude-mem 观察者会话（通过消息流第一行的 `queue-operation` 标记识别）
- 会话置顶，支持乐观 UI 更新
- 会话按时间分组：置顶 / 今天 / 昨天 / 本周 / 更早
- 项目按时间分组：收藏 / 今天 / 昨天 / 本周 / 更早，"更早"默认折叠
- 在「设置 → 外观」中可设置默认工作区路径，自动填入新建项目对话框

### 会话标题

- AI 未生成标题时，回退显示首条用户消息的前 60 个字符
- 支持按需调用 LLM（Haiku 4.5）重新生成标题，取前 3 条 + 后 3 条消息，每会话有节流限制

### 聊天与上下文展示

- 修复 Token / 上下文计算：改为按请求计算输入 + 缓存 Token（非累计值），分母使用 Claude 4.x 的 200K 上下文窗口
- 输入框下方新增状态条：显示模型 / Git 分支 / 耗时 / 上下文占比 / 工具调用次数，点击展开详情弹窗
- 详情弹窗：上下文明细、累计 Token 数、费用估算（按模型计价）、工具调用统计，以及来自 `~/.claude/stats-cache.json` 的今日活动
- 会话滚动位置持久化，重新加载或切换应用后自动恢复
- 消息流中的「上次访问」分隔线：在上次访问后第一条新消息上方显示标记

### Shell 标签页稳定性

- WebSocket 心跳：服务端每 30 秒 ping / 60 秒无 pong 则超时
- 前端自动重连，采用指数退避策略（2s → 最大 30s）
- 50KB 滚动输出缓冲区，重连后自动回放
- 可视连接状态指示器（绿 / 黄 / 红圆点）

### 性能与首屏

- 项目列表使用 `localStorage` 过期重验证缓存（7 天 TTL），后续访问无需全页加载

### 更新通知

- 移除自动更新机制（原机制会覆盖 fork 中的修改）
- 新增两个独立版本徽章：上游（`siteboon/claudecodeui`）与本 fork（`b31o8321/claudecodeui`），各自打开弹窗提供手动更新步骤

### 代码清理

- 完整移除 TaskMaster 功能（约 110 个文件，删除约 5600 行代码）
- 移除 Discord / 社区链接及后端 `POST /api/system/update` 接口
- GitHub Star 徽章与问题反馈链接均指向本 fork

---

## 路线图

本 fork 的后续计划（不跟踪至上游）：

- 修复「工具执行后无限转圈」的加载状态机问题
- 移动端优先响应式重构：小屏单列布局、安全区域内边距、触控目标 ≥44px
- 修复长代码块的 Markdown 溢出与换行问题
- 深色模式稳定性提升
- 用户与助手消息气泡视觉区分
- 会话导出为 Markdown / JSON
- 键盘快捷键界面
- PWA / Service Worker 支持离线使用
- Windows 路径兼容性审计
- 死代码与依赖安全审计

---

## 安装与运行

### 方式 A：作为后台服务运行（Homebrew）

> 仅支持 macOS，需要 [Homebrew](https://brew.sh) 和 Node 22+。

```sh
brew tap b31o8321/cloudcli https://github.com/b31o8321/claudecodeui
brew install --HEAD cloudcli-fork
brew services start cloudcli-fork
```

服务会在登录时自动启动，崩溃后自动重启。

**停止 / 重启：**
```sh
brew services stop cloudcli-fork
brew services restart cloudcli-fork
```

**查看日志：**
```sh
tail -f $(brew --prefix)/var/log/cloudcli-fork.log
tail -f $(brew --prefix)/var/log/cloudcli-fork.err.log
```

### 方式 B：从源码运行（开发模式）

```sh
git clone https://github.com/b31o8321/claudecodeui.git
cd claudecodeui
npm install
npm run dev
```

在浏览器打开 `http://localhost:3001`。

---

## 配置文件 — `~/.cloudcli/config.json`

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
| `bind` | `"localhost"` | 监听 `127.0.0.1`，仅本机可访问 |
| `bind` | `"lan"`（默认） | 监听 `0.0.0.0`，局域网内均可访问 |
| `port` | 整数 | 监听端口（默认 `3001`） |
| `publicUrl` | 字符串或 `null` | 仅作展示用途，配合 ngrok 使用时填写 |

**通过 ngrok 实现外网访问** — 不内置外网穿透，请单独运行 ngrok 并将地址填入 `publicUrl`：
```sh
ngrok http 3001
# 然后更新 ~/.cloudcli/config.json：
# { "bind": "lan", "port": 3001, "publicUrl": "https://abc123.ngrok-free.app" }
```

修改配置后执行 `brew services restart cloudcli-fork` 使其生效。

---

## 许可证与致谢

许可证：AGPL-3.0-or-later，详见 [LICENSE](LICENSE)。

本项目基于 [siteboon/claudecodeui](https://github.com/siteboon/claudecodeui) 构建，原项目由 Robin Münch 及贡献者开发。

本 fork 由 [b31o8321](https://github.com/b31o8321) 个人维护，供日常使用。
