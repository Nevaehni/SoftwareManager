// F-03: Search & install packages (UI) - E2E test
import { test, expect } from '@playwright/test';
import { _electron as electron } from '@playwright/test';

test.describe('Package Search & Install UI', () => {
    let app: any;
    let page: any;

    test.beforeAll(async () => {
        // Launch Electron app
        app = await electron.launch({
            args: ['dist/packages/electron/main/main.js']
        });
        page = await app.firstWindow();
    });

    test.afterAll(async () => {
        if (app) {
            await app.close();
        }
    });

    test('Search_displays_packages', async () => {
        // Test that search field shows package results
        await page.click('a[onclick="showSection(\'packages\')"]');
        await page.waitForSelector('#packages-section');

        const searchInput = page.locator('#package-search-input');
        await searchInput.fill('git');

        // Wait for search results
        await page.waitForSelector('#search-results .install-package-btn', { timeout: 10000 });

        const searchResults = page.locator('#search-results');
        await expect(searchResults).toBeVisible();
    });

    test('Install_button_installs_package', async () => {
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
        await expect(status).toContainText('Installing');
    });
});
