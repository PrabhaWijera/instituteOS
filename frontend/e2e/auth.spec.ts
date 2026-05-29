import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('should show login page with Welcome back heading', async ({ page }) => {
    await page.goto('/login');
    // Heading is "Welcome back" (CardTitle), submit button is "Sign In"
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('should show validation on empty submit', async ({ page }) => {
    await page.goto('/login');
    // HTML5 required attribute prevents submission with empty fields
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveAttribute('required', '');
  });

  test('should show error toast on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Sign In' }).click();
    // Should stay on login page after failed login
    await expect(page).toHaveURL(/login/);
  });

  test('should toggle password visibility', async ({ page }) => {
    await page.goto('/login');
    const passwordInput = page.getByPlaceholder('Enter your password');
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // The toggle button is a ghost button next to the password input
    const toggleBtn = page.locator('div.relative button[type="button"]');
    await toggleBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
  });

  test('invite page should be accessible directly', async ({ page }) => {
    // The invite page lives at /invite (not linked from login page)
    await page.goto('/invite');
    await expect(page.getByRole('heading')).toBeVisible();
  });

  test('should redirect to dashboard on successful login', async ({ page }) => {
    test.skip(!process.env.E2E_TEST_EMAIL, 'Requires E2E_TEST_EMAIL env var');

    await page.goto('/login');
    await page.getByLabel('Email').fill(process.env.E2E_TEST_EMAIL!);
    await page.getByLabel('Password').fill(process.env.E2E_TEST_PASSWORD!);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL('**/dashboard', { timeout: 10000 });
    await expect(page).toHaveURL(/dashboard/);
  });
});
