/**
 * Basic UI Tests for Package List Scrolling Functionality
 * Tests the CSS classes and UI structure for scrolling without relying on actual package managers
 */

import { test, expect, _electron as electron, Page, ElectronApplication } from '@playwright/test';

test.describe('Package List Scrolling UI', () => {
    let electronApp: ElectronApplication;
    let window: Page;

    test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: ['dist/packages/electron/main/main.js']
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterAll(async () => {
        await electronApp.close();
    });

    test('should have proper CSS classes for scrolling on search results container', async () => {
        // Navigate to packages section
        await window.click('a[onclick="showSection(\'packages\')"]');
        await window.waitForSelector('#packages-section');

        // Ensure we're on the search tab
        await window.click('#search-packages-tab');
        await window.waitForSelector('#search-packages-view:not(.hidden)');

        // Check that the search results container has scrolling classes
        const searchResults = window.locator('#search-results');
        await expect(searchResults).toHaveClass(/package-list-container/);
        await expect(searchResults).toHaveClass(/overflow-y-auto/);
        await expect(searchResults).toHaveClass(/custom-scrollbar/);
        await expect(searchResults).toHaveClass(/pr-2/);

        // Initially should not have has-items class (empty state)
        await expect(searchResults).not.toHaveClass(/has-items/);

        // Verify the container has proper height constraints
        const containerHeight = await searchResults.evaluate((el: Element) => {
            const style = globalThis.getComputedStyle(el);
            return style.maxHeight;
        });

        // Should have a max-height set
        expect(containerHeight).not.toBe('none');
        expect(containerHeight).not.toBe('');
    });

    test('should have proper CSS classes for scrolling on installed packages container', async () => {
        // Navigate to packages section
        await window.click('a[onclick="showSection(\'packages\')"]');
        await window.waitForSelector('#packages-section');

        // Switch to installed packages tab
        await window.click('#installed-packages-tab');
        await window.waitForSelector('#installed-packages-view:not(.hidden)');

        // Check that the installed packages container has scrolling classes
        const packagesList = window.locator('#installed-packages-list');
        await expect(packagesList).toHaveClass(/package-list-container/);
        await expect(packagesList).toHaveClass(/overflow-y-auto/);
        await expect(packagesList).toHaveClass(/custom-scrollbar/);
        await expect(packagesList).toHaveClass(/pr-2/);

        // Initially should not have has-items class (empty state)
        await expect(packagesList).not.toHaveClass(/has-items/);

        // Verify the container has proper height constraints
        const containerHeight = await packagesList.evaluate((el: Element) => {
            const style = globalThis.getComputedStyle(el);
            return style.maxHeight;
        });

        // Should have a max-height set
        expect(containerHeight).not.toBe('none');
        expect(containerHeight).not.toBe('');
    });

    test('should show search input and placeholder text', async () => {
        // Navigate to packages section
        await window.click('a[onclick="showSection(\'packages\')"]');
        await window.waitForSelector('#packages-section');

        // Check search input is present
        const searchInput = window.locator('#package-search-input');
        await expect(searchInput).toBeVisible();
        await expect(searchInput).toHaveAttribute('placeholder', /package name/);

        // Check initial placeholder in results
        const searchResults = window.locator('#search-results');
        await expect(searchResults).toContainText('Start typing to search for packages');
    });

    test('should switch between package tabs correctly', async () => {
        // Navigate to packages section
        await window.click('a[onclick="showSection(\'packages\')"]');
        await window.waitForSelector('#packages-section');

        // Check search tab is initially active
        const searchTab = window.locator('#search-packages-tab');
        const installedTab = window.locator('#installed-packages-tab');

        await expect(searchTab).toHaveClass(/active/);
        await expect(installedTab).not.toHaveClass(/active/);

        // Switch to installed packages tab
        await installedTab.click();
        await window.waitForSelector('#installed-packages-view:not(.hidden)');

        // Check that the tabs switched correctly
        await expect(installedTab).toHaveClass(/active/);
        await expect(searchTab).not.toHaveClass(/active/);

        // Check installed packages view is visible
        const installedView = window.locator('#installed-packages-view');
        const searchView = window.locator('#search-packages-view');

        await expect(installedView).not.toHaveClass(/hidden/);
        await expect(searchView).toHaveClass(/hidden/);
    });

    test('should have proper scroll container structure', async () => {
        // Navigate to packages section
        await window.click('a[onclick="showSection(\'packages\')"]');
        await window.waitForSelector('#packages-section');

        // Test search results container structure
        const searchResults = window.locator('#search-results');

        // Check that it's a direct child of the gray container
        const searchContainer = searchResults.locator('..');
        await expect(searchContainer).toHaveClass(/bg-gray-50/);
        await expect(searchContainer).toHaveClass(/rounded-lg/);
        await expect(searchContainer).toHaveClass(/border-gray-200/);

        // Switch to installed packages and check same structure
        await window.click('#installed-packages-tab');
        const packagesList = window.locator('#installed-packages-list');

        const packagesContainer = packagesList.locator('..');
        await expect(packagesContainer).toHaveClass(/bg-gray-50/);
        await expect(packagesContainer).toHaveClass(/rounded-lg/);
        await expect(packagesContainer).toHaveClass(/border-gray-200/);
    });

    test('should display refresh button on installed packages tab', async () => {
        // Navigate to packages section
        await window.click('a[onclick="showSection(\'packages\')"]');
        await window.waitForSelector('#packages-section');

        // Switch to installed packages tab
        await window.click('#installed-packages-tab');
        await window.waitForSelector('#installed-packages-view:not(.hidden)');

        // Check refresh button is present and clickable
        const refreshBtn = window.locator('#refresh-installed-btn');
        await expect(refreshBtn).toBeVisible();
        await expect(refreshBtn).toContainText('Refresh');
        await expect(refreshBtn).toHaveClass(/bg-blue-600/);

        // Check that it contains the refresh icon
        const refreshIcon = refreshBtn.locator('svg');
        await expect(refreshIcon).toBeVisible();
    });
});
