import { test, expect } from '@playwright/test';

/**
 * Student E2E Flow
 * Requires: E2E_STUDENT_EMAIL + E2E_STUDENT_PASSWORD env vars pointing to a real student account
 */
test.describe('Student Flow', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!process.env.E2E_STUDENT_EMAIL, 'Requires E2E_STUDENT_EMAIL');
    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_STUDENT_EMAIL!);
    await page.getByLabel('Password').fill(process.env.E2E_STUDENT_PASSWORD!);
    await page.getByRole('button', { name: 'Sign In' }).click();
    await page.waitForURL('**/dashboard', { timeout: 10000 });
  });

  test('student dashboard loads', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /dashboard/i })).toBeVisible({ timeout: 8000 });
  });

  test('student can view My Classes', async ({ page }) => {
    await page.getByRole('link', { name: /my classes/i }).click();
    await expect(page).toHaveURL(/classes/);
    // Page should not error
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('student can view Mark Attendance page', async ({ page }) => {
    await page.getByRole('link', { name: /mark attendance/i }).click();
    await expect(page).toHaveURL(/attendance/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('student can view My Fees', async ({ page }) => {
    await page.getByRole('link', { name: /my fees/i }).click();
    await expect(page).toHaveURL(/payments/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('student can view Notifications', async ({ page }) => {
    await page.getByRole('link', { name: /notifications/i }).click();
    await expect(page).toHaveURL(/notifications/);
    await expect(page.locator('body')).not.toContainText('Something went wrong');
  });

  test('student can view My Profile / Settings', async ({ page }) => {
    await page.getByRole('link', { name: /my profile/i }).click();
    await expect(page).toHaveURL(/settings/);
    await expect(page.getByRole('heading', { name: /my profile/i })).toBeVisible();
  });

  test('student cannot navigate to admin pages', async ({ page }) => {
    await page.goto('/students');
    // Should redirect away or show 403
    await expect(page).not.toHaveURL(/\/students/);
  });

  test('student cannot navigate to faculty page', async ({ page }) => {
    await page.goto('/faculty');
    await expect(page).not.toHaveURL(/\/faculty/);
  });
});
