import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

import { waitForAnimations } from "../helpers/animations";
import { installMockBridge } from "../helpers/bridge";
import { should_screenshot } from "../helpers/shouldScreenshot";

const MERMAID_MESSAGE = [
  "```mermaid",
  "graph LR",
  "  A[client] --> B(relay)",
  "  B --> C[subscribers]",
  "```",
].join("\n");

const KATEX_MESSAGE =
  "energy: $$E = mc^2$$ and a sum $$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$";

const HTML_MESSAGE = [
  "```html",
  '<canvas id="c" width="300" height="100"></canvas>',
  "<script>",
  'const ctx = document.getElementById("c").getContext("2d");',
  'ctx.fillStyle = "#3b82f6"; ctx.fillRect(10, 10, 280, 80);',
  "</script>",
  "```",
].join("\n");

const IMAGE_LINK_MESSAGE =
  "look at this: http://127.0.0.1:4173/buzz.svg trailing text";

async function openGeneral(page: Page) {
  await installMockBridge(page);
  await page.goto("/");
  await page.getByTestId("channel-general").click();
  await expect(page.getByTestId("chat-title")).toHaveText("general");
  await page.waitForFunction(
    () => typeof window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__ === "function",
  );
}

async function emitMessage(page: Page, content: string, offset = 0) {
  await page.evaluate(
    ({ body, delta }) => {
      window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__?.({
        channelName: "general",
        content: body,
        createdAt: Math.floor(Date.now() / 1000) + delta,
      });
    },
    { body: content, delta: offset },
  );
}

async function captureRow(
  page: Page,
  rowText: string,
  screenshotId: string,
) {
  const target = should_screenshot(globalThis, screenshotId);
  if (!target) return;
  await waitForAnimations(page);
  const row = page
    .getByTestId("message-row")
    .filter({ hasText: rowText })
    .first();
  await row.screenshot({ path: target });
}

test("mermaid fences render as diagrams", async ({ page }) => {
  await openGeneral(page);
  await emitMessage(page, MERMAID_MESSAGE);

  const diagram = page.locator("[data-testid='message-row'] svg[id^='buzz-mermaid-']");
  await expect(diagram).toBeVisible({ timeout: 15_000 });
  // Nodes made it into the rendered SVG, not just an empty canvas.
  await expect(
    page.getByTestId("message-row").filter({ hasText: "client" }).first(),
  ).toBeVisible();
  await captureRow(page, "client", "mermaid-diagram");
});

test("katex renders display math", async ({ page }) => {
  await openGeneral(page);
  await emitMessage(page, KATEX_MESSAGE);

  const math = page.locator("[data-testid='message-row'] .katex");
  await expect(math.first()).toBeVisible({ timeout: 10_000 });
  // Raw TeX source must not remain visible as text.
  await expect(
    page.getByTestId("message-row").filter({ hasText: "$$E = mc^2$$" }),
  ).toHaveCount(0);
  await captureRow(page, "energy", "katex-math");
});

test("html fences run in a sandboxed iframe", async ({ page }) => {
  await openGeneral(page);
  await emitMessage(page, HTML_MESSAGE);

  const row = page
    .getByTestId("message-row")
    .filter({ hasText: "canvas" })
    .first();
  const runButton = row.getByRole("button", { name: "Run" });
  await expect(runButton).toBeVisible({ timeout: 10_000 });

  await runButton.click();
  const frame = row.locator("iframe[title='Interactive HTML preview']");
  await expect(frame).toBeVisible();
  // The sandbox must never grant same-origin access.
  await expect(frame).toHaveAttribute("sandbox", "allow-scripts");
  await captureRow(page, "canvas", "html-sandbox-running");

  await row.getByRole("button", { name: "Stop" }).click();
  await expect(frame).toHaveCount(0);
});

test("bare image links render inline as images", async ({ page }) => {
  await openGeneral(page);
  await emitMessage(page, IMAGE_LINK_MESSAGE);

  const row = page
    .getByTestId("message-row")
    .filter({ hasText: "look at this" })
    .first();
  await expect(row.locator("img").first()).toBeVisible({ timeout: 10_000 });
  // The URL itself should no longer render as an anchor.
  await expect(
    row.locator("a", { hasText: "http://127.0.0.1:4173/buzz.svg" }),
  ).toHaveCount(0);
  await captureRow(page, "look at this", "image-link-inline");
});
