---
name: chat-stream
description: >
  The live chat-stream update path in the desktop client: nostr subscriptions
  over Tauri IPC, the channel-window store (dedup/ordering/live overlay),
  React Query projection, Virtua-virtualized timeline, and optimistic sends.
  Load when changing how messages arrive, merge, order, or render live.
version: 1
---

# Chat Stream: the live-update path

**In one line:** two hooks and one store own the stream — `useChannelSubscription` (`desktop/src/features/messages/hooks.ts`), `ChannelWindowStore` (`desktop/src/features/messages/lib/channelWindowStore.ts`), and `useLiveChannelUpdates` (`desktop/src/features/channels/useLiveChannelUpdates.ts`).

Scope note: this is all `desktop/`. Mobile (Flutter) is an independent implementation sharing only the kind constants; `web/` has no chat surface.

## The golden invariant

`channel-window` (a `ChannelWindowStore`) is the **source of truth**; `channel-messages` (a flat sorted `RelayEvent[]`) is a projection of it. Every live merge re-flattens the store over the array — **any mutation applied only to the flattened array is silently reverted**. Always write the window store first, then project. (Documented at `channelWindowStore.ts:224-238`; see `useEditMessageMutation` for the pattern.)

## 1. Subscription layer

The relay WebSocket lives in the Tauri Rust backend (`tauri-plugin-websocket`); JS speaks nostr wire (`REQ`/`EVENT`/`AUTH`) over IPC.

- Singleton: `desktop/src/shared/api/relayClient.ts` (`relayClient`).
- Real client: `desktop/src/shared/api/relayClientSession.ts`:
  - `subscribe()` (~:610) — sub-id allocation, `["REQ", …]` via `sendRaw()` → `invoke("plugin:websocket|send")`. Single choke point for all subscriptions.
  - `subscribeToChannelLive()` (~:370) — the visible timeline: `kinds: [...CHANNEL_EVENT_KINDS, KIND_CHANNEL_THREAD_SUMMARY]`, `"#h": [channelId]`, `since: now`.
  - `subscribeLive()` / `subscribeToChannelMentionEvents()` — app-shell-wide unread/mention tracking.
  - `subscribeToReconnects()` — post-drop re-sync hook.
- Consumers:
  - `useChannelSubscription(channel)` (`hooks.ts:255`), mounted from `features/channels/ui/ChannelScreen.tsx` — one live sub for the active channel + reconnect refetch.
  - `useLiveChannelUpdates` (`useLiveChannelUpdates.ts:122`), from `useUnreadChannels.ts` — diff-based sub manager (`syncSubs`), one sub per channel for unread/notifications, exponential-backoff retry. Also merges into `channel-messages` directly (idempotent) to cover the race before the per-channel sub connects.

## 2. State layer

React Query cache used as a store (no client DB). Query keys in `features/messages/lib/messageQueryKeys.ts`: `channel-window` (store), `channel-messages` (projection), `thread-replies`.

`channelWindowStore.ts`:
- `ChannelWindowStore` (:26) = relay `pages` + `liveOverlay` + `liveAux` + `liveSummaries`.
- `compareRelayOrder()` (:60) — newest `created_at` first, id tiebreak.
- `mergeLiveChannelWindowEvent()` (:183) — live insert, dedup by id.
- `mergeLiveThreadSummary()` (:166) — newest-wins thread badges (kind 39005).
- `flattenChannelWindowEvents()` / `mapChannelWindowEvents()` — store → array.

Plumbing: `appendMessage` (`hooks.ts:264-331`) routes 39005 → summaries, thread replies → `thread-replies`, timeline rows → window store, then `projectChannelWindowMessages()` (`lib/projectChannelWindow.ts`) refreshes the array. Reconciliation with optimistic events: `lib/channelWindowReconciliation.ts`; dedup merges: `lib/messageMerge.ts`. History pages: `useChannelMessagesQuery` (`hooks.ts:229`) + `useFetchOlderMessages.ts`/`pageOlderMessages.ts`.

## 3. View layer

- `ChannelScreen.tsx` reads the queries, applies `formatTimelineMessages` (edit/reaction overlays + thread summaries) → `ChannelPane.tsx` → `MessageTimeline.tsx`.
- `MessageTimeline.tsx` (memoized `MessageTimelineBase`):
  - `useBufferedTimelineMessages` — Zulip-style tail freeze: when scrolled up, live arrivals hold behind a "new messages" affordance.
  - `useSettleGatedPrependMessages` — older-page prepends wait for scroll rest (WKWebView workaround).
  - `useAnchoredScroll` — anchoring, new-message count, scroll-to.
- `TimelineMessageList.tsx` — **Virtua** `VList` virtualization, stable keys via `lib/virtualizedTimelineItems.ts`. Rows: `MessageRow.tsx`.

Re-render chain: live event → window store → projected array (new reference) → query re-render → `formatTimelineMessages` → Virtua diffs by id, mounts only the new row.

## 4. Outbound (send)

`useSendMessageMutation` (`hooks.ts:400`):
- `onMutate` — `createOptimisticMessage` (`pending: true`, `optimistic-…` id) → window store → project. Instant paint.
- `mutationFn` — plain text: `relayClient.sendMessage()` (sign via Tauri native signer, `["EVENT", …]`); replies/media/custom-emoji: REST via Tauri `sendChannelMessage` so relay tag-validation runs.
- `onSuccess` — swap optimistic → real event (reconciled by `localKey`); `onError` — roll back both caches.

Edits/deletes/reactions: `useEditMessageMutation` / `useDeleteMessageMutation` / `useToggleReactionMutation` (same file). Typing: `relayClientSession.ts` + `useTypingBroadcast.ts`.

## 5. Server-side shaping

- `crates/buzz-relay/src/handlers/req.rs` — REQ registration (membership-checked before registering).
- `crates/buzz-relay/src/subscription.rs` — scoped sub index (`register_scoped`), community + `#h` keyed.
- `crates/buzz-relay/src/handlers/event.rs` — ingest (`handle_event` :585) and delivery; Redis publish at ~:828.
- `crates/buzz-pubsub/src/publisher.rs`/`subscriber.rs` — cross-pod fan-out.
- Channel scoping is NIP-29 `h` tags, not `e` tags.

## Files you'll actually edit

1. `desktop/src/features/messages/hooks.ts` — live insert + optimistic behavior.
2. `desktop/src/features/messages/lib/channelWindowStore.ts` — dedup/ordering/overlay rules.
3. `desktop/src/features/channels/useLiveChannelUpdates.ts` — fan-out, retry, cross-channel merges.
4. `lib/projectChannelWindow.ts` + `lib/channelWindowReconciliation.ts` — projection.
5. `desktop/src/shared/api/relayClientSession.ts` — filters, transport, reconnect.
6. `ui/MessageTimeline.tsx`, `ui/useBufferedTimelineMessages.ts`, `ui/useAnchoredScroll.ts` — arrival UX.
7. `ui/TimelineMessageList.tsx` — virtualization.
