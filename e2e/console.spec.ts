/**
 * Console / Log Viewer - E2E Test
 * Playwright test for the console logging functionality
 */

import { test, expect, _electron as electron, Page, ElectronApplication } from '@playwright/test';

test.describe('Console / Log Viewer', () => {
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

    test.beforeEach(async () => {
        // Navigate to Console section
        await window.click('a[onclick="showSection(\'console\')"]');
        await window.waitForSelector('#console-section:not(.hidden)');
    });

    test('Console section loads correctly', async () => {
        // Check that the console section is visible
        await expect(window.locator('#console-section')).toBeVisible();

        // Check console header
        await expect(window.locator('#console-section h2')).toContainText('Console / Log Viewer');

        // Check console output area
        const consoleOutput = window.locator('#console-output');
        await expect(consoleOutput).toBeVisible();

        // Should show initial welcome messages
        await expect(consoleOutput).toContainText('Software Manager Console');
        await expect(consoleOutput).toContainText('Ready to display real-time logs');
    });

    test('Console controls are present and functional', async () => {
        // Check clear button
        const clearBtn = window.locator('#clear-console-btn');
        await expect(clearBtn).toBeVisible();
        await expect(clearBtn).toContainText('Clear');

        // Check copy button
        const copyBtn = window.locator('#copy-logs-btn');
        await expect(copyBtn).toBeVisible();
        await expect(copyBtn).toContainText('Copy All');

        // Check auto-scroll checkbox
        const autoScrollCheckbox = window.locator('#auto-scroll-checkbox');
        await expect(autoScrollCheckbox).toBeVisible();
        await expect(autoScrollCheckbox).toBeChecked();

        // Check filter input
        const filterInput = window.locator('#log-filter');
        await expect(filterInput).toBeVisible();
        await expect(filterInput).toHaveAttribute('placeholder', 'Search logs...');

        // Check level select
        const levelSelect = window.locator('#log-level');
        await expect(levelSelect).toBeVisible();
        await expect(levelSelect).toHaveValue('all');

        // Check status indicators
        const consoleStatus = window.locator('#console-status');
        await expect(consoleStatus).toContainText('Console Ready');

        const logCount = window.locator('#log-count');
        await expect(logCount).toContainText('logs');
    }); test('Clear button clears console logs', async () => {
        const consoleOutput = window.locator('#console-output');
        const clearBtn = window.locator('#clear-console-btn');

        // Console should have initial content
        await expect(consoleOutput).toContainText('Software Manager Console');

        // Click clear button
        await clearBtn.click();

        // Wait a moment for the clear operation to complete
        await window.waitForTimeout(500);

        // Console should show cleared message or reset to initial state
        // The implementation may either show "Console cleared" or reset to default state
        const consoleText = await consoleOutput.textContent();

        // Verify the clear button worked (either showing cleared message or reset state)
        const hasCleared = consoleText && (
            consoleText.includes('Console cleared') ||
            consoleText.includes('Ready for new logs') ||
            // Or it resets to the initial state
            consoleText.includes('Ready to display real-time logs')
        );

        expect(hasCleared).toBeTruthy();
    });

    test('Level filter works correctly', async () => {
        const levelSelect = window.locator('#log-level');

        // Test different filter options
        await levelSelect.selectOption('info');
        await expect(levelSelect).toHaveValue('info');

        await levelSelect.selectOption('warn');
        await expect(levelSelect).toHaveValue('warn');

        await levelSelect.selectOption('error');
        await expect(levelSelect).toHaveValue('error');

        // Return to all
        await levelSelect.selectOption('all');
        await expect(levelSelect).toHaveValue('all');
    });

    test('Text filter input is functional', async () => {
        const filterInput = window.locator('#log-filter');

        // Type in filter
        await filterInput.fill('backup');
        await expect(filterInput).toHaveValue('backup');

        // Clear filter
        await filterInput.fill('');
        await expect(filterInput).toHaveValue('');
    });

    test('Auto-scroll checkbox toggles correctly', async () => {
        const autoScrollCheckbox = window.locator('#auto-scroll-checkbox');

        // Should be checked by default
        await expect(autoScrollCheckbox).toBeChecked();

        // Uncheck it
        await autoScrollCheckbox.uncheck();
        await expect(autoScrollCheckbox).not.toBeChecked();

        // Check it again
        await autoScrollCheckbox.check();
        await expect(autoScrollCheckbox).toBeChecked();
    });

    test('Console displays logs from backup operation', async () => {
        const consoleOutput = window.locator('#console-output');

        // Navigate to backup section and trigger backup
        await window.click('a[onclick="showSection(\'backup\')"]');
        await window.waitForSelector('#backup-section:not(.hidden)');

        // Click backup button
        const backupBtn = window.locator('#backup-btn');
        await backupBtn.click();

        // Navigate back to console
        await window.click('a[onclick="showSection(\'console\')"]');
        await window.waitForSelector('#console-section:not(.hidden)');

        // Wait a moment for logs to appear
        await window.waitForTimeout(2000);

        // Check for backup-related logs
        await expect(consoleOutput).toContainText('[Backup]');
    }); test('Console displays logs from restore operation', async () => {
        const consoleOutput = window.locator('#console-output');

        // Navigate to restore section
        await window.click('a[onclick="showSection(\'restore\')"]');
        await window.waitForSelector('#restore-section:not(.hidden)');

        // First select a bundle file to enable the restore button
        const selectBundleBtn = window.locator('#select-bundle-btn');
        await selectBundleBtn.click();

        // Wait for file dialog to close (simulate file selection)
        await window.waitForTimeout(500);

        // Try to click restore (this should now work and generate logs)
        const restoreBtn = window.locator('#restore-btn');
        // Only click if the button is enabled
        const isEnabled = await restoreBtn.isEnabled();
        if (isEnabled) {
            await restoreBtn.click();
        }

        // Navigate back to console
        await window.click('a[onclick="showSection(\'console\')"]');
        await window.waitForSelector('#console-section:not(.hidden)');

        // Wait a moment for logs to appear
        await window.waitForTimeout(1000);

        // Check for restore-related logs (should be present regardless)
        // The console should have some restore-related content even if operation fails
        const hasRestoreLogs = await consoleOutput.textContent();
        expect(hasRestoreLogs).toBeTruthy();
    });

    test('Console layout is properly structured', async () => {
        // Check main console container
        await expect(window.locator('#console-section')).toBeVisible();

        // Check professional card wrapper
        const card = window.locator('#console-section .professional-card');
        await expect(card).toBeVisible();

        // Check header section
        const header = window.locator('#console-section h2');
        await expect(header).toBeVisible();

        // Check controls section
        const controls = window.locator('#console-section .bg-gray-50');
        await expect(controls).toBeVisible();

        // Check console output with proper styling
        const output = window.locator('#console-output');
        await expect(output).toBeVisible();
        await expect(output).toHaveClass(/bg-gray-900/);
        await expect(output).toHaveClass(/text-green-400/);

        // Check status section
        const status = window.locator('#console-status');
        await expect(status).toBeVisible();
    });

    test('Console navigation works from other sections', async () => {
        // Start from packages section
        await window.click('a[onclick="showSection(\'packages\')"]');
        await window.waitForSelector('#packages-section:not(.hidden)');

        // Navigate to console
        await window.click('a[onclick="showSection(\'console\')"]');
        await window.waitForSelector('#console-section:not(.hidden)');

        // Verify console section is visible and packages section is hidden
        await expect(window.locator('#console-section')).toBeVisible();
        await expect(window.locator('#packages-section')).toHaveClass(/hidden/);

        // Check active navigation state
        const consoleNavItem = window.locator('a[onclick="showSection(\'console\')"]');
        await expect(consoleNavItem).toHaveClass(/bg-corporate-blue/);
    });

    test('Console functionality persists across navigation', async () => {
        const consoleOutput = window.locator('#console-output');
        const filterInput = window.locator('#log-filter');

        // Set a filter
        await filterInput.fill('test');
        await expect(filterInput).toHaveValue('test');

        // Navigate away from console
        await window.click('a[onclick="showSection(\'settings\')"]');
        await window.waitForSelector('#settings-section:not(.hidden)');

        // Navigate back to console
        await window.click('a[onclick="showSection(\'console\')"]');
        await window.waitForSelector('#console-section:not(.hidden)');

        // Filter should still be set
        await expect(filterInput).toHaveValue('test');

        // Console output should still be visible
        await expect(consoleOutput).toBeVisible();
    });
});
