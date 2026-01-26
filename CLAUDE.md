# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Also read `AGENTS.md` for additional contributor and agent-specific guidelines (PR workflow, release channels, multi-agent safety, VM ops, npm publishing).

## What Is Clawdbot

Self-hosted AI assistant platform that connects Claude (or other LLMs) across messaging platforms (WhatsApp, Telegram, Slack, Discord, Signal, iMessage, Google Chat, MS Teams, Matrix, LINE, and more). A WebSocket **Gateway** on port 18789 acts as the control plane, coordinating channels, agents, sessions, tools, hooks, and plugins.

## Build & Development Commands

| Task | Command |
|------|---------|
| Install deps | `pnpm install` |
| Build (tsc) | `pnpm build` |
| Lint | `pnpm lint` (oxlint) |
| Format check | `pnpm format` (oxfmt) |
| Fix lint+format | `pnpm lint:fix` |
| Run all tests | `pnpm test` |
| Run single test | `vitest run src/path/to/file.test.ts` |
| Run tests matching pattern | `vitest run -t "pattern"` |
| Watch mode | `pnpm test:watch` |
| Coverage | `pnpm test:coverage` |
| E2E tests | `pnpm test:e2e` |
| Live tests (real keys) | `CLAWDBOT_LIVE_TEST=1 pnpm test:live` |
| Full gate | `pnpm lint && pnpm build && pnpm test` |
| Run CLI (dev) | `pnpm clawdbot ...` or `pnpm dev` |
| Gateway dev (no channels) | `pnpm gateway:dev` |
| UI dev server | `pnpm ui:dev` |
| Swift lint | `pnpm lint:swift` |
| Swift format check | `pnpm format:swift` |
| Mac app package | `bash scripts/package-mac-app.sh` |
| iOS build | `pnpm ios:build` |
| Android build | `pnpm android:assemble` |
| Pre-commit hooks | `prek install` |
| Docs dev (Mintlify) | `pnpm docs:dev` |
| Protocol codegen | `pnpm protocol:gen && pnpm protocol:gen:swift` |

- **Runtime:** Node ≥ 22. Bun preferred for TypeScript execution (scripts, dev, tests); Node for production `dist/`.
- **Package manager:** pnpm (keep `pnpm-lock.yaml` in sync). Bun also supported.
- **Test framework:** Vitest with V8 coverage (70% thresholds). Tests colocated as `*.test.ts`; e2e as `*.e2e.test.ts`; live as `*.live.test.ts`.
- **Commits:** Use `scripts/committer "<msg>" <file...>` instead of manual `git add`/`git commit`.

## Architecture

### Core Data Flow

```
Inbound message (channel) → Gateway → Route to Agent → AI reply → Channel outbound
```

1. **Channel** receives message (WebSocket/polling) → Gateway `chat.send`
2. **Routing** (`src/routing/`) resolves agent + session key via config bindings (peer → guild → team → account → default)
3. **Agent** (`src/agents/`) processes with configured LLM model, tools, and system prompt
4. **Reply Dispatcher** streams response back through channel with typing indicators, chunking, threading

### Key Subsystems

| Directory | Role |
|-----------|------|
| `src/gateway/` | WebSocket server, session lifecycle, RPC request handlers (`server-methods/`) |
| `src/channels/` | Channel abstraction — `ChannelDock` (capabilities/config metadata) + `ChannelPlugin` (full implementation) |
| `src/routing/` | Message→agent routing. Session key format: `agent:{id}:[channel:][(dm\|group\|channel):{peer}][thread:{id}]` |
| `src/agents/` | Agent scoping, config resolution, tools, session keys |
| `src/auto-reply/` | Message processing pipeline, reply generation, dispatching |
| `src/plugins/` | Plugin registry (tools, hooks, channels, providers, CLI commands, HTTP routes, gateway methods) |
| `src/plugin-sdk/` | Public API for extension development (`clawdbot/plugin-sdk`) |
| `src/config/` | YAML config parsing, Zod validation, env-var substitution, migration |
| `src/cli/` | Commander-based CLI wiring, pre-action hooks |
| `src/commands/` | CLI command implementations |
| `src/providers/` | LLM provider abstractions (Anthropic, OpenAI, Bedrock) |
| `src/hooks/` | Event-driven hook system (`command:new`, `session:start`, `message:received`, etc.) |
| `src/media/` | Media pipeline (image/audio/video processing) |
| `src/sessions/` | Session persistence, history, compaction |
| `src/terminal/` | CLI output — `palette.ts` (shared colors), `table.ts` (ANSI-safe tables) |
| `src/infra/` | Events, diagnostics, heartbeat, Tailscale |
| `src/acp/` | Agent Client Protocol bridge (stdio NDJSON for IDE integration) |

### Workspace Layout

- **Monorepo** (pnpm workspaces): root `src/` + `ui/` + `extensions/*`
- **Extensions** (`extensions/`): Channel plugins and feature plugins as workspace packages. Plugin-only deps go in the extension's `package.json`, not root.
- **Apps** (`apps/`): Native companion apps — `macos/` (SwiftUI menu bar), `ios/` (SwiftUI), `android/` (Kotlin)
- **Skills** (`skills/`): Bundled agent skills (markdown files + metadata)
- **UI** (`ui/`): Web control UI (Lit + Vite, built with rolldown)
- **Docs** (`docs/`): Mintlify docs site (docs.clawd.bot). Internal links: root-relative, no `.md` extension.

### Key Patterns

- **Dependency injection:** `createDefaultDeps()` provides logger, config, runtime to subsystems.
- **Plugin composability:** Base channels defined in `DOCKS` constant; plugins register additional channels, tools, hooks via `ClawdbotPluginApi`. Plugin deps: keep `clawdbot` in `devDependencies`/`peerDependencies` (not `dependencies`).
- **Multi-agent:** Multiple agents coexist with independent routing, sessions, and tool policies. Config-driven via `agents.list`.
- **Tool schemas:** No `Type.Union` / `anyOf` / `oneOf` / `allOf`. Use `stringEnum`/`optionalStringEnum` for string lists. Avoid raw `format` property name.

## Coding Conventions

- **TypeScript ESM** with strict typing; avoid `any`.
- **Formatting/linting:** oxlint + oxfmt. Run `pnpm lint` before commits.
- Files under ~500 LOC preferred; split when it improves clarity.
- CLI progress: use `src/cli/progress.ts` (never hand-roll spinners).
- Status tables: use `src/terminal/table.ts`; colors from `src/terminal/palette.ts`.
- Naming: **Clawdbot** for product/docs headings; `clawdbot` for CLI/package/paths/config.
- SwiftUI: prefer `Observation` framework (`@Observable`) over `ObservableObject`.
- Never update the Carbon dependency. Patched deps (`pnpm.patchedDependencies`) must use exact versions (no `^`/`~`).

## Version Locations

When bumping versions, update all of: `package.json`, `apps/android/app/build.gradle.kts`, `apps/ios/Sources/Info.plist`, `apps/macos/Sources/Clawdbot/Resources/Info.plist`, `docs/install/updating.md`, `docs/platforms/mac/release.md`.

## Channel Development

When adding/modifying channels: update all UI surfaces (macOS app, web UI, mobile), onboarding/overview docs, status + config forms, and check `.github/labeler.yml` for label coverage. Consider all built-in + extension channels when refactoring shared logic.

Core channels: `src/telegram`, `src/discord`, `src/slack`, `src/signal`, `src/imessage`, `src/web`, `src/channels`
Extension channels: `extensions/*` (msteams, matrix, zalo, voice-call, etc.)
