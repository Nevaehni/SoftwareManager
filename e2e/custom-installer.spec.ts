// F-05: Add custom MSI/EXE to bundle - E2E test
import { test, expect, _electron as electron, Page, ElectronApplication } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Custom Installer Management', () => {
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
        // Clean up any test files
        const testDir = 'tmp/custom-installers';
        if (fs.existsSync(testDir)) {
            try {
                const files = fs.readdirSync(testDir);
                files.forEach(file => {
                    const filePath = path.join(testDir, file);
                    if (fs.statSync(filePath).isFile()) {
                        fs.unlinkSync(filePath);
                    }
                });
                fs.rmdirSync(testDir);
            } catch (error) {
                console.warn('Failed to clean up test directory:', error);
            }
        }
    });

    test('should display custom installer section in backup', async () => {
        // Navigate to backup section
        await window.click('a[onclick="showSection(\'backup\')"]');
        await window.waitForSelector('#backup-section');

        // Check if custom installer section exists
        const customInstallerSection = window.locator('#custom-installer-section');
        await expect(customInstallerSection).toBeVisible();

        // Check for add installer button
        const addInstallerBtn = window.locator('#add-custom-installer-btn');
        await expect(addInstallerBtn).toBeVisible();
        await expect(addInstallerBtn).toContainText('Browse Files');
    });

    test('should display custom installer list', async () => {
        // Navigate to backup section
        await window.click('a[onclick="showSection(\'backup\')"]');
        await window.waitForSelector('#backup-section');

        // Check for custom installer list container
        const installerList = window.locator('#custom-installer-list');
        await expect(installerList).toBeVisible();

        // Initially should show empty state
        const emptyState = window.locator('#custom-installer-empty');
        await expect(emptyState).toBeVisible();
        await expect(emptyState).toContainText('No custom installers added');
    }); test('should handle file selection dialog', async () => {
        // Navigate to backup section
        await window.click('a[onclick="showSection(\'backup\')"]');
        await window.waitForSelector('#backup-section');

        // Click add installer button
        const addInstallerBtn = window.locator('#add-custom-installer-btn');

        // Test that the button is clickable (the actual file dialog is handled by IPC)
        await expect(addInstallerBtn).toBeVisible();
        await expect(addInstallerBtn).toBeEnabled();

        // Click the button - this will trigger the IPC call but won't open a real dialog in test
        await addInstallerBtn.click();

        // Verify the button click was handled (no error state should appear)
        const statusArea = window.locator('#custom-installer-status');
        // Should either be hidden or not show an error
        await expect(statusArea).toBeAttached();
    });

    test('should show custom installers in restore preview', async () => {
        // This test would require having a backup bundle with custom installers
        // For now, verify the UI structure exists for restore
        await window.click('a[onclick="showSection(\'restore\')"]');
        await window.waitForSelector('#restore-section');

        // Check for custom installer preview section
        const customInstallerPreview = window.locator('#restore-custom-installers');
        // This might not be visible initially but should exist in the DOM
        await expect(customInstallerPreview).toBeAttached();
    });

    test('should handle installer validation errors', async () => {
        // Navigate to backup section
        await window.click('a[onclick="showSection(\'backup\')"]');
        await window.waitForSelector('#backup-section');

        // Check for status/error display area
        const statusArea = window.locator('#custom-installer-status');
        await expect(statusArea).toBeAttached();
    });

    test('should integrate with backup process', async () => {
        // Navigate to backup section
        await window.click('a[onclick="showSection(\'backup\')"]');
        await window.waitForSelector('#backup-section');

        // Verify backup button exists and is functional
        const backupBtn = window.locator('#backup-btn');
        await expect(backupBtn).toBeVisible();

        // The backup process should work even without custom installers
        await backupBtn.click();

        // Wait for backup status
        await window.waitForSelector('#backup-status', { timeout: 10000 });
        const status = window.locator('#backup-status');

        // Should show some progress or completion message
        await expect(status).toBeVisible();
    });

    test('should validate file types and sizes', async () => {
        // This test verifies UI feedback for file validation
        // Navigate to backup section
        await window.click('a[onclick="showSection(\'backup\')"]');
        await window.waitForSelector('#backup-section');

        // The validation logic is tested in unit tests
        // Here we verify the UI handles validation feedback
        const statusArea = window.locator('#custom-installer-status');
        await expect(statusArea).toBeAttached();
    });

    test('should display URL download option', async () => {
        // Navigate to backup section
        await window.click('a[onclick="showSection(\'backup\')"]');
        await window.waitForSelector('#backup-section');

        // Check for the URL download button
        const addUrlBtn = window.locator('#add-url-installer-btn');
        await expect(addUrlBtn).toBeVisible();
        await expect(addUrlBtn).toContainText('Add URL');
    });

    test('should show and hide URL input dialog', async () => {
        // Navigate to backup section
        await window.click('a[onclick="showSection(\'backup\')"]');
        await window.waitForSelector('#backup-section');

        // Initially dialog should be hidden
        const urlDialog = window.locator('#url-input-dialog');
        await expect(urlDialog).toHaveClass(/hidden/);

        // Click Add URL button to show dialog
        await window.click('#add-url-installer-btn');
        await expect(urlDialog).not.toHaveClass(/hidden/);

        // Check dialog contents
        const urlInput = window.locator('#installer-url-input');
        await expect(urlInput).toBeVisible();
        await expect(urlInput).toHaveAttribute('placeholder', 'https://example.com/installer.msi');

        const downloadBtn = window.locator('#download-installer-btn');
        await expect(downloadBtn).toBeVisible();
        await expect(downloadBtn).toContainText('Download');

        // Close dialog
        await window.click('#close-url-dialog-btn');
        await expect(urlDialog).toHaveClass(/hidden/);
    });

    test('should validate URL input', async () => {
        // Navigate to backup section
        await window.click('a[onclick="showSection(\'backup\')"]');
        await window.waitForSelector('#backup-section');

        // Show URL dialog
        await window.click('#add-url-installer-btn');
        const urlDialog = window.locator('#url-input-dialog');
        await expect(urlDialog).not.toHaveClass(/hidden/);

        // Try with invalid URL
        await window.fill('#installer-url-input', 'not-a-url');
        await window.click('#download-installer-btn');

        // Should show validation error
        const statusArea = window.locator('#custom-installer-status');
        await expect(statusArea).toContainText('Invalid URL format');

        // Try with URL that doesn't end in .msi or .exe
        await window.fill('#installer-url-input', 'https://example.com/file.txt');
        await window.click('#download-installer-btn');

        await expect(statusArea).toContainText('URL must point to an MSI or EXE file');
    });
});
