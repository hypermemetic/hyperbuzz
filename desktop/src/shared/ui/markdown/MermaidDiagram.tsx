import * as React from "react";

import { useTheme } from "@/shared/theme/ThemeProvider";

import { CODE_BLOCK_CLASS } from "./CodeBlock";

/** Mirrors MAX_HIGHLIGHT_LINES-style guarding in CodeBlock: oversized diagram
 * sources fall back to plain text rather than hanging the layout thread. */
const MAX_MERMAID_SOURCE_LENGTH = 20_000;

type MermaidModule = typeof import("mermaid").default;

let mermaidLoadPromise: Promise<MermaidModule> | null = null;
let renderSeq = 0;

/** Mermaid is ~500KB — loaded on first diagram, never in the main bundle. */
function loadMermaid(): Promise<MermaidModule> {
  if (!mermaidLoadPromise) {
    mermaidLoadPromise = import("mermaid").then((m) => m.default);
  }
  return mermaidLoadPromise;
}

function PlainCodeFallback({ code }: { code: string }) {
  return (
    <pre className="max-h-[400px] overflow-x-auto overflow-y-auto rounded-2xl border border-border/70 bg-muted/60 px-3 py-1.5">
      <code className={CODE_BLOCK_CLASS}>
        {code.split("\n").map((line, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: lines are positional
          <span key={i} data-line="">
            {line}
          </span>
        ))}
      </code>
    </pre>
  );
}

export function MermaidDiagram({
  className,
  code,
}: {
  className?: string;
  code: string;
}) {
  const { themeName } = useTheme();
  const isDark = themeName.includes("dark");
  const [svg, setSvg] = React.useState<string | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (code.length > MAX_MERMAID_SOURCE_LENGTH) {
      setFailed(true);
      return;
    }
    setFailed(false);
    (async () => {
      try {
        const mermaid = await loadMermaid();
        if (cancelled) return;
        // securityLevel "strict" sandboxes click handlers and script-bearing
        // labels — the diagram source is untrusted relay content.
        mermaid.initialize({
          securityLevel: "strict",
          startOnLoad: false,
          theme: isDark ? "dark" : "default",
        });
        renderSeq += 1;
        const rendered = await mermaid.render(
          `buzz-mermaid-${renderSeq}`,
          code,
        );
        if (!cancelled) setSvg(rendered.svg);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code, isDark]);

  if (failed) return <PlainCodeFallback code={code} />;

  if (!svg) {
    return (
      <span className={className} data-block-media="">
        <span className="block rounded-2xl border border-border/70 bg-muted/60 px-3 py-2 text-xs text-muted-foreground/70">
          Rendering diagram…
        </span>
      </span>
    );
  }

  return (
    <span
      className="block max-w-full overflow-x-auto rounded-2xl border border-border/70 bg-background px-3 py-2 [&_svg]:mx-auto [&_svg]:max-w-full"
      data-block-media=""
      // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG is generated locally by mermaid (securityLevel strict) from the fence text, never raw relay HTML
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
