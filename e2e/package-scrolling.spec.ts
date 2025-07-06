/**
 * E2E Tests for Package List Scrolling Functionality
 * Tests that package lists have proper scrolling when many packages are displayed
 */

import { test, expect, _electron as electron, Page, ElectronApplication } from '@playwright/test';

test.describe('Package List Scrolling', () => {
    let electronApp: ElectronApplication;
    let window: Page; test.beforeAll(async () => {
        electronApp = await electron.launch({
            args: ['dist/packages/electron/main/main.js']
        });
        window = await electronApp.firstWindow();
        await window.waitForLoadState('domcontentloaded');
    });

    test.afterAll(async () => {
        await electronApp.close();
    });

    test('should show scrollable search results when many packages are found', async () => {
        // Navigate to packages section
        await window.click('a[onclick="showSection(\'packages\')"]');
        await window.waitForSelector('#packages-section');

        // Ensure we're on the search tab
        await window.click('#search-packages-tab');
        await window.waitForSelector('#search-packages-view:not(.hidden)');

        // Search for a term that will return many results
        const searchInput = window.locator('#package-search-input');
        await searchInput.fill('microsoft');

        // Wait for search results
        await window.waitForSelector('#search-results .bg-white', { timeout: 10000 });

        // Check that the search results container has scrolling classes
        const searchResults = window.locator('#search-results');
        await expect(searchResults).toHaveClass(/package-list-container/);
        await expect(searchResults).toHaveClass(/overflow-y-auto/);
        await expect(searchResults).toHaveClass(/custom-scrollbar/);

        // Check that has-items class is added when results are present
        await expect(searchResults).toHaveClass(/has-items/);        // Verify the container has proper height constraints
        const containerHeight = await searchResults.evaluate((el: Element) => {
            const style = globalThis.getComputedStyle(el);
            return style.maxHeight;
        });

        // Should have a max-height set (either from CSS class or computed)
        expect(containerHeight).not.toBe('none');
        // Check if scrollbar is visible when content overflows
        const isScrollable = await searchResults.evaluate((el: Element) => {
            return el.scrollHeight > el.clientHeight;
        });

        // If there are enough results, scrolling should be available
        const resultCount = await window.locator('#search-results .bg-white').count();
        if (resultCount > 5) {
            expect(isScrollable).toBe(true);
        }
    });

    test('should show scrollable installed packages list', async () => {
        // Navigate to packages section
        await window.click('a[onclick="showSection(\'packages\')"]');
        await window.waitForSelector('#packages-section');

        // Switch to installed packages tab
        await window.click('#installed-packages-tab');
        await window.waitForSelector('#installed-packages-view:not(.hidden)');

        // Click refresh to load installed packages
        await window.click('#refresh-installed-btn');

        // Wait for the list to load (either packages or "no packages" message)
        await window.waitForSelector('#installed-packages-list p, #installed-packages-list .bg-white', { timeout: 10000 });

        // Check that the installed packages container has scrolling classes
        const packagesList = window.locator('#installed-packages-list');
        await expect(packagesList).toHaveClass(/package-list-container/);
        await expect(packagesList).toHaveClass(/overflow-y-auto/);
        await expect(packagesList).toHaveClass(/custom-scrollbar/);

        // Check if there are installed packages
        const packageItems = window.locator('#installed-packages-list .bg-white');
        const packageCount = await packageItems.count();

        if (packageCount > 0) {
            // If packages are found, has-items class should be present
            await expect(packagesList).toHaveClass(/has-items/);
            // Check scrolling behavior if there are many packages
            if (packageCount > 5) {
                const isScrollable = await packagesList.evaluate((el: Element) => {
                    return el.scrollHeight > el.clientHeight;
                });
                expect(isScrollable).toBe(true);
            }
        } else {
            // If no packages, has-items class should not be present
            await expect(packagesList).not.toHaveClass(/has-items/);
        }
    });

    test('should handle scroll interactions correctly', async () => {
        // Navigate to packages section
        await window.click('a[onclick="showSection(\'packages\')"]');
        await window.waitForSelector('#packages-section');

        // Search for packages
        const searchInput = window.locator('#package-search-input');
        await searchInput.fill('node');

        // Wait for results
        await window.waitForSelector('#search-results .bg-white', { timeout: 10000 });

        const searchResults = window.locator('#search-results');
        const resultCount = await window.locator('#search-results .bg-white').count();        // If there are enough results to trigger scrolling
        if (resultCount > 3) {
            // Get initial scroll position
            const initialScrollTop = await searchResults.evaluate((el: Element) => el.scrollTop);

            // Scroll down
            await searchResults.evaluate((el: Element) => el.scrollTo(0, 100));

            // Check that scroll position changed
            const newScrollTop = await searchResults.evaluate((el: Element) => el.scrollTop);
            expect(newScrollTop).toBeGreaterThan(initialScrollTop);

            // Scroll back to top
            await searchResults.evaluate((el: Element) => el.scrollTo(0, 0));

            // Verify we're back at the top
            const finalScrollTop = await searchResults.evaluate((el: Element) => el.scrollTop);
            expect(finalScrollTop).toBe(0);
        }
    });

    test('should show proper empty states without scrolling', async () => {
        // Navigate to packages section
        await window.click('a[onclick="showSection(\'packages\')"]');
        await window.waitForSelector('#packages-section');

        // Clear search input to show empty state
        const searchInput = window.locator('#package-search-input');
        await searchInput.fill('');

        // Wait for empty state
        await window.waitForSelector('#search-results p:has-text("Start typing to search")');

        // Check that has-items class is not present for empty state
        const searchResults = window.locator('#search-results');
        await expect(searchResults).not.toHaveClass(/has-items/);

        // Switch to installed packages and check empty state
        await window.click('#installed-packages-tab');
        await window.waitForSelector('#installed-packages-view:not(.hidden)');

        const packagesList = window.locator('#installed-packages-list');

        // Should start without has-items class
        await expect(packagesList).not.toHaveClass(/has-items/);
    });

    test('should maintain responsive height constraints', async () => {
        // Navigate to packages section
        await window.click('a[onclick="showSection(\'packages\')"]');
        await window.waitForSelector('#packages-section');

        // Check search results container
        const searchResults = window.locator('#search-results');        // Verify CSS custom property is applied
        const maxHeight = await searchResults.evaluate((el: Element) => {
            const computed = globalThis.getComputedStyle(el);
            return computed.maxHeight;
        });

        // Should have either a fixed max-height or calc() value
        expect(maxHeight).not.toBe('none');
        expect(maxHeight).not.toBe('');

        // Switch to installed packages and check the same
        await window.click('#installed-packages-tab');
        const packagesList = window.locator('#installed-packages-list'); const installedMaxHeight = await packagesList.evaluate((el: Element) => {
            const computed = globalThis.getComputedStyle(el);
            return computed.maxHeight;
        });

        expect(installedMaxHeight).not.toBe('none');
        expect(installedMaxHeight).not.toBe('');
    });
});
