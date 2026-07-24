---
name: buzz-architecture
description: >
  Orientation map of the Buzz codebase: crate roles, runtime topology
  (relay/Postgres/Redis), the nostr event-kind model, frontend stacks, and
  entry points. Load first when planning any change to Buzz, to find which
  crate/app owns the behavior you want to touch.
version: 1
---

# Buzz Architecture Map

**In one line:** everything is a signed nostr event dispatched by `kind` integer; the relay (`buzz-relay`) is the single source of truth; the *desktop* app is the real chat client.

## The one fact that prevents wrong turns

The chat UI lives in **`desktop/`** (Tauri 2 + React 19), NOT `web/`. `web/` is only a repo browser + invite pages, served statically by the relay. `mobile/` is an independent Flutter reimplementation. `admin-web/` is a minimal operator UI.

## Runtime topology (production)

- **buzz-relay** (Axum, `crates/buzz-relay/src/main.rs`) — the one server: nostr WebSocket, HTTP bridge (`/events`, `/query`), git smart-HTTP, huddle audio, media, static file serving of web + admin-web (`crates/buzz-relay/src/router.rs`).
- **Postgres 17** — primary store: events (monthly-partitioned), channels, members, workflows, audit, FTS. Owned by `buzz-db`; migrations in `migrations/` auto-apply on startup (`BUZZ_AUTO_MIGRATE`). Fresh-DB source of truth: `schema/schema.sql` (multi-tenant, `community_id` first-class).
- **Redis 7** — pub/sub fan-out (`buzz:channel:{uuid}`), presence, typing. Owned by `buzz-pubsub`.
- Optional: `buzz-push-gateway` (APNs), `buzz-acp`/`sprig` (agent harness), `buzz-relay-mesh` (QUIC inter-relay), MinIO/S3 (media).

Clients connect over WebSocket, NIP-42 AUTH required before EVENT/REQ. Community resolved from Host header (`tenant.rs`).

## Crate map (crates/, 26 crates)

Dependency root is `buzz-core` (zero I/O — no tokio/sqlx/axum allowed).

| Crate | Role |
|---|---|
| `buzz-core` | Types, `verify_event`, filter matching, **kind registry (`src/kind.rs`)** |
| `buzz-relay` | The server; orchestrates everything. Handlers in `src/handlers/`, HTTP API in `src/api/` |
| `buzz-db` | Postgres store, runtime sqlx (no offline cache) |
| `buzz-auth` | NIP-42/NIP-98, API tokens, scopes (rate-limit traits are stubs) |
| `buzz-pubsub` | Redis fan-out, presence, typing |
| `buzz-search` | Postgres FTS (`events.search_tsv`) |
| `buzz-audit` | SHA-256 hash-chain audit log |
| `buzz-media` | Blossom/S3 media (handlers live in relay) |
| `buzz-workflow` | YAML automation, `evalexpr` conditions |
| `buzz-acp`, `buzz-agent`, `buzz-dev-mcp`, `buzz-persona`, `sprig` | Agent surface (ACP/MCP bridges, persona packs) |
| `buzz-cli` | Agent-first CLI (binary `buzz`) — new agent features land here first |
| `buzz-sdk` | Typed nostr event builders |
| `buzz-admin` | Operator CLI |
| `buzz-ws-client`, `buzz-test-client` | Shared WS client; e2e harness (134 tests) |
| `buzz-pair-relay`, `buzz-pairing-cli` | NIP-AB device pairing |
| `buzz-relay-mesh`, `buzz-push-gateway`, `buzz-conformance` | QUIC mesh; APNs; TLA+ trace replay |
| `git-sign-nostr`, `git-credential-nostr` | Git signing/credentials with nostr keys |

## Event-kind model

- Canonical registry: `crates/buzz-core/src/kind.rs` (~120 `KIND_*` consts; `ALL_KINDS` near line 490).
- **Hand-kept mirrors** (must stay in sync): `desktop/src/shared/constants/kinds.ts` and `mobile/lib/shared/relay/nostr_models.dart`.
- Ranges: 0–9999 standard, 10000–19999 replaceable, 20000–29999 ephemeral (never stored), 30000–39999 param-replaceable, 40000+ Buzz custom.
- Notable: chat `9`/`40002` (+edit `40003`), reactions `7`, NIP-29 groups `39000–39003`/ops `9000–9022`, forum `45001–45003`, DMs `1059`/`41010`, workflows `30620`/`46001+`, presence/typing `20001`/`20002` (ephemeral), agent kinds `10100`/`30174–30177`.
- Extension philosophy (VISION.md): new capability = new kind integer. Prefer nostr events over new HTTP endpoints.

## Message lifecycle (publish → seen)

1. Client sends `["EVENT", …]` over WS (or `POST /events` — same ingest).
2. `handle_event()` at `crates/buzz-relay/src/handlers/event.rs:585`: AUTH → pubkey match → ephemeral shortcut → `verify_event` → channel membership check → `db.insert_event` → Redis publish → local fan-out → search/audit/workflow (spawned).
3. Fan-out via three-tier DashMap index in `crates/buzz-relay/src/subscription.rs`; channel-scoped events never reach global subs (security boundary).
4. Cross-node via Redis PSUBSCRIBE; local echo deduped through `AppState.local_event_ids`.

## Frontend stacks

- Desktop: Tauri 2 + React 19 + Vite + TanStack Router/Query + Tailwind + Radix + TipTap + Virtua. Root: `desktop/src/main.tsx` → `app/App.tsx` (community-key remount boundary) → `app/router.tsx`. Rust side: `desktop/src-tauri/src/`.
- No shared npm package between desktop/web/admin-web — conventions are duplicated, not imported. State = React Query cache + module singletons (reset in `features/communities/useCommunityInit.ts`).
- Mobile: Flutter, Riverpod + hooks, `HookConsumerWidget` only.

## Docs reality check

`AGENTS.md` (== `CLAUDE.md`) is current. `ARCHITECTURE.md` is detailed but predates ~12 crates and still frames single-community as default (multi-tenant is now first-class). Known gaps that remain true: no rate-limiter implementation, no sqlx offline cache, some workflow actions stubbed.

## Sibling skills

- `chat-stream` — the live-update path (subscriptions → stores → timeline).
- `message-rendering` — markdown pipeline, code blocks, mermaid/MDX analysis.
- `extensibility` — feature flags, renderer dispatch seams, component registration.
