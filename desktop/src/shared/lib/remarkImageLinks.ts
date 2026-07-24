/**
 * Remark plugin that renders bare image URLs as inline images: an autolinked
 * `link` node whose visible text is the URL itself and whose path ends in an
 * image extension becomes an `image` node, flowing into the existing img
 * pipeline (ImageBlock, mosaics, lightbox, imeta lookups). Explicit
 * `[text](url.png)` links keep their author-chosen text and stay links.
 */

const IMAGE_EXTENSIONS = new Set([
  "apng",
  "avif",
  "bmp",
  "gif",
  "jpeg",
  "jpg",
  "png",
  "svg",
  "webp",
]);

type Node = {
  // biome-ignore lint/suspicious/noExplicitAny: building mdast-compatible nodes
  [key: string]: any;
};

export function isImageUrl(raw: string): boolean {
  if (!/^https?:\/\//i.test(raw)) return false;
  let pathname: string;
  try {
    pathname = new URL(raw).pathname;
  } catch {
    return false;
  }
  const dot = pathname.lastIndexOf(".");
  if (dot === -1) return false;
  return IMAGE_EXTENSIONS.has(pathname.slice(dot + 1).toLowerCase());
}

function isBareImageLink(node: Node): boolean {
  if (node.type !== "link" || typeof node.url !== "string") return false;
  const children = node.children;
  if (!Array.isArray(children) || children.length !== 1) return false;
  const only = children[0];
  if (only?.type !== "text" || typeof only.value !== "string") return false;
  // Autolinks render the URL as their own text (modulo surrounding trim).
  if (only.value.trim() !== node.url.trim()) return false;
  return isImageUrl(node.url);
}

function transformNode(node: Node) {
  if (!node?.children || !Array.isArray(node.children)) return;
  node.children = node.children.map((child: Node) => {
    if (isBareImageLink(child)) {
      return { alt: "", title: null, type: "image", url: child.url };
    }
    transformNode(child);
    return child;
  });
}

export default function remarkImageLinks() {
  return (
    // biome-ignore lint/suspicious/noExplicitAny: remark tree types are not available
    tree: any,
  ) => {
    transformNode(tree);
  };
}
