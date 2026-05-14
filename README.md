<div align="center">
  <img src="public/logo.svg" alt="CloudCLI UI" width="64" height="64">
  <h1>Cloud CLI (aka Claude Code UI)</h1>
  <p>A desktop and mobile UI for <a href="https://docs.anthropic.com/en/docs/claude-code">Claude Code</a>, <a href="https://docs.cursor.com/en/cli/overview">Cursor CLI</a>, <a href="https://developers.openai.com/codex">Codex</a>, and <a href="https://geminicli.com/">Gemini-CLI</a>.<br>Use it locally or remotely to view your active projects and sessions from everywhere.</p>
</div>

<p align="center">
  <a href="https://cloudcli.ai">CloudCLI Cloud</a> · <a href="https://cloudcli.ai/docs">Documentation</a> · <a href="https://discord.gg/buxwujPNRE">Discord</a> · <a href="https://github.com/siteboon/claudecodeui/issues">Bug Reports</a> · <a href="CONTRIBUTING.md">Contributing</a>
</p>

<p align="center">
  <a href="https://cloudcli.ai"><img src="https://img.shields.io/badge/☁️_CloudCLI_Cloud-Try_Now-0066FF?style=for-the-badge" alt="CloudCLI Cloud"></a>
  <a href="https://discord.gg/buxwujPNRE"><img src="https://img.shields.io/badge/Discord-Join%20Community-5865F2?style=for-the-badge&logo=discord&logoColor=white" alt="Join our Discord"></a>
  <br><br>
  <a href="https://trendshift.io/repositories/15586" target="_blank"><img src="https://trendshift.io/api/badge/repositories/15586" alt="siteboon%2Fclaudecodeui | Trendshift" style="width: 250px; height: 55px;" width="250" height="55"/></a>
</p>

<div align="right"><i><b>English</b> · <a href="./README.ru.md">Русский</a> · <a href="./README.de.md">Deutsch</a> · <a href="./README.ko.md">한국어</a> · <a href="./README.zh-CN.md">中文</a> · <a href="./README.ja.md">日本語</a> · <a href="./README.tr.md">Türkçe</a></i></div>

---

> **Fork notice** — This is a fork of [siteboon/claudecodeui](https://github.com/siteboon/claudecodeui) with substantial customizations focused on cleaner session management, mobile UX, and a personal workflow. The upstream project is the source of all foundational work; this fork adds opinionated changes that may not be appropriate for general use.

---

## Project Positioning

This fork is **scoped for a single user on their own machine** — not a multi-tenant deployment, not a hosted product. Design choices reflect that:

- **Conversation-first**, not project-first: the sidebar defaults to a flat conversation list (you spend more time picking a conversation than a project)
- **Noise filtering is aggressive**: sub-agent transcripts, claude-mem observer sessions, and ephemeral agent worktrees are hidden by default (they're useful for the CLI to write, useless to surface in the UI)
- **No telemetry / no shared state**: everything lives in `~/.claude/` (Claude CLI's data) and `~/.cloudcli/` (this app's own DB + config)
- **Background service over web app**: designed to run quietly as a `brew services` background process you forget about, not a full-screen tab you keep open
- **Mobile-first UX is taken seriously**: stale-while-revalidate caching, per-session scroll persistence, "last visit" divider, compact update pills — built so the app survives mobile OS tab-reaping with grace

If you need multi-user auth, team collaboration, or a hosted offering, look at the [upstream cloudcli.ai product](https://cloudcli.ai) instead.

---

## Improvements in this fork

Changes made on top of upstream v1.32.0. See [CHANGELOG.md](CHANGELOG.md) for the full log.

### Sidebar & Session Management

- Filter sub-agent sessions (`isSidechain: true` or in `subagents/` dirs) from the sidebar list
- Filter ephemeral project paths (`.claude/worktrees/agent-*`, `.slock/agents/`, `.claude-mem/`, `.claude/agents/`)
- Filter claude-mem observer sessions (detected by first-line `queue-operation` marker)
- Session pinning with optimistic UI updates
- Time-bucket grouping for sessions: Pinned / Today / Yesterday / This Week / Older
- Time-bucket grouping for projects: Starred / Today / Yesterday / This Week / Older, with "Older" collapsed by default
- Default workspace path setting (Settings → Appearance) auto-fills the Create Project dialog

### Session Titles

- Fallback to first user message preview (60 chars) when no AI-generated title exists
- On-demand LLM title regeneration (Haiku 4.5) using the first 3 + last 3 messages, with per-session throttling

### Chat & Context Display

- Fixed token/context calculation: now per-request input + cache tokens (not cumulative), with a 200K Claude 4.x window denominator
- Status strip below the composer: model / git branch / elapsed time / context % / tool counts, with a detail modal
- Detail modal: context breakdown, cumulative tokens, cost estimate (per-model pricing), tool counts, and today's activity from `~/.claude/stats-cache.json`
- Per-session scroll position persistence across reloads and app switches
- "Last visit" divider in the message stream: a marker above the first new message since last visit

### Shell Tab Reliability

- WebSocket heartbeat: 30s server ping / 60s pong timeout
- Frontend auto-reconnect with exponential backoff (2s → 30s cap)
- 50KB rolling output buffer replayed on reconnect
- Visual connection-status indicator (green / amber / red dot)

### Performance & First Paint

- Projects list stale-while-revalidate cache in `localStorage` (7-day TTL) — no full-page loading screen on subsequent visits

### Update Notifications

- Removed the auto-update mechanism (it would clobber fork changes)
- Two separate notification badges: upstream (`siteboon/claudecodeui`) and fork (`b31o8321/claudecodeui`) releases; each opens an info modal with manual update instructions

### Branding

- GitHub Star badge and Report Issue link point at the fork
- Removed Discord / community links
- Removed `POST /api/system/update` backend route

### Cleanup

- Removed the TaskMaster feature entirely (~5600 lines removed across 110 files)

---

## Running as a Background Service (Homebrew)

> macOS only. Requires [Homebrew](https://brew.sh) and Node 22+.

### Install

```sh
brew tap b31o8321/cloudcli https://github.com/b31o8321/claudecodeui
brew install --HEAD cloudcli-fork
brew services start cloudcli-fork
```

The service starts automatically on login and restarts itself if it crashes.

### Stop / restart

```sh
brew services stop cloudcli-fork
brew services restart cloudcli-fork
```

### View logs

```sh
tail -f $(brew --prefix)/var/log/cloudcli-fork.log
tail -f $(brew --prefix)/var/log/cloudcli-fork.err.log
```

### Configuration — `~/.cloudcli/config.json`

`brew install` seeds a default config file. Edit it to control network exposure:

```json
{
  "bind": "lan",
  "port": 3001,
  "publicUrl": null
}
```

| Field | Values | Effect |
|---|---|---|
| `bind` | `"localhost"` | Server listens on `127.0.0.1` — only accessible on this machine |
| `bind` | `"lan"` (default) | Server listens on `0.0.0.0` — accessible on your LAN (e.g. from your phone) |
| `port` | integer | Port to listen on (default `3001`) |
| `publicUrl` | string or `null` | Informational only — the UI displays this URL; useful when you run ngrok |

**LAN access from your phone** — use `"bind": "lan"` (the default) and open `http://<your-mac-ip>:3001` in the phone's browser.

**Localhost only (private dev):**
```json
{ "bind": "localhost", "port": 3001, "publicUrl": null }
```

**External access via ngrok** — external access is not built in. Run ngrok separately and set `publicUrl` to the URL it prints:
```sh
ngrok http 3001
# Then update publicUrl in ~/.cloudcli/config.json:
# { "bind": "lan", "port": 3001, "publicUrl": "https://abc123.ngrok-free.app" }
```

After editing the config, restart the service:
```sh
brew services restart cloudcli-fork
```

---

## Roadmap

Planned work for this fork (not tracked upstream):

- Fix the loading state machine behind the "infinite spinner after tool execution" issue
- Mobile-first responsive overhaul: single-column on small screens, safe-area insets, touch targets ≥44px
- Markdown overflow / wrapping fixes for long code blocks
- Dark mode reliability improvements
- Visually distinct message bubbles for user vs. assistant
- Session export to Markdown / JSON
- Keyboard shortcut surface
- PWA / Service Worker for offline use
- Windows path compatibility audit
- Dead code and dependency security audit

---

## Screenshots

<div align="center">
  
<table>
<tr>
<td align="center">
<h3>Desktop View</h3>
<img src="public/screenshots/desktop-main.png" alt="Desktop Interface" width="400">
<br>
<em>Main interface showing project overview and chat</em>
</td>
<td align="center">
<h3>Mobile Experience</h3>
<img src="public/screenshots/mobile-chat.png" alt="Mobile Interface" width="250">
<br>
<em>Responsive mobile design with touch navigation</em>
</td>
</tr>
<tr>
<td align="center" colspan="2">
<h3>CLI Selection</h3>
<img src="public/screenshots/cli-selection.png" alt="CLI Selection" width="400">
<br>
<em>Select between Claude Code, Gemini, Cursor CLI and Codex</em>
</td>
</tr>
</table>



</div>

## Features

- **Responsive Design** - Works seamlessly across desktop, tablet, and mobile so you can also use Agents from mobile 
- **Interactive Chat Interface** - Built-in chat interface for seamless communication with the Agents
- **Integrated Shell Terminal** - Direct access to the Agents CLI through built-in shell functionality
- **File Explorer** - Interactive file tree with syntax highlighting and live editing
- **Git Explorer** - View, stage and commit your changes. You can also switch branches 
- **Session Management** - Resume conversations, manage multiple sessions, and track history
- **Plugin System** - Extend CloudCLI with custom plugins — add new tabs, backend services, and integrations. [Build your own →](https://github.com/cloudcli-ai/cloudcli-plugin-starter)
- **TaskMaster AI Integration** *(Optional)* - Advanced project management with AI-powered task planning, PRD parsing, and workflow automation
- **Model Compatibility** - Works with Claude, GPT, and Gemini model families (see [`shared/modelConstants.js`](shared/modelConstants.js) for the full list of supported models)


## Quick Start

### CloudCLI Cloud (Recommended)

The fastest way to get started — no local setup required. Get a fully managed, containerized development environment accessible from the web, mobile app, API, or your favorite IDE.

**[Get started with CloudCLI Cloud](https://cloudcli.ai)**


### Self-Hosted (Open source)

#### npm

Try CloudCLI UI instantly with **npx** (requires **Node.js** v22+):

```
npx @cloudcli-ai/cloudcli
```

Or install **globally** for regular use:

```
npm install -g @cloudcli-ai/cloudcli
cloudcli
```

Open `http://localhost:3001` — all your existing sessions are discovered automatically.

Visit the **[documentation →](https://cloudcli.ai/docs)** for full configuration options, PM2, remote server setup and more.

#### Docker Sandboxes (Experimental)

Run agents in isolated sandboxes with hypervisor-level isolation. Starts Claude Code by default. Requires the [`sbx` CLI](https://docs.docker.com/ai/sandboxes/get-started/).

```
npx @cloudcli-ai/cloudcli@latest sandbox ~/my-project
```

Supports Claude Code, Codex, and Gemini CLI. See the [sandbox docs](docker/) for setup and advanced options.


---

## Which option is right for you?

CloudCLI UI is the open source UI layer that powers CloudCLI Cloud. You can self-host it on your own machine, run it in a Docker sandbox for isolation, or use CloudCLI Cloud for a fully managed environment.

| | Self-Hosted (npm) | Self-Hosted (Docker Sandbox) *(Experimental)* | CloudCLI Cloud |
|---|---|---|---|
| **Best for** | Local agent sessions on your own machine | Isolated agents with web/mobile IDE | Teams who want agents in the cloud |
| **How you access it** | Browser via `[yourip]:port` | Browser via `localhost:port` | Browser, any IDE, REST API, n8n |
| **Setup** | `npx @cloudcli-ai/cloudcli` | `npx @cloudcli-ai/cloudcli@latest sandbox ~/project` | No setup required |
| **Isolation** | Runs on your host | Hypervisor-level sandbox (microVM) | Full cloud isolation |
| **Machine needs to stay on** | Yes | Yes | No |
| **Mobile access** | Any browser on your network | Any browser on your network | Any device, native app coming |
| **Agents supported** | Claude Code, Cursor CLI, Codex, Gemini CLI | Claude Code, Codex, Gemini CLI | Claude Code, Cursor CLI, Codex, Gemini CLI |
| **File explorer and Git** | Yes | Yes | Yes |
| **MCP configuration** | Synced with `~/.claude` | Managed via UI | Managed via UI |
| **REST API** | Yes | Yes | Yes |
| **Team sharing** | No | No | Yes |
| **Platform cost** | Free, open source | Free, open source | Starts at $7/month |

> All options use your own AI subscriptions (Claude, Cursor, etc.) — CloudCLI provides the environment, not the AI.

---

## Security & Tools Configuration

**🔒 Important Notice**: All Claude Code tools are **disabled by default**. This prevents potentially harmful operations from running automatically.

### Enabling Tools

To use Claude Code's full functionality, you'll need to manually enable tools:

1. **Open Tools Settings** - Click the gear icon in the sidebar
2. **Enable Selectively** - Turn on only the tools you need
3. **Apply Settings** - Your preferences are saved locally

<div align="center">

![Tools Settings Modal](public/screenshots/tools-modal.png)
*Tools Settings interface - enable only what you need*

</div>

**Recommended approach**: Start with basic tools enabled and add more as needed. You can always adjust these settings later.

---

## Plugins

CloudCLI has a plugin system that lets you add custom tabs with their own frontend UI and optional Node.js backend. Install plugins from git repos directly in **Settings > Plugins**, or build your own.

### Available Plugins

| Plugin | Description |
|---|---|
| **[Project Stats](https://github.com/cloudcli-ai/cloudcli-plugin-starter)** | Shows file counts, lines of code, file-type breakdown, largest files, and recently modified files for your current project |
| **[Web Terminal](https://github.com/cloudcli-ai/cloudcli-plugin-terminal)** | Full xterm.js terminal with multi-tab support|
| **[CloudCLI Scheduler](https://github.com/grostim/cloudcli-cron)** | Create workspace-scoped scheduled prompts and execute them through a local CLI such as Codex, Claude Code, or Gemini CLI|
### Build Your Own

**[Plugin Starter Template →](https://github.com/cloudcli-ai/cloudcli-plugin-starter)** — fork this repo to create your own plugin. It includes a working example with frontend rendering, live context updates, and RPC communication to a backend server.

**[Plugin Documentation →](https://cloudcli.ai/docs/plugin-overview)** — full guide to the plugin API, manifest format, security model, and more.

---
## FAQ

<details>
<summary>How is this different from Claude Code Remote Control?</summary>

Claude Code Remote Control lets you send messages to a session already running in your local terminal. Your machine has to stay on, your terminal has to stay open, and sessions time out after roughly 10 minutes without a network connection.

CloudCLI UI and CloudCLI Cloud extend Claude Code rather than sit alongside it — your MCP servers, permissions, settings, and sessions are the exact same ones Claude Code uses natively. Nothing is duplicated or managed separately.

Here's what that means in practice:

- **All your sessions, not just one** — CloudCLI UI auto-discovers every session from your `~/.claude` folder. Remote Control only exposes the single active session to make it available in the Claude mobile app.
- **Your settings are your settings** — MCP servers, tool permissions, and project config you change in CloudCLI UI are written directly to your Claude Code config and take effect immediately, and vice versa.
- **Works with more agents** — Claude Code, Cursor CLI, Codex, and Gemini CLI, not just Claude Code.
- **Full UI, not just a chat window** — file explorer, Git integration, MCP management, and a shell terminal are all built in.
- **CloudCLI Cloud runs in the cloud** — close your laptop, the agent keeps running. No terminal to babysit, no machine to keep awake.

</details>

<details>
<summary>Do I need to pay for an AI subscription separately?</summary>

Yes. CloudCLI provides the environment, not the AI. You bring your own Claude, Cursor, Codex, or Gemini subscription. CloudCLI Cloud starts at $7/month for the hosted environment on top of that.

</details>

<details>
<summary>Can I use CloudCLI UI on my phone?</summary>

Yes. For self-hosted, run the server on your machine and open `[yourip]:port` in any browser on your network. For CloudCLI Cloud, open it from any device — no VPN, no port forwarding, no setup. A native app is also in the works.

</details>

<details>
<summary>Will changes I make in the UI affect my local Claude Code setup?</summary>

Yes, for self-hosted. CloudCLI UI reads from and writes to the same `~/.claude` config that Claude Code uses natively. MCP servers you add via the UI show up in Claude Code immediately and vice versa.

</details>

---

## Community & Support

- **[Documentation](https://cloudcli.ai/docs)** — installation, configuration, features, and troubleshooting
- **[Discord](https://discord.gg/buxwujPNRE)** — get help and connect with other users
- **[GitHub Issues](https://github.com/siteboon/claudecodeui/issues)** — bug reports and feature requests
- **[Contributing Guide](CONTRIBUTING.md)** — how to contribute to the project

## License

GNU Affero General Public License v3.0 or later (AGPL-3.0-or-later) — see [LICENSE](LICENSE) for the full text, including additional terms under Section 7.

This project is open source and free to use, modify, and distribute under the AGPL-3.0-or-later license. If you modify this software and run it as a network service, you must make your modified source code available to users of that service.

CloudCLI UI  - (https://cloudcli.ai).

## Acknowledgments

### Built With
- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** - Anthropic's official CLI
- **[Cursor CLI](https://docs.cursor.com/en/cli/overview)** - Cursor's official CLI
- **[Codex](https://developers.openai.com/codex)** - OpenAI Codex
- **[Gemini-CLI](https://geminicli.com/)** - Google Gemini CLI
- **[React](https://react.dev/)** - User interface library
- **[Vite](https://vitejs.dev/)** - Fast build tool and dev server
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[CodeMirror](https://codemirror.net/)** - Advanced code editor
- **[TaskMaster AI](https://github.com/eyaltoledano/claude-task-master)** *(Optional)* - AI-powered project management and task planning


### Sponsors
- [Siteboon - AI powered website builder](https://siteboon.ai)
---

<div align="center">
  <strong>Made with care for the Claude Code, Cursor and Codex community.</strong>
</div>
