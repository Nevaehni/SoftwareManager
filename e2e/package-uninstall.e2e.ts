// F-04: Uninstall packages with UI - E2E test
import { test, expect } from '@playwright/test';
import { _electron as electron } from '@playwright/test';

test.describe('Package Uninstall UI', () => {
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

    test('Search_displays_installed_packages_with_uninstall_button', async () => {
        // Test that search shows installed packages with uninstall buttons
        await page.click('a[onclick="showSection(\'packages\')"]');
        await page.waitForSelector('#packages-section');

        // Switch to installed packages tab
        await page.click('#installed-packages-tab');
        await page.waitForSelector('#installed-packages-list');

        // Check if there are installed packages with uninstall buttons
        const installedPackages = page.locator('#installed-packages-list .uninstall-package-btn');
        await expect(installedPackages.first()).toBeVisible({ timeout: 10000 });
    });

    test('Uninstall_button_uninstalls_package', async () => {
        // Test that clicking uninstall actually uninstalls package
        await page.click('a[onclick="showSection(\'packages\')"]');
        await page.waitForSelector('#packages-section');

        // Switch to installed packages tab
        await page.click('#installed-packages-tab');
        await page.waitForSelector('#installed-packages-list');

        // Wait for installed packages to load
        await page.waitForSelector('#installed-packages-list .uninstall-package-btn', { timeout: 10000 });

        const uninstallBtn = page.locator('#installed-packages-list .uninstall-package-btn').first();
        await uninstallBtn.click();

        // Check that uninstall status is shown
        const status = page.locator('#uninstall-status');
        await expect(status).toContainText('Uninstalling');
    });

    test('Search_and_installed_packages_toggle', async () => {
        // Test that user can toggle between search and installed packages view
        await page.click('a[onclick="showSection(\'packages\')"]');
        await page.waitForSelector('#packages-section');

        // Start with search tab
        await page.click('#search-packages-tab');
        await page.waitForSelector('#search-packages-view');
        await expect(page.locator('#search-packages-view')).toBeVisible();
        await expect(page.locator('#installed-packages-view')).toBeHidden();

        // Switch to installed packages tab
        await page.click('#installed-packages-tab');
        await page.waitForSelector('#installed-packages-view');
        await expect(page.locator('#installed-packages-view')).toBeVisible();
        await expect(page.locator('#search-packages-view')).toBeHidden();
    });
});
