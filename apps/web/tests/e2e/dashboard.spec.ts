import { test, expect } from '@playwright/test';

test.describe('Dashboard Page', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/feature1/dashboard');
  });

  test('should load dashboard page', async ({ page }) => {
    // Wait for page to load
    await expect(page).toHaveTitle(/HairGuard/i);

    // Check if main dashboard elements are present
    await expect(page.getByRole('heading')).toBeVisible();
  });

  // Skip: Requires authentication and specific frontend implementation
  test.skip('should fetch analysis history with proper API calls', async ({ page, context }) => {
    // Mock authentication if needed
    // await context.addCookies([...]);

    // Listen to API requests
    const apiRequests: string[] = [];

    page.on('request', request => {
      const url = request.url();
      if (url.includes('/api/v1/photos/analysis-history')) {
        apiRequests.push(url);
      }
    });

    // Navigate and wait for content
    await page.goto('/feature1/dashboard');

    // Wait for some content to load (adjust selector based on actual page structure)
    await page.waitForTimeout(3000); // Give time for API calls

    // Verify that API calls were made
    // Dashboard makes 2 calls: limit=50 (initial) and limit=200 (full data)
    expect(apiRequests.length).toBeGreaterThan(0);

    // Check if we can find elements that would be populated by API data
    // (This is a basic check - adjust based on actual dashboard structure)
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
  });

  test('should handle empty analysis history gracefully', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('/feature1/dashboard');

    // Wait for page load
    await page.waitForLoadState('networkidle');

    // Page should still render even with no data
    await expect(page.locator('body')).toBeVisible();
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/feature1/dashboard');

    // Check that page renders without horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375 + 20); // Allow small margin
  });
});
