import { expect, test } from "@playwright/test";

import { installMockBridge } from "../helpers/bridge";

// Diagnostic: open a DM and capture any console error / render crash.
test("opening a DM does not crash", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.stack ?? err.message}`));

  await installMockBridge(page);
  await page.goto("/");

  const firstDm = page
    .getByTestId("dm-list")
    .locator('[data-sidebar="menu-button"]')
    .first();
  await expect(firstDm).toBeVisible();
  await firstDm.click();

  // Send a message into the DM to force MessageRow/markdown rendering.
  await page.waitForFunction(
    () => typeof window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__ === "function",
  );
  await page.evaluate(() => {
    window.__BUZZ_E2E_EMIT_MOCK_MESSAGE__?.({
      channelName: "alice-tyler",
      content: "hello from a dm",
      createdAt: Math.floor(Date.now() / 1000),
    });
  });

  await page.waitForTimeout(1500);
  // Surface whatever crashed.
  if (errors.length) {
    throw new Error(`DM console errors:\n${errors.join("\n---\n")}`);
  }
  await expect(
    page.getByTestId("message-row").filter({ hasText: "hello from a dm" }),
  ).toBeVisible();
});
