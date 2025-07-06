"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// F-03: Search & install packages (UI) - E2E test
const test_1 = require("@playwright/test");
describe('Package Search & Install UI', () => {
    test_1.test.beforeEach(async ({ page }) => {
        // Setup test environment
    });
    (0, test_1.test)('Search_displays_packages', async ({ page }) => {
        // Red phase: Test that search field shows package results
        await page.goto('/');
        const searchInput = page.locator('#package-search');
        await searchInput.fill('git');
        const searchResults = page.locator('#search-results');
        await (0, test_1.expect)(searchResults).toBeVisible();
        await (0, test_1.expect)(searchResults).toContainText('Git.Git');
    });
    (0, test_1.test)('Install_button_installs_package', async ({ page }) => {
        // Red phase: Test that clicking install actually installs package
        await page.goto('/');
        const searchInput = page.locator('#package-search');
        await searchInput.fill('git');
        const installBtn = page.locator('[data-package-id="Git.Git"] .install-btn');
        await installBtn.click();
        const status = page.locator('#install-status');
        await (0, test_1.expect)(status).toContainText('Installing Git.Git...');
        await (0, test_1.expect)(status).toContainText('✅ Git.Git installed successfully');
    });
});
//# sourceMappingURL=packages-search.e2e.js.map