import * as fs from "node:fs";
import * as path from "node:path";

const OUTPUT_DIR = path.join("test-results", "hyperbuzz-screenshots");

type ScreenshotGlobal = typeof globalThis & {
  __hyperbuzzScreenshotIds?: Set<string>;
};

/**
 * Gate for capturing feature screenshots inside e2e specs.
 *
 * Returns the output path for the capture, or null when screenshots are
 * disabled (`BUZZ_E2E_SCREENSHOTS=0`). The unique test id is enforced
 * per-run via a registry on the provided global — a duplicate id throws,
 * which guarantees no two captures can silently overwrite each other (the
 * byte-identical-screenshot regression AGENTS.md warns about).
 */
export function should_screenshot(
  global: ScreenshotGlobal,
  uniqueTestId: string,
): string | null {
  if (process.env.BUZZ_E2E_SCREENSHOTS === "0") return null;
  if (!/^[a-z0-9-]+$/.test(uniqueTestId)) {
    throw new Error(
      `screenshot id must be kebab-case alphanumeric: ${uniqueTestId}`,
    );
  }
  const seen = (global.__hyperbuzzScreenshotIds ??= new Set());
  if (seen.has(uniqueTestId)) {
    throw new Error(`duplicate screenshot id: ${uniqueTestId}`);
  }
  seen.add(uniqueTestId);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  return path.join(OUTPUT_DIR, `${uniqueTestId}.png`);
}
