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
 *
 * The srcdoc wrapper injects a CSP that makes the sandbox network-dead:
 * inline script/style and data: assets work, but fetch/XHR/beacons, external
 * scripts, and external images are all blocked — a run snippet cannot phone
 * home or leak the viewer's IP. Relay-mediated fetch is planned separately
 * (rim HBZ-2, sandbox-fetch-broker).
 */
const SANDBOX_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "media-src data:",
  "font-src data:",
].join("; ");

function wrapSandboxDocument(code: string): string {
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}"></head><body>${code}</body></html>`;
}
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
            sandboxed — no app access, no network
          </span>
        )}
      </span>
      {running && (
        <iframe
          className="mt-1 h-80 w-full rounded-2xl border border-border/70 bg-white"
          referrerPolicy="no-referrer"
          sandbox="allow-scripts"
          srcDoc={wrapSandboxDocument(code)}
          title="Interactive HTML preview"
        />
      )}
    </span>
  );
}
