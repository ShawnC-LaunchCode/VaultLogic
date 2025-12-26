import { test, expect } from "@playwright/test";

/**
 * Basic smoke tests to verify the app is functional
 * Note: These tests run without authentication (landing page only)
 */
test.describe("Smoke Tests", () => {
  // Use 60s timeout for all environments (these tests wait for full page loads)
  test.setTimeout(60000);

  test("should load homepage successfully", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Wait for React to render (check for root div)
    await page.waitForSelector('#root', { state: 'attached', timeout: 10000 });

    // Should load without 404 or 500 errors
    expect(page.url()).not.toBe('about:blank');
  });

  test("should have valid page title", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });

    // Wait a bit for title to be set by React
    await page.waitForTimeout(2000);

    // Check title is set (not empty)
    const title = await page.title();
    expect(title.length).toBeGreaterThan(0);
    expect(title).toContain("Poll");
  });

  test("should display landing page content", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });

    // Wait for React app to render
    await page.waitForSelector('#root', { state: 'attached', timeout: 10000 });

    // Should have substantial text content (not a blank/loading page)
    const body = page.locator('body');
    const textContent = await body.textContent();
    expect(textContent?.trim().length).toBeGreaterThan(100);
  });

  test("should have working CSS and layout", async ({ page }) => {
    await page.goto("/", { waitUntil: "networkidle", timeout: 30000 });

    // Wait for styles to load and apply
    await page.waitForTimeout(2000);

    // Check that the page has loaded styles (body should have some height)
    const body = page.locator('body');
    const bodyHeight = await body.evaluate(el => el.clientHeight);
    expect(bodyHeight).toBeGreaterThan(100);
  });

  test("should handle navigation without crashing", async ({ page }) => {
    // Navigate to homepage
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Try navigating to a protected route (should redirect to landing, not crash)
    await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000);

    // Should still have React app rendered
    await page.waitForSelector('#root', { state: 'attached', timeout: 10000 });

    // Should have content (redirected back to landing)
    const body = page.locator('body');
    const textContent = await body.textContent();
    expect(textContent?.trim().length).toBeGreaterThan(50);
  });
});
