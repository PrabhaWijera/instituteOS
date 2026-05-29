import { test, expect } from '@playwright/test';

/**
 * Parent E2E Flow
 * Requires: E2E_PARENT_EMAIL + E2E_PARENT_PASSWORD env vars
 */
test.describe('Parent Flow', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.E2E_PARENT_EMAIL, 'Requires E2E_PARENT_EMAIL');
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_PARENT_EMAIL!);
    await page.getByLabel('Password').fill(process.env.E2E_PARENT_PASSWORD!);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/children', { timeout: 10000 });
  });

  test('parent dashboard loads', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('parent can view Attendance page', async ({ page }) => {
    await page.getByRole('link', { name: /attendance/i }).click();
    await expect(page).toHaveURL(/children\/attendance/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('parent can view Fees page', async ({ page }) => {
    await page.getByRole('link', { name: /fees/i }).click();
    await expect(page).toHaveURL(/children\/fees/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('parent can view Classes page', async ({ page }) => {
    await page.getByRole('link', { name: /classes/i }).click();
    await expect(page).toHaveURL(/children\/classes/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('parent can view Notifications (only once in sidebar)', async ({ page }) => {
    const notifLinks = await page.getByRole('link', { name: /notifications/i }).count();
    expect(notifLinks).toBe(1);
  });

  test('parent cannot access admin Students page', async ({ page }) => {
    await page.goto('/students');
    await expect(page).not.toHaveURL(/^.*\/students$/);
  });

  test('parent cannot access Faculty page', async ({ page }) => {
    await page.goto('/faculty');
    await expect(page).not.toHaveURL(/^.*\/faculty$/);
  });
});
