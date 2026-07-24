---
name: extensibility
description: >
  Extensibility seams in Buzz: the preview-features flag system, how new UI
  surfaces/routes are added, the kind→component dispatch points, and the
  design path for a user-registerable component system (rim-style component
  registration). Load when adding surfaces, gating features, or designing
  plugin/renderer registries.
version: 1
---

# Extensibility & Component Registration

**In one line:** Buzz has no user-facing plugin system today — extensibility is "new nostr kind integer + hard-wired renderer"; the seams below are where a registry would attach.

## What exists today

### 1. Preview-features manifest (the closest thing to a registry)

- Source: `preview-features.json` (repo root) — entries with `id`, `name`, `description`, `platforms`. Bundled via Vite alias `@features-manifest` (`desktop/vite.config.ts`).
- Load + Zod validation (fail-closed to empty): `desktop/src/shared/features/manifest.ts`.
- Resolution: `shared/features/resolveEnabled.ts` — `overrides[id] ?? defaultEnabled`. **Semantics: in-manifest = gated; not-in-manifest = stable, renders unconditionally (fail-open).**
- Overrides in localStorage, keyed by manifest version (`shared/features/store.ts`); reactive via `useSyncExternalStore` (`useFeatureEnabled.ts`); gate component `FeatureGate.tsx`; route guard `usePreviewFeatureWarning`; user toggle UI in Settings → Experiments (`features/settings/ui/ExperimentalFeaturesCard.tsx`).

The manifest registers *metadata only* — components stay hard-wired in TSX, and the JSON is bundled, not user-supplied.

### 2. Adding a new UI surface (4 hand-edited places)

1. Route file in `desktop/src/app/routes/` (TanStack file-based routing; tree generated into `app/routeTree.gen.ts`).
2. Gate: `usePreviewFeatureWarning("<id>")` at the top of the route component (see `routes/pulse.tsx`, `routes/projects.tsx`).
3. Sidebar entry wrapped in `<FeatureGate>`: `features/sidebar/ui/AppSidebarPinnedHeader.tsx` (Pulse/Projects/Workflows) or `AppSidebar.tsx` (Forum).
4. Feature id in `preview-features.json`. Module convention: `desktop/src/features/<name>/{ui,lib,hooks,data}`.

### 3. The dispatch seams (where a registry would attach)

- **Kind → renderer switch (the strongest seam):** `desktop/src/features/messages/ui/MessageRow.tsx` ~:305 — `renderBody()` is a `switch (message.kind)`: diff → `DiffMessage`, huddle → `HuddleAttachment`, default → content-sniff → `Markdown`. Replacing this with a `Map<number, MessageRenderer>` lookup is the single highest-leverage change.
- **Markdown component map + plugin arrays:** `shared/ui/markdown.tsx` (`createMarkdownComponents`) and `shared/ui/markdown/nodeCache.ts` — already a plugin architecture, just closed. See the `message-rendering` skill.
- **Content resolvers (closed unions, natural registry targets):** link previews `shared/lib/linkPreview.ts` (`SupportedLinkPreviewKind` union), file/snapshot cards `resolveFileCard`/`resolveSnapshotCard` (`shared/ui/markdown/markdownFileCard.tsx`), config-nudge cards (`computeConfigNudge`).
- **Backend contract:** `crates/buzz-core/src/kind.rs` + mirror `desktop/src/shared/constants/kinds.ts`. VISION.md is explicit: "New message type? New kind integer." Prefer events over new HTTP endpoints (AGENTS.md).

### 4. Agent surface (extends behavior, not UI)

ACP (`buzz-acp`, `buzz-agent`, `sprig`) and MCP (`buzz-dev-mcp`) are protocol-based extension points. Personas/teams/managed agents (kinds 30175/30176/30177, `crates/buzz-persona`) are the nearest existing "user registers a thing the system runs" pattern — data registrations, not components. `buzz-workflow` is user-authored automation logic.

No VISION doc plans a user-registerable renderer/widget system; the developer portal is 📋 (planned, unbuilt). This is greenfield.

## Implemented in hyperbuzz (branch hyper/five-features)

Step 1–2 of the design path below now exist: `desktop/src/features/messages/lib/messageKindRenderers.tsx` is the kind→renderer registry (`registerMessageKindRenderer` / `getMessageKindRenderer`); `MessageRow.renderBody()` does a registry lookup with the markdown fallback. Diff (40008) and huddle (48100) renderers are the first registrants. Feature-gating and user-supplied manifests remain future work.

## Design path: rim-style component registration

1. **Registry module** — e.g. `desktop/src/shared/renderers/registry.ts`: `Map<number, { component, gate?: featureId }>`, shaped like `shared/features/manifest.ts`.
2. **Replace the switch** in `MessageRow.tsx` `renderBody()` with a registry lookup, falling back to `Markdown`.
3. **Gate through the existing feature manifest** (`FeatureGate`/`useFeatureEnabled`) so registered renderers are toggleable and fail-closed.
4. **Generalize the content resolvers** into an ordered `registerContentRenderer(predicate, Component)` list; optionally open the remark/rehype arrays in `nodeCache.ts` as a registry (bump `MARKDOWN_COMPONENT_SCHEMA_VERSION` when doing so).
5. **For genuinely user-contributed components** the missing pieces are a sandbox/loader (no dynamic import or custom-element use exists in the client today) and a manifest transport — most nostr-native: a new event kind carrying a widget/renderer manifest, gated per-community.

Anchor files: `MessageRow.tsx` ~:305, `crates/buzz-core/src/kind.rs`, `shared/features/manifest.ts` + `preview-features.json`, `shared/ui/markdown/nodeCache.ts`, `shared/ui/markdown.tsx` (`createMarkdownComponents`).
