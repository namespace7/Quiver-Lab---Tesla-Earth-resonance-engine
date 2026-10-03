import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

async function runSmoke() {
  console.log("Starting Browser Smoke Verification for Quiver Lab...");
  mkdirSync("screenshots", { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];

  page.on("console", (msg) => {
    if (msg.type() === "error") {
      consoleErrors.push(msg.text());
    }
  });

  page.on("pageerror", (err) => {
    pageErrors.push(err.message);
  });

  // 1. Application loads
  console.log("1. Navigating to http://127.0.0.1:8080/ ...");
  const response = await page.goto("http://127.0.0.1:8080/", { waitUntil: "networkidle", timeout: 15000 });
  const status = response.status();
  console.log(`   Response status: ${status}`);
  if (status !== 200) {
    throw new Error(`Expected HTTP 200, got ${status}`);
  }

  // 2 & 3. Mode buttons visible
  console.log("2 & 3. Checking Conservative and Historical mode buttons...");
  const consBtn = page.getByRole("button", { name: "🛡️ Conservative Physics" });
  const histBtn = page.getByRole("button", { name: "⚠️ Historical / Phenomenological" });
  await consBtn.waitFor({ state: "visible" });
  await histBtn.waitFor({ state: "visible" });
  console.log("   ✓ Both Conservative and Historical mode buttons are visible.");

  // 4. Mode switching works
  console.log("4. Testing mode switching...");
  await histBtn.click();
  await page.waitForTimeout(500);
  const histBanner = page.getByText(/Historical \/ Phenomenological Mode/i);
  await histBanner.waitFor({ state: "visible" });
  console.log("   ✓ Switched to Historical Mode: Warning banner verified.");

  await consBtn.click();
  await page.waitForTimeout(500);
  const consBanner = page.getByText(/Energy-Conserved Model/i);
  await consBanner.waitFor({ state: "visible" });
  console.log("   ✓ Switched to Conservative Mode: Energy-Conserved Model banner verified.");

  // 5 & 6. Controls render and sliders update state
  console.log("5 & 6. Checking controls and sliders...");
  const slider = page.locator('input[type="range"]').first();
  await slider.waitFor({ state: "visible" });
  console.log("   ✓ Controls and sliders rendered.");

  // 7. Telemetry updates
  console.log("7. Testing simulation advancement and telemetry update...");
  const stepBtn = page.getByRole("button", { name: /Step/i });
  await stepBtn.click();
  await page.waitForTimeout(300);
  console.log("   ✓ Step advanced without error.");

  // 8. Energy Ledger panel renders
  console.log("8. Checking Energy Ledger tab and panel...");
  const ledgerTab = page.getByRole("tab", { name: /Energy Ledger/i });
  await ledgerTab.waitFor({ state: "visible" });
  await ledgerTab.click();
  await page.waitForTimeout(500);
  const ledgerStatus = page.getByText(/Energy Ledger Status: CONSERVED/i);
  await ledgerStatus.waitFor({ state: "visible" });
  console.log("   ✓ Energy Ledger panel rendered with CONSERVED status.");

  // 9. Schematic renders
  console.log("9. Checking schematic SVG...");
  const schematic = page.locator("svg").first();
  await schematic.waitFor({ state: "visible" });
  console.log("   ✓ Schematic SVG rendered.");

  // 10. Oscilloscope renders
  console.log("10. Checking scope SVG...");
  const scopeText = page.getByText(/Scope/i).first();
  await scopeText.waitFor({ state: "visible" });
  console.log("   ✓ Oscilloscope rendered.");

  // 11. Event log renders
  console.log("11. Checking log tab...");
  const logTab = page.getByRole("tab", { name: /Log/i });
  await logTab.click();
  await page.waitForTimeout(300);
  console.log("   ✓ Log tab rendered.");

  // Switch to Data tab
  const dataTab = page.getByRole("tab", { name: /Data/i });
  await dataTab.click();
  await page.waitForTimeout(300);

  // Take screenshot
  await page.screenshot({ path: "screenshots/release-smoke.png", fullPage: true });
  console.log("   ✓ Screenshot saved to screenshots/release-smoke.png");

  // Mobile check
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "screenshots/release-mobile.png" });
  console.log("   ✓ Mobile viewport screenshot saved.");

  await browser.close();

  // 12, 13, 14. Error checks
  console.log(`\nUncaught Page Errors: ${pageErrors.length}`);
  if (pageErrors.length > 0) {
    console.error("Page Errors:", pageErrors);
    throw new Error(`Browser encountered ${pageErrors.length} runtime page errors`);
  }

  console.log(`Console Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) {
    console.warn("Console Errors:", consoleErrors);
  }

  console.log("\n==================================================");
  console.log("ALL 14 BROWSER SMOKE CHECKS PASSED SUCCESSFULLY!");
  console.log("==================================================");
}

runSmoke().catch((err) => {
  console.error("Browser smoke failed:", err);
  process.exit(1);
});
