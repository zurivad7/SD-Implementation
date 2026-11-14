import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Start every test from a clean sandbox.
  await page.goto("./");
  await page.evaluate(() => localStorage.clear());
});

test("create a preset enterprise ticket: the timeline shows Enterprise fast lane and an assignee", async ({ page }) => {
  await page.goto("./#/sandbox");
  await page.getByLabel("Example scenario").selectOption("enterprise-urgent");
  await page.getByRole("button", { name: "Fill example" }).click();
  await page.getByRole("button", { name: "Create ticket" }).click();
  const timeline = page.getByTestId("timeline");
  await expect(timeline.getByText(/Trigger "Enterprise fast lane" fired/)).toBeVisible();
  await expect(timeline.getByText(/^Assigned to .+ in Escalations\.$/)).toBeVisible();
  await expect(page.getByTestId("field-assignee")).not.toHaveText("Unassigned");
});

test("press +1 h until the SLA badge turns amber, then red", async ({ page }) => {
  await page.goto("./#/sandbox");
  await page.getByLabel("Example scenario").selectOption("enterprise-urgent");
  await page.getByRole("button", { name: "Fill example" }).click();
  await page.getByRole("button", { name: "Create ticket" }).click();
  const badge = page.getByTestId("sla-resolution");
  await expect(badge).toHaveAttribute("data-state", "ok");
  const seen: string[] = [];
  for (let i = 0; i < 6 && !seen.includes("breached"); i++) {
    await page.getByRole("button", { name: "+1 h" }).click();
    const state = await badge.getAttribute("data-state");
    if (seen.at(-1) !== state) seen.push(state!);
  }
  expect(seen).toEqual(["ok", "warning", "breached"]);
  await expect(badge).toContainText("Breached");
});

test("change the channel filter on the dashboard: tile values change", async ({ page }) => {
  await page.goto("./#/dashboard");
  const tile = page.getByTestId("tile-slaBreachRate").getByTestId("tile-after");
  const before = await tile.innerText();
  const firstReply = await page.getByTestId("tile-medianFirstReplyMins").getByTestId("tile-after").innerText();
  await page.getByLabel("Channel", { exact: true }).selectOption("chat");
  await expect(tile).not.toHaveText(before);
  await expect(page.getByTestId("tile-medianFirstReplyMins").getByTestId("tile-after")).not.toHaveText(firstReply);
  await expect(page.getByTestId("match-count")).not.toHaveText("4,550 tickets match.");
});
