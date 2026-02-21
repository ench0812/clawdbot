# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

OpenClaw is a multi-channel personal AI assistant gateway. It connects messaging channels (WhatsApp, Telegram, Slack, Discord, Google Chat, Signal, iMessage, Microsoft Teams, Matrix, etc.) to AI models via a local-first WebSocket gateway control plane. The product is the assistant — the gateway is the control plane.

- Repo: https://github.com/openclaw/openclaw
- Docs: https://docs.openclaw.ai (Mintlify)
- Runtime: Node 22+ (keep both Node and Bun paths working)
- Package manager: pnpm 10+ (monorepo with workspaces)
- Language: TypeScript (ESM, strict mode). Prefer strict typing; avoid `any`.

## Build, Test, and Development Commands

```bash
# Install dependencies
pnpm install

# Build (TypeScript + plugin SDK + UI + artifacts)
pnpm build

# Type-check only (fast, uses tsgo)
pnpm tsgo

# Lint + format + type-check
pnpm check

# Format (oxfmt)
pnpm format           # write
pnpm format:check     # check only

# Lint (oxlint, type-aware)
pnpm lint
pnpm lint:fix         # auto-fix + format

# Run all tests (parallel orchestrator: unit + extensions + gateway)
pnpm test

# Run unit tests only (fast, excludes gateway/extensions)
pnpm test:fast

# Run a single test file
pnpm test:fast -- src/path/to/file.test.ts

# Run tests matching a pattern
pnpm test:fast -- --grep "pattern"

# Watch mode
pnpm test:watch

# Coverage (V8, thresholds: 70% lines/functions/statements, 55% branches)
pnpm test:coverage

# E2E tests
pnpm test:e2e

# Live tests (require real API keys)
OPENCLAW_LIVE_TEST=1 pnpm test:live

# Run CLI in dev mode (TypeScript directly via tsx)
pnpm openclaw ...
pnpm dev

# Gateway dev mode (auto-reload)
pnpm gateway:watch

# UI dev server
pnpm ui:dev

# Commit changes (use the project's committer script)
scripts/committer "commit message" file1 file2 ...
```

## Architecture

### Monorepo Workspace Layout

```
.                    # Root package (CLI + gateway + core)
ui/                  # Web control UI (Lit web components + Vite)
packages/            # Compat shims (clawdbot, moltbot)
extensions/          # Channel/feature plugins (37 workspace packages)
apps/                # Native apps
  ios/               #   Swift + XcodeGen
  android/           #   Kotlin + Gradle
  macos/             #   Swift Package Manager (menu bar app)
skills/              # Agent skill definitions (SKILL.md files)
scripts/             # Build, test, release, packaging scripts
docs/                # Mintlify documentation
```

### Core Source (`src/`) — Key Modules

**Entry points:**
- `entry.ts` — CLI bootstrap (env loading, Commander program)
- `index.ts` — Public API exports
- `runtime.ts` — Runtime abstraction (IO, logging, exit)

**Gateway & control plane (`gateway/`):**
- WebSocket server routing messages between channels, agents, and clients
- HTTP server with Express for webhooks, Control UI, plugin routes
- Server methods (RPC handlers) for auth, chat, channels, cron, sessions, nodes, plugins

**Channel system (`channels/`, `discord/`, `telegram/`, `slack/`, `signal/`, `imessage/`, `web/`, `whatsapp/`, `line/`):**
- Adapter pattern: each channel implements the `ChannelPlugin` contract
- Channel dock (`channels/dock.ts`) — central registry for all channel adapters
- Inbound flow: channel monitor -> envelope creation -> auto-reply engine -> agent
- Outbound flow: agent result -> reply chunking (per-channel limits) -> channel send adapter

**Agent/AI system (`agents/`):**
- Pi embedded runtime for agent execution (RPC mode with tool/block streaming)
- Auth profiles with OAuth2 token management and model fallover
- Tool implementations: bash, browser, canvas, nodes, cron, memory, media, skills
- Tool schemas use Typebox (`@sinclair/typebox`)

**Auto-reply system (`auto-reply/`):**
- Message processing pipeline: inbound debounce -> command parsing -> agent routing -> chunked reply
- Inline directives for model selection, reasoning level, verbose mode
- Reply envelope wraps message metadata (sender, channel, session key, media)

**Plugin system (`plugin-sdk/`, `plugins/`):**
- SDK exported as `openclaw/plugin-sdk` for extension authors
- Plugin discovery via `openclaw.plugin.json` manifests in extensions
- Hook-based extensibility (before-agent-start, model-override, etc.)
- Plugins install with `npm install --omit=dev` in their directory; keep runtime deps in `dependencies`
- Avoid `workspace:*` in plugin `dependencies` (breaks npm install)

**Configuration (`config/`):**
- JSON5 config at `~/.openclaw/openclaw.json`
- Zod validation schemas for all subsystems
- Multi-level: gateway settings, agent defaults, channel configs, tool policies, hooks

**CLI (`cli/`, `commands/`):**
- Commander.js program with subcommands: gateway, agent, send, config, plugins, nodes, browser, hooks, memory, models, skills, cron, completion
- Dependency injection via `createDefaultDeps`

**Infrastructure (`infra/`):**
- Network security (SSRF guards, fetch guards, private IP detection)
- Device pairing, diagnostics, heartbeats, update checks
- TLS setup, port management

### Extension Architecture

Extensions live under `extensions/*` as separate workspace packages. Each has:
- `openclaw.plugin.json` — plugin manifest (ID, channels, config schema)
- `index.ts` — entry point
- `src/` — implementation
- Own `package.json` with deps scoped to that extension

Keep plugin-only deps in the extension `package.json`; do not add them to root unless core uses them.

### Test Architecture

- Framework: Vitest with V8 coverage
- Test files: colocated `*.test.ts` next to source
- E2E tests: `*.e2e.test.ts`; live tests: `*.live.test.ts`
- Parallel test runner (`scripts/test-parallel.mjs`) orchestrates 4 suites: unit-fast (vmForks), unit-isolated (forks), extensions, gateway
- Test setup (`test/setup.ts`): isolates HOME directory, creates stub plugin registry, manages env cleanup
- Heavy test files run in isolated forks to avoid bottlenecking

### Build System

- `tsdown` bundles `src/` to `dist/` (multiple entry points: index, entry, plugin-sdk, hooks, extensionAPI)
- `rolldown` bundles the web control UI
- `tsc` generates plugin SDK `.d.ts` files
- Build includes artifact copy steps (A2UI bundle, hook metadata, HTML templates, build info)

## Coding Conventions

- Formatting/linting: Oxfmt (2-space indent) + Oxlint (type-aware). Run `pnpm check` before commits.
- Never add `@ts-nocheck`; never disable `no-explicit-any`. Fix root causes.
- Never share class behavior via prototype mutation. Use explicit inheritance/composition.
- Keep files under ~500 LOC; split/refactor when it improves clarity.
- Add brief comments for tricky or non-obvious logic.
- Naming: **OpenClaw** for product/docs headings; `openclaw` for CLI/package/paths/config.
- Use the shared CLI palette in `src/terminal/palette.ts` (no hardcoded colors).
- CLI progress: use `src/cli/progress.ts` (`osc-progress` + `@clack/prompts` spinner).
- Status output: use `src/terminal/table.ts` for tables + ANSI-safe wrapping.
- Tool schemas: avoid `Type.Union` in tool input schemas (no `anyOf`/`oneOf`/`allOf`). Use `stringEnum`/`optionalStringEnum` for string lists. Keep top-level schema as `type: "object"` with `properties`.
- Control UI uses Lit with **legacy** decorators (`@state()`, `@property()`). Root tsconfig has `experimentalDecorators: true` + `useDefineForClassFields: false`.

## Commit and PR Guidelines

- Create commits with `scripts/committer "<msg>" <file...>` to keep staging scoped.
- Concise, action-oriented messages (e.g., `CLI: add verbose flag to send`).
- Group related changes; avoid bundling unrelated refactors.
- One PR = one issue/topic. PRs over ~5,000 changed lines reviewed only exceptionally.
- Full maintainer PR workflow: `.agents/skills/PR_WORKFLOW.md`

## Channel Development

When adding or refactoring channels, always consider **all** built-in + extension channels (routing, allowlists, pairing, command gating, onboarding, docs). Channel docs: `docs/channels/`. When adding channels/extensions, update `.github/labeler.yml` and create matching GitHub labels.

## Docs (Mintlify)

- Internal doc links: root-relative, no `.md`/`.mdx` (e.g., `[Config](/configuration)`).
- Section cross-references use anchors: `[Hooks](/configuration#hooks)`.
- Avoid em dashes and apostrophes in headings (breaks Mintlify anchors).
- README uses absolute URLs (`https://docs.openclaw.ai/...`) so links work on GitHub.
- `docs/zh-CN/**` is generated; do not edit unless explicitly asked.

## Dependencies

- Never update the Carbon dependency.
- Any dependency with `pnpm.patchedDependencies` must use an exact version (no `^`/`~`).
- Patching dependencies (pnpm patches, overrides, or vendored changes) requires explicit approval.

## Version Locations

When bumping versions, update: `package.json` (CLI), `apps/android/app/build.gradle.kts`, `apps/ios/Sources/Info.plist` + `apps/ios/Tests/Info.plist`, `apps/macos/Sources/OpenClaw/Resources/Info.plist`, `docs/install/updating.md`, `docs/platforms/mac/release.md`. Do **not** touch `appcast.xml` unless cutting a macOS Sparkle release.

## Key Environment Variables

- `OPENCLAW_LIVE_TEST=1` / `LIVE=1` — enable live integration tests
- `OPENCLAW_TEST_PROFILE=serial|low|normal|max` — test parallelism profile
- `OPENCLAW_TEST_WORKERS=N` — override test worker count
- `OPENCLAW_TEST_VM_FORKS=0|1` — disable/force vmForks in tests
- `OPENCLAW_SKIP_CHANNELS=1` — skip channel init in gateway dev mode
