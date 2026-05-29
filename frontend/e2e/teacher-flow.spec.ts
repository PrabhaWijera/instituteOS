import { test, expect } from '@playwright/test';

/**
 * Teacher E2E Flow
 * Requires: E2E_TEACHER_EMAIL + E2E_TEACHER_PASSWORD env vars
 */
test.describe('Teacher Flow', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.E2E_TEACHER_EMAIL, 'Requires E2E_TEACHER_EMAIL');
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_TEACHER_EMAIL!);
    await page.getByLabel('Password').fill(process.env.E2E_TEACHER_PASSWORD!);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('teacher dashboard loads', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 8000 });
  });

  test('teacher can view My Classes', async ({ page }) => {
    await page.getByRole('link', { name: /my classes/i }).click();
    await expect(page).toHaveURL(/classes/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('teacher can view Attendance page', async ({ page }) => {
    await page.getByRole('link', { name: /attendance/i }).click();
    await expect(page).toHaveURL(/attendance/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('teacher can view Reports', async ({ page }) => {
    await page.getByRole('link', { name: /reports/i }).click();
    await expect(page).toHaveURL(/reports/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('teacher can view Materials', async ({ page }) => {
    await page.getByRole('link', { name: /materials/i }).click();
    await expect(page).toHaveURL(/materials/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('teacher can view Notifications', async ({ page }) => {
    await page.getByRole('link', { name: /notifications/i }).click();
    await expect(page).toHaveURL(/notifications/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('teacher cannot access Students management page', async ({ page }) => {
    await page.goto('/students');
    // Should redirect or be denied
    await expect(page).not.toHaveURL(/^.*\/students$/);
  });

  test('teacher cannot access Payments admin page', async ({ page }) => {
    await page.goto('/payments');
    // Teacher should see a restricted view or be denied
    await expect(page.locator('body')).not.toContainText('Record');
  });
});
