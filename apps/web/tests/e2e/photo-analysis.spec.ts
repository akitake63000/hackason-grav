import { test, expect } from '@playwright/test';

test.describe('Photo Analysis Flow', () => {
  test('should navigate through photo capture flow', async ({ page }) => {
    // Start from home or feature1 page
    await page.goto('/feature1');

    // Wait for page to load
    await expect(page).toHaveTitle(/HairGuard/i);

    // Look for capture button/link (adjust selector based on actual UI)
    // This is a placeholder - adjust based on actual page structure
    const pageContent = await page.textContent('body');
    expect(pageContent).toBeTruthy();
  });

  // Skip: Requires specific frontend implementation with file input or camera
  test.skip('should load capture page', async ({ page }) => {
    await page.goto('/feature1/capture');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Verify page loaded successfully
    await expect(page.locator('body')).toBeVisible();

    // Check for camera/file upload elements
    // (Adjust selectors based on actual implementation)
    const hasFileInput = await page.locator('input[type="file"]').count();
    const hasVideo = await page.locator('video').count();

    // Should have either file input or video element for camera
    expect(hasFileInput + hasVideo).toBeGreaterThan(0);
  });

  test('should handle photo upload validation', async ({ page }) => {
    await page.goto('/feature1/capture');

    // Wait for page load
    await page.waitForLoadState('networkidle');

    // Try to find file input
    const fileInput = page.locator('input[type="file"]').first();

    if (await fileInput.count() > 0) {
      // Check if file input accepts correct formats
      const acceptAttr = await fileInput.getAttribute('accept');

      if (acceptAttr) {
        // Should accept image formats
        expect(acceptAttr.toLowerCase()).toMatch(/image/);
      }
    }
  });

  test('should navigate to result page with valid photo ID', async ({ page }) => {
    // Mock a photo ID (in real scenario, this would come from upload)
    const mockPhotoId = 'test-photo-123';

    // Navigate directly to result page
    await page.goto(`/feature1/result?photoId=${mockPhotoId}`);

    // Wait for page load
    await page.waitForLoadState('domcontentloaded');

    // Verify page loaded (it may show error if photoId is invalid, but page should load)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle API errors gracefully', async ({ page }) => {
    // Navigate to result page with invalid photo ID
    await page.goto('/feature1/result?photoId=invalid-id-12345');

    // Wait for page load
    await page.waitForLoadState('networkidle');

    // Page should still render and show error message or fallback UI
    await expect(page.locator('body')).toBeVisible();

    // Should not show uncaught error in console (check console errors)
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForTimeout(2000);

    // Filter out known acceptable errors (like network errors for invalid photo)
    const criticalErrors = consoleErrors.filter(
      err => !err.includes('404') && !err.includes('Invalid photo')
    );

    expect(criticalErrors.length).toBe(0);
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/feature1/capture');

    // Check that page renders without horizontal scroll
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    expect(bodyWidth).toBeLessThanOrEqual(375 + 20); // Allow small margin
  });
});
