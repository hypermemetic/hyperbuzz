import * as React from "react";

import { HuddleAttachment } from "@/features/huddle/components/HuddleAttachment";
import type { TimelineMessage } from "@/features/messages/types";
import {
  KIND_HUDDLE_STARTED,
  KIND_STREAM_MESSAGE_DIFF,
} from "@/shared/constants/kinds";

const DiffMessage = React.lazy(() => import("../ui/DiffMessage"));

/**
 * Kind → renderer registry for message bodies.
 *
 * Replaces the hard-coded `switch (message.kind)` in MessageRow: a message
 * kind with a registered renderer gets its own body component; everything
 * else falls through to the default markdown path. New special-bodied kinds
 * register here instead of growing the switch — the client-side counterpart
 * of "new capability = new kind integer" (see buzz-core/src/kind.rs).
 */
export type MessageKindRenderContext = {
  channelId: string | null;
  /** First value of the named tag on the event, if present. */
  getTag: (name: string) => string | undefined;
  message: TimelineMessage;
  /** Expands the diff overlay for this message id (diff messages). */
  onExpandDiff: (messageId: string) => void;
  onOpenThread?: React.ComponentProps<typeof HuddleAttachment>["onOpenThread"];
};

export type MessageKindRenderer = (
  ctx: MessageKindRenderContext,
) => React.ReactNode;

const messageKindRenderers = new Map<number, MessageKindRenderer>();

export function registerMessageKindRenderer(
  kind: number,
  renderer: MessageKindRenderer,
): void {
  messageKindRenderers.set(kind, renderer);
}

export function getMessageKindRenderer(
  kind: number | undefined,
): MessageKindRenderer | undefined {
  return kind === undefined ? undefined : messageKindRenderers.get(kind);
}

registerMessageKindRenderer(
  KIND_STREAM_MESSAGE_DIFF,
  ({ getTag, message, onExpandDiff }) => (
    <React.Suspense
      fallback={
        <div className="p-3 text-sm text-muted-foreground">Loading diff…</div>
      }
    >
      <DiffMessage
        commitSha={getTag("commit")}
        content={message.body}
        description={getTag("description")}
        filePath={getTag("file")}
        onExpand={() => {
          onExpandDiff(message.id);
        }}
        repoUrl={getTag("repo")}
        truncated={getTag("truncated") === "true"}
      />
    </React.Suspense>
  ),
);

registerMessageKindRenderer(
  KIND_HUDDLE_STARTED,
  ({ channelId, message, onOpenThread }) => (
    <HuddleAttachment
      channelId={channelId}
      message={message}
      onOpenThread={onOpenThread}
    />
  ),
);
