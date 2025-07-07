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
    }); test('Search_displays_installed_packages_with_uninstall_button', async () => {
        // Test that search shows installed packages with uninstall buttons
        await page.click('a[onclick="showSection(\'packages\')"]');
        await page.waitForSelector('#packages-section');

        // Switch to installed packages tab - should exist
        await expect(page.locator('#installed-packages-tab')).toBeVisible();
        await page.click('#installed-packages-tab');

        // Wait for installed packages view to be visible
        await page.waitForSelector('#installed-packages-view:not(.hidden)');
        await expect(page.locator('#installed-packages-view')).toBeVisible();

        // Click refresh to load packages
        await page.click('#refresh-installed-btn');

        // Wait for either packages to load or an error message
        await page.waitForTimeout(5000); // Give time for packages to load

        // Check if there are packages with uninstall buttons OR a "no packages" message
        const uninstallButtons = page.locator('#installed-packages-list .uninstall-package-btn');
        const noPackagesMsg = page.locator('#installed-packages-list:has-text("No packages found")');

        // At least one should be visible - either packages with uninstall buttons, or no packages message
        await expect(uninstallButtons.first().or(noPackagesMsg)).toBeVisible({ timeout: 10000 });
    }); test.skip('Uninstall_button_uninstalls_package - SKIPPED TO PREVENT ACTUAL UNINSTALLATION', async () => {
        // DANGER: This test was skipped because it performs actual package uninstallation
        // which can delete important software like Docker and Git from the system.
        // 
        // To safely test uninstall functionality:
        // 1. Use unit tests with mocked adapters instead  
        // 2. Or create a test environment with dummy packages
        // 3. Or mock the electron app's uninstall functionality

        // Original test code commented out to prevent accidental execution:
        /*
        await page.click('a[onclick="showSection(\'packages\')"]');
        await page.waitForSelector('#packages-section');

        // Switch to installed packages tab
        await expect(page.locator('#installed-packages-tab')).toBeVisible();
        await page.click('#installed-packages-tab');
        await page.waitForSelector('#installed-packages-view:not(.hidden)');

        // Click refresh to load packages
        await page.click('#refresh-installed-btn');
        await page.waitForTimeout(3000);

        // Check if there are any packages to uninstall
        const uninstallBtns = page.locator('#installed-packages-list .uninstall-package-btn');
        const count = await uninstallBtns.count();

        if (count > 0) {
            // If packages exist, test uninstall functionality
            await uninstallBtns.first().click();

            // Check that uninstall status is shown
            const status = page.locator('#uninstall-status');
            await expect(status).toContainText('Uninstalling');
        } else {
            // If no packages, that's also a valid state - just verify the UI structure exists
            await expect(page.locator('#installed-packages-list')).toBeVisible();
            console.log('No packages available for uninstall test');
        }
        */
    }); test('Search_and_installed_packages_toggle', async () => {
        // Test that user can toggle between search and installed packages view
        await page.click('a[onclick="showSection(\'packages\')"]');
        await page.waitForSelector('#packages-section');

        // Start with search tab (should be default)
        await expect(page.locator('#search-packages-tab')).toBeVisible();
        await page.click('#search-packages-tab');
        await page.waitForSelector('#search-packages-view:not(.hidden)', { timeout: 5000 });
        await expect(page.locator('#search-packages-view')).toBeVisible();
        await expect(page.locator('#installed-packages-view')).toBeHidden();

        // Switch to installed packages tab
        await expect(page.locator('#installed-packages-tab')).toBeVisible();
        await page.click('#installed-packages-tab');
        await page.waitForSelector('#installed-packages-view:not(.hidden)', { timeout: 5000 });
        await expect(page.locator('#installed-packages-view')).toBeVisible();
        await expect(page.locator('#search-packages-view')).toBeHidden();
    });
});
