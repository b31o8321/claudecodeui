# Cloud CLI — Personal Fork

A self-hosted web UI for Claude Code, customized for single-user use.

---

## Fork Notice

This is a fork of [siteboon/claudecodeui](https://github.com/siteboon/claudecodeui), branched at upstream **v1.32.0**.

Maintained personally by [b31o8321](https://github.com/b31o8321) for day-to-day use. Not a general-purpose distribution — changes are opinionated and may not suit other workflows.

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

## What This Fork Adds / Changes

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

### Cleanup

- Removed the TaskMaster feature entirely (~5600 lines removed across 110 files)
- Removed Discord / community links and `POST /api/system/update` backend route
- GitHub Star badge and Report Issue link point at the fork

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

## Installation & Running

### Option A: Run as Background Service (Homebrew)

> macOS only. Requires [Homebrew](https://brew.sh) and Node 22+.

```sh
brew tap b31o8321/cloudcli https://github.com/b31o8321/claudecodeui
brew install --HEAD cloudcli-fork
brew services start cloudcli-fork
```

The service starts automatically on login and restarts itself if it crashes.

**Stop / restart:**
```sh
brew services stop cloudcli-fork
brew services restart cloudcli-fork
```

**View logs:**
```sh
tail -f $(brew --prefix)/var/log/cloudcli-fork.log
tail -f $(brew --prefix)/var/log/cloudcli-fork.err.log
```

### Option B: Run from Source (Development)

```sh
git clone https://github.com/b31o8321/claudecodeui.git
cd claudecodeui
npm install
npm run dev
```

Open `http://localhost:3001`.

---

## Configuration — `~/.cloudcli/config.json`

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
| `bind` | `"localhost"` | Listens on `127.0.0.1` — only accessible on this machine |
| `bind` | `"lan"` (default) | Listens on `0.0.0.0` — accessible on your LAN (e.g. from your phone) |
| `port` | integer | Port to listen on (default `3001`) |
| `publicUrl` | string or `null` | Informational only — the UI displays this URL; useful when you run ngrok |

**External access via ngrok** — not built in. Run ngrok separately and set `publicUrl` to the URL it prints:
```sh
ngrok http 3001
# Then update ~/.cloudcli/config.json:
# { "bind": "lan", "port": 3001, "publicUrl": "https://abc123.ngrok-free.app" }
```

After editing, restart the service: `brew services restart cloudcli-fork`

---

## License & Credits

License: AGPL-3.0-or-later — see [LICENSE](LICENSE).

Built on top of [siteboon/claudecodeui](https://github.com/siteboon/claudecodeui) by Robin Münch and contributors.

This fork maintained by [b31o8321](https://github.com/b31o8321) for personal use.
