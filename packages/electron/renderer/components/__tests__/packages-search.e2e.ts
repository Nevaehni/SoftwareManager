// F-03: Search & install packages (UI) - E2E test
import { test, expect } from '@playwright/test';

describe('Package Search & Install UI', () => {
    test.beforeEach(async ({ page }) => {
        // Setup test environment
    });

    test('Search_displays_packages', async ({ page }) => {
        // Red phase: Test that search field shows package results
        await page.goto('/');

        const searchInput = page.locator('#package-search');
        await searchInput.fill('git');

        const searchResults = page.locator('#search-results');
        await expect(searchResults).toBeVisible();
        await expect(searchResults).toContainText('Git.Git');
    });

    test('Install_button_installs_package', async ({ page }) => {
        // Red phase: Test that clicking install actually installs package
        await page.goto('/');

        const searchInput = page.locator('#package-search');
        await searchInput.fill('git');

        const installBtn = page.locator('[data-package-id="Git.Git"] .install-btn');
        await installBtn.click();

        const status = page.locator('#install-status');
        await expect(status).toContainText('Installing Git.Git...');
        await expect(status).toContainText('✅ Git.Git installed successfully');
    });
});
