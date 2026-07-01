import { chromium, devices } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE_URL = process.env.SYNARA_WEB_URL ?? "http://localhost:8891";
const ARTIFACT_DIR =
  process.env.SYNARA_ARTIFACT_DIR ?? "/opt/cursor/artifacts/utility-page-islands";

const UTILITY_PAGES = [
  { path: "/settings", title: "Settings" },
  { path: "/plugins", title: "Plugins" },
  { path: "/kanban", title: "Kanban" },
  { path: "/automations", title: "Automations" },
];

const ISLAND_LABELS = [
  "New chat",
  "Add project",
  "Search",
  "Automations",
  "Plugins",
  "Kanban",
  "Settings",
];

function islandButton(page, label) {
  return page.locator(`button[aria-label="${label}"][data-slot="tooltip-trigger"]`);
}

async function waitForIslands(page) {
  for (const label of ISLAND_LABELS) {
    await islandButton(page, label).waitFor({
      state: "visible",
      timeout: 15_000,
    });
  }
}

async function assertIslandsInTopBar(page, pageName) {
  const settingsButton = islandButton(page, "Settings");
  const box = await settingsButton.boundingBox();
  if (!box) {
    throw new Error(`[${pageName}] Settings island has no bounding box`);
  }
  if (box.y > 90) {
    throw new Error(
      `[${pageName}] Settings island too low (y=${box.y.toFixed(1)}); expected within top chrome row`,
    );
  }
}

async function assertIslandClickable(page, label) {
  const button = islandButton(page, label);
  await button.click({ trial: true });
}

async function main() {
  await mkdir(ARTIFACT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    ...devices["Desktop Chrome"],
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  const results = [];

  try {
    for (const route of UTILITY_PAGES) {
      await page.goto(`${BASE_URL}${route.path}`, { waitUntil: "networkidle" });
      await waitForIslands(page);
      await assertIslandsInTopBar(page, route.title);

      for (const label of ISLAND_LABELS) {
        await assertIslandClickable(page, label);
      }

      const screenshotPath = path.join(
        ARTIFACT_DIR,
        `${route.path.replace(/\//g, "_").replace(/^_/, "") || "root"}.png`,
      );
      await page.screenshot({ path: screenshotPath, fullPage: false });

      results.push({ route: route.path, status: "pass", screenshot: screenshotPath });
    }

    await page.goto(`${BASE_URL}/settings`, { waitUntil: "networkidle" });
    await waitForIslands(page);
    await islandButton(page, "Plugins").click();
    await page.waitForURL("**/plugins**", { timeout: 10_000 });
    results.push({ route: "navigation/settings->plugins", status: "pass" });

    await page.goto(`${BASE_URL}/plugins`, { waitUntil: "networkidle" });
    await waitForIslands(page);
    await islandButton(page, "Search").click();
    await page.locator('[data-slot="command-dialog-popup"]').waitFor({
      state: "visible",
      timeout: 10_000,
    });
    results.push({ route: "search-palette", status: "pass" });

    await page.keyboard.press("Escape");
    await islandButton(page, "Kanban").click();
    await page.waitForURL("**/kanban**", { timeout: 10_000 });
    results.push({ route: "navigation/plugins->kanban", status: "pass" });

    console.log(JSON.stringify({ ok: true, results }, null, 2));
  } catch (error) {
    const failShot = path.join(ARTIFACT_DIR, "failure.png");
    await page.screenshot({ path: failShot, fullPage: true }).catch(() => {});
    console.error(
      JSON.stringify(
        {
          ok: false,
          error: error instanceof Error ? error.message : String(error),
          failureScreenshot: failShot,
          results,
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

await main();
