import * as React from "react";
import { Play, Square } from "lucide-react";

import { Button } from "@/shared/ui/button";

import { MarkdownCodeBlock, SyntaxHighlightedCode } from "./CodeBlock";

/**
 * Interactive preview for ```html fences: the code renders highlighted as
 * usual, plus an opt-in "Run" toggle that mounts the snippet in a sandboxed
 * iframe. `sandbox="allow-scripts"` (deliberately WITHOUT allow-same-origin)
 * gives the snippet its own null origin: it can draw, animate, and run
 * canvas/JS, but cannot touch the app's DOM, storage, cookies, or Tauri IPC.
 * Nothing executes until the reader clicks Run.
 */
export function HtmlLiveBlock({
  className,
  code,
}: {
  className?: string;
  code: string;
}) {
  const [running, setRunning] = React.useState(false);

  return (
    <span className="block" data-block-media="">
      <MarkdownCodeBlock language="html">
        <SyntaxHighlightedCode
          className={className}
          code={code}
          language="html"
        />
      </MarkdownCodeBlock>
      <span className="mt-1 flex items-center gap-2">
        <Button
          className="h-6 gap-1 px-2 text-xs"
          onClick={() => setRunning((r) => !r)}
          size="sm"
          type="button"
          variant="outline"
        >
          {running ? (
            <Square className="h-3 w-3" />
          ) : (
            <Play className="h-3 w-3" />
          )}
          {running ? "Stop" : "Run"}
        </Button>
        {running && (
          <span className="text-2xs text-muted-foreground/70">
            sandboxed — no access to the app or network identity
          </span>
        )}
      </span>
      {running && (
        <iframe
          className="mt-1 h-80 w-full rounded-2xl border border-border/70 bg-white"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts"
          srcDoc={code}
          title="Interactive HTML preview"
        />
      )}
    </span>
  );
}
