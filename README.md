# ABSOLUTE-CINEMA

**PRIVATE CINEMA. PERFECT SYNCHRONIZATION.**

A Windows desktop application for exactly two people to watch the same movie on
two independent computers, on one shared timeline. Media stays local (or is
streamed source-direct); the server only coordinates rooms, time, chat and
WebRTC signaling.

## Status

**Sprint 0 — Media proof of concept (complete on the build machine).**

The architecture and implementation plan are complete. The desktop shell, mpv
IPC integration and Media Lab are implemented and exercised on Windows. The
evidence, including the honest 4K/8K limitations, is in
[`artifacts/sprint0-report.md`](artifacts/sprint0-report.md). Next is Sprint 1:
the final UI and design system, then rooms and synchronization.

## Stack baseline

| Layer | Choice |
|---|---|
| Desktop | Tauri 2 + React 19 + TypeScript + Vite |
| Native | Rust (stable-msvc) |
| Media | mpv 0.42+ over JSON IPC (named pipe) |
| UI | Tailwind CSS 4, Motion, AMOLED black tokens |
| Server | Node.js 22+ + Fastify 5 |
| Realtime | WebSocket (server-authoritative timeline) |
| Voice | WebRTC P2P + coturn |
| Data | PostgreSQL 18 |
| Deploy | Docker Compose + Caddy on Ubuntu 24.04 LTS |

## Documentation

- [Design brief](docs/superpowers/specs/2026-11-14-absolute-cinema-design.md)
- [Implementation plan](docs/plans/2026-11-14-absolute-cinema-implementation-plan.md)
- [Architecture](docs/architecture.md)
- [Sync + wire protocol](docs/protocol.md)
- [Security and privacy](docs/security.md)
- [Deployment](docs/deployment.md)
- [Open-source review](docs/repo-review.md)

## Repository layout

```text
apps/desktop/        Tauri 2 + React desktop client
packages/protocol/   Shared Zod schemas and TypeScript types
services/api/        Fastify API + WebSocket coordinator
infra/               Docker Compose, Caddy, coturn
docs/                Design, plan, architecture, protocol, security
```

## Development prerequisites (Windows)

- Node.js 22+ and pnpm 12+
- Rust stable MSVC (`rustup default stable-msvc`)
- Visual Studio 2022 Build Tools with the C++ workload + Windows SDK
- WebView2 runtime (included with Windows 11)
- mpv 0.42+ (installed separately during the MVP)
- Docker Desktop (only for the backend)

Verified local versions are recorded in
[`docs/deployment.md`](docs/deployment.md#windows-development-environment).

## Commands

```powershell
pnpm install
pnpm dev            # Tauri dev window
pnpm web            # browser-only UI (no native mpv bridge)
pnpm build          # Windows installer
pnpm typecheck

# Sprint 0 engine evidence (needs mpv + generated test-media)
cargo test --manifest-path apps/desktop/src-tauri/Cargo.toml `
  --test mpv_smoke -- --ignored --nocapture --test-threads=1
```
