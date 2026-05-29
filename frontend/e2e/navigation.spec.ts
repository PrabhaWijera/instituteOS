import { test, expect } from '@playwright/test';

test.describe('Navigation & Pages', () => {
  test('should show landing page at root for unauthenticated users', async ({ page }) => {
    await page.goto('/');
    // Root shows the instituteOS landing page, not a redirect to /login
    await expect(page.locator('body')).toBeVisible();
    // Landing page has a Sign In link
    await expect(page.getByRole('link', { name: /Sign In/i }).first()).toBeVisible();
  });

  test('should redirect unauthenticated users from dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    // Should redirect to login
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect unauthenticated users from students page', async ({ page }) => {
    await page.goto('/students');
    await expect(page).toHaveURL(/login/);
  });

  test('should redirect unauthenticated users from settings page', async ({ page }) => {
    await page.goto('/settings');
    await expect(page).toHaveURL(/login/);
  });

  test('invite page should be accessible', async ({ page }) => {
    await page.goto('/invite');
    // Invite page should load (it may require a token query param)
    await expect(page.getByRole('heading')).toBeVisible();
  });
});
