---
name: message-rendering
description: >
  The message-content rendering pipeline in the desktop client: react-markdown
  + custom remark plugins, the component override map, the parse cache and its
  schema version, code blocks via Shiki, and the security model. Includes the
  concrete recipe for mermaid support and the assessment of MDX embedding.
version: 1
---

# Message Rendering Pipeline

**In one line:** message text is markdown parsed by `react-markdown` called *as a plain function* inside an LRU parse cache, with Buzz entities injected by custom remark plugins and rendered through an explicit component override map.

All paths under `desktop/` (the chat client). Stack: `react-markdown@10` + `remark-gfm` + `remark-breaks`; Shiki for syntax highlighting.

## Core files

- `desktop/src/shared/ui/markdown.tsx` — the `Markdown` component (~:1830), the component override map `createMarkdownComponents()` (~:1354), and **`MARKDOWN_COMPONENT_SCHEMA_VERSION`** (~:1802).
- `desktop/src/shared/ui/markdown/nodeCache.ts` — `buildMarkdownElement()` (~:83): `ReactMarkdown(...)` invoked synchronously (not JSX) so the element tree can live in a module-level LRU (`markdownNodeCache`, 1000 entries, bypass >32KB). Plugin arrays are assembled here.
- `desktop/src/shared/ui/markdown/CodeBlock.tsx` — `MarkdownCodeBlock` (copy button + scroll) and `SyntaxHighlightedCode` (Shiki, lazy lang/theme load, 150-line cap, unknown langs fall back to plain text).

## The plugin pipeline (as configured in nodeCache.ts)

remark: `remarkGfm`, `remarkBreaks`, `remarkSpoilers`, `remarkMessageLinks`, `remarkMentions`, `remarkChannelLinks`, `remarkCustomEmoji`. rehype: `rehypeImageGallery` (+ `rehypeSearchHighlight` when searching). URL filter: `messageLinkUrlTransform` (`markdown/utils.ts`) — allows `buzz://message?…`, otherwise react-markdown's `defaultUrlTransform`.

Custom syntax pattern: a remark plugin walks the tree and emits nodes with `data.hName`/`data.hProperties` (see `shared/lib/remarkSpoilers.ts`), which map to entries in the component override table:

| hast node | Component | Producer |
|---|---|---|
| `spoiler` | `SpoilerInline` | `remarkSpoilers` |
| `mention` | `MarkdownMention` → profile popover | `remarkMentions` |
| `emoji` | `InlineEmojiPopover` | `remarkCustomEmoji` |
| `channel-link` | `MarkdownChannelLink` | `remarkChannelLinks` |
| `message-link` | `MessageLinkPill` | `features/messages/lib/remarkMessageLinks.ts` |
| `a` | `MarkdownAnchor` → file/snapshot cards, link previews | native |
| `img` | `MarkdownImage` → image/video/mosaic | native + `rehypeImageGallery` |
| `code`/`pre` | Shiki code blocks | native |

Link previews render *outside* the markdown tree as sibling `AttachmentGroup`s in `MarkdownInner` (driven by `extractSupportedLinkPreviews`).

## Cache discipline (the gotcha)

The component map is cached per-variant and the variant token is part of the parse-cache key. **If you change component behavior or add a render input, bump `MARKDOWN_COMPONENT_SCHEMA_VERSION`** or cached trees will serve stale renders. Perf tests guard the warm-switch zero-parse guarantee: `desktop/tests/e2e/warm-switch-markdown.perf.ts`, `markdown-parse-cache.spec.ts`.

## Security model

No `rehype-raw`, no sanitizer, no `dangerouslySetInnerHTML` in the message path — react-markdown v10 drops raw HTML by default, and **that absence is the XSS defense**. Messages are untrusted relay content; the pipeline never executes markup. Preserve this property in any change.

## Implemented in hyperbuzz (branch hyper/five-features)

- **Mermaid**: `shared/ui/markdown/MermaidDiagram.tsx`, intercepted in the `code` override for `language === "mermaid"`; `pre` skips its chrome for it.
- **Live HTML**: `shared/ui/markdown/HtmlLiveBlock.tsx` — ```html fences render highlighted plus an opt-in Run toggle mounting a sandboxed iframe (`sandbox="allow-scripts"`, null origin).
- **KaTeX**: `remark-math` (singleDollarTextMath off) + `rehype-katex` in `nodeCache.ts`; CSS imported there.
- Schema version is now "5".

## Recipe: mermaid support (small, additive — as originally assessed)

1. `pnpm add mermaid` in `desktop/` (lazy-`import()` it — the dep is ~500KB).
2. New `src/shared/ui/markdown/MermaidDiagram.tsx`: on mount `mermaid.render(id, code)` into a ref, theme via `useTheme()` (mirror `SyntaxHighlightedCode`), init with `securityLevel: "strict"`, fall back to a plain code block on parse failure, add a size guard mirroring `MAX_HIGHLIGHT_LINES`.
3. Intercept in the `code` override (`markdown.tsx` ~:1514) before the Shiki branch: `if (language === "mermaid") return <MermaidDiagram code={code}/>`. Optionally special-case `pre` (~:1635) to skip the copy-button wrapper.
4. Bump `MARKDOWN_COMPONENT_SCHEMA_VERSION`.

(Today a ```mermaid fence just renders as plain unhighlighted text — Shiki fails to load the lang and falls back.)

## Assessment: MDX — don't, for chat messages

MDX = executing arbitrary JSX from message content. It inverts the pipeline's core security stance (never execute relay-supplied markup; there is no sandbox/allowlist infra), and its async compilation breaks the synchronous `ReactMarkdown(...)`-as-function parse cache. If MDX is ever wanted, scope it to a trusted authoring surface (canvas/docs), never arbitrary messages. For rich interactive content, prefer the kind-based renderer registry route — see the `extensibility` skill.
