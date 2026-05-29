import { test, expect } from '@playwright/test';

/**
 * Institute Admin E2E Flow
 * Requires: E2E_ADMIN_EMAIL + E2E_ADMIN_PASSWORD env vars
 */
test.describe('Institute Admin Flow', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.E2E_ADMIN_EMAIL, 'Requires E2E_ADMIN_EMAIL');
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_ADMIN_EMAIL!);
    await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASSWORD!);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('admin dashboard loads with stats', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 8000 });
  });

  test('admin can view Faculty page', async ({ page }) => {
    await page.getByRole('link', { name: /faculty/i }).click();
    await expect(page).toHaveURL(/faculty/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('admin can view Students page', async ({ page }) => {
    await page.getByRole('link', { name: /students/i }).click();
    await expect(page).toHaveURL(/students/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('admin can view Classes page', async ({ page }) => {
    await page.getByRole('link', { name: /classes/i }).click();
    await expect(page).toHaveURL(/classes/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('admin can view Payments page', async ({ page }) => {
    await page.getByRole('link', { name: /payments/i }).click();
    await expect(page).toHaveURL(/payments/);
    // Admin should see table with columns
    await expect(page.getByRole('columnheader', { name: /student/i })).toBeVisible();
  });

  test('admin can view Settings page', async ({ page }) => {
    await page.getByRole('link', { name: /settings/i }).click();
    await expect(page).toHaveURL(/settings/);
    // Should show Campus Info section by default
    await expect(page.getByText(/campus information/i)).toBeVisible();
  });

  test('admin can switch between settings sections', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: /billing rules/i }).click();
    await expect(page.getByText(/billing cycle/i)).toBeVisible();
    await page.getByRole('button', { name: /notifications/i }).click();
    await expect(page.getByText(/absent alerts/i)).toBeVisible();
  });

  test('admin cannot access super admin Institutes page', async ({ page }) => {
    await page.goto('/institutes');
    // Should redirect away since that page is SUPER_ADMIN only
    await expect(page).not.toHaveURL(/^.*\/institutes$/);
  });
});
