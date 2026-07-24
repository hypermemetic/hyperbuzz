import * as React from "react";
import { Globe, Play, Square } from "lucide-react";

import { invokeTauri } from "@/shared/api/tauri";
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
 * home or leak the viewer's IP.
 *
 * When the reader additionally clicks "Enable network", a `buzzFetch(url)`
 * shim is exposed inside the sandbox. It does NOT open the network directly
 * (CSP still blocks that); it postMessages the request to this host, which
 * forwards it to the relay's `/sandbox-fetch` broker (rim HBZ-2). The relay
 * makes the request under its SSRF/allowlist/rate-limit/audit policy, so the
 * embed author only ever sees the relay's IP, never the viewer's.
 */
const SANDBOX_CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "media-src data:",
  "font-src data:",
].join("; ");

/** Injected into the sandbox document. Exposes `window.buzzFetch(url)` that
 * round-trips through the host via postMessage — never touches the network
 * directly (the CSP forbids that). */
const BUZZ_FETCH_SHIM = `
<script>
(function () {
  var pending = {};
  var seq = 0;
  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || d.__buzzFetchResult == null) return;
    var p = pending[d.id];
    if (!p) return;
    delete pending[d.id];
    if (d.error) p.reject(new Error(d.error));
    else p.resolve({ status: d.status, contentType: d.contentType, body: d.body });
  });
  window.buzzFetch = function (url) {
    return new Promise(function (resolve, reject) {
      var id = ++seq;
      pending[id] = { resolve: resolve, reject: reject };
      parent.postMessage({ __buzzFetch: true, id: id, url: String(url) }, "*");
    });
  };
})();
</script>`;

function wrapSandboxDocument(code: string, withFetch: boolean): string {
  const shim = withFetch ? BUZZ_FETCH_SHIM : "";
  return `<!doctype html><html><head><meta http-equiv="Content-Security-Policy" content="${SANDBOX_CSP}">${shim}</head><body>${code}</body></html>`;
}

type SandboxFetchResponse = {
  status: number;
  contentType: string;
  bodyBase64: string;
};

export function HtmlLiveBlock({
  className,
  code,
}: {
  className?: string;
  code: string;
}) {
  const [running, setRunning] = React.useState(false);
  const [networkEnabled, setNetworkEnabled] = React.useState(false);
  const iframeRef = React.useRef<HTMLIFrameElement | null>(null);

  // Host side of the fetch broker: only wired when the reader has opted into
  // network for this embed. Verifies the message came from THIS iframe, then
  // forwards to the relay and posts the result back into the sandbox.
  React.useEffect(() => {
    if (!running || !networkEnabled) return;
    const handler = async (event: MessageEvent) => {
      const iframe = iframeRef.current;
      if (!iframe || event.source !== iframe.contentWindow) return;
      const data = event.data;
      if (!data || data.__buzzFetch !== true) return;
      const reply = (payload: Record<string, unknown>) => {
        iframe.contentWindow?.postMessage(
          { __buzzFetchResult: true, id: data.id, ...payload },
          "*",
        );
      };
      try {
        const url = String(data.url ?? "");
        if (!/^https?:\/\//i.test(url)) {
          reply({ error: "only http(s) URLs are allowed" });
          return;
        }
        const res = await invokeTauri<SandboxFetchResponse>("sandbox_fetch", {
          url,
        });
        const body =
          typeof atob === "function" ? atob(res.bodyBase64) : res.bodyBase64;
        reply({ status: res.status, contentType: res.contentType, body });
      } catch (error) {
        reply({
          error: error instanceof Error ? error.message : "fetch failed",
        });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [running, networkEnabled]);

  return (
    <span className="block" data-block-media="">
      <MarkdownCodeBlock language="html">
        <SyntaxHighlightedCode
          className={className}
          code={code}
          language="html"
        />
      </MarkdownCodeBlock>
      <span className="mt-1 flex flex-wrap items-center gap-2">
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
          <Button
            className="h-6 gap-1 px-2 text-xs"
            onClick={() => setNetworkEnabled((n) => !n)}
            size="sm"
            type="button"
            variant={networkEnabled ? "default" : "outline"}
          >
            <Globe className="h-3 w-3" />
            {networkEnabled ? "Network on (via relay)" : "Enable network"}
          </Button>
        )}
        {running && (
          <span className="text-2xs text-muted-foreground/70">
            {networkEnabled
              ? "requests are proxied by the relay — author sees the relay, not you"
              : "sandboxed — no app access, no network"}
          </span>
        )}
      </span>
      {running && (
        <iframe
          ref={iframeRef}
          className="mt-1 h-80 w-full rounded-2xl border border-border/70 bg-white"
          key={networkEnabled ? "net" : "nonet"}
          referrerPolicy="no-referrer"
          sandbox="allow-scripts"
          srcDoc={wrapSandboxDocument(code, networkEnabled)}
          title="Interactive HTML preview"
        />
      )}
    </span>
  );
}
