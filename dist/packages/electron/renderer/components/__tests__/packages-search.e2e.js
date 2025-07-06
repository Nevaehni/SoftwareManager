"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// F-03: Search & install packages (UI) - E2E test
const test_1 = require("@playwright/test");
const test_2 = require("@playwright/test");
test_1.test.describe('Package Search & Install UI', () => {
    let app;
    let page;
    test_1.test.beforeAll(async () => {
        // Launch Electron app
        app = await test_2._electron.launch({
            args: ['dist/packages/electron/main/main.js']
        });
        page = await app.firstWindow();
    });
    test_1.test.afterAll(async () => {
        if (app) {
            await app.close();
        }
    });
    (0, test_1.test)('Search_displays_packages', async () => {
        // Test that search field shows package results
        await page.click('a[onclick="showSection(\'packages\')"]');
        await page.waitForSelector('#packages-section');
        const searchInput = page.locator('#package-search-input');
        await searchInput.fill('git');
        // Wait for search results
        await page.waitForSelector('#search-results .install-package-btn', { timeout: 10000 });
        const searchResults = page.locator('#search-results');
        await (0, test_1.expect)(searchResults).toBeVisible();
    });
    (0, test_1.test)('Install_button_installs_package', async () => {
        // Test that clicking install actually installs package
        await page.click('a[onclick="showSection(\'packages\')"]');
        await page.waitForSelector('#packages-section');
        const searchInput = page.locator('#package-search-input');
        await searchInput.fill('git');
        // Wait for search results
        await page.waitForSelector('#search-results .install-package-btn', { timeout: 10000 });
        const installBtn = page.locator('#search-results .install-package-btn').first();
        await installBtn.click();
        const status = page.locator('#search-status');
        await (0, test_1.expect)(status).toContainText('Installing');
    });
});
//# sourceMappingURL=packages-search.e2e.js.map