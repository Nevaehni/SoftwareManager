import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * E2E tests for F-08: Selective config backup (files/registry)
 * Tests the complete workflow of configuration backup functionality
 */
test.describe('Selective Config Backup E2E', () => {
    const testConfigDir = path.join(__dirname, '..', 'tmp', 'test-config');
    let electronApp: any;
    let window: any;

    test.beforeEach(async ({ page }) => {
        // Create test config files
        if (!fs.existsSync(testConfigDir)) {
            fs.mkdirSync(testConfigDir, { recursive: true });
        }

        // Create sample config files for testing
        fs.writeFileSync(path.join(testConfigDir, 'app.config'), 'test config content');
        fs.writeFileSync(path.join(testConfigDir, 'settings.json'), '{"theme": "dark"}');

        // Launch Electron app
        const { _electron } = require('@playwright/test');

        electronApp = await _electron.launch({
            args: [path.join(__dirname, '..', 'dist', 'packages', 'electron', 'main', 'main.js')]
        });

        window = await electronApp.firstWindow();
        await window.waitForLoadState('networkidle');

        // Navigate to backup section
        await window.click('a[onclick="showSection(\'backup\')"]');
        await window.waitForTimeout(1000);
    });

    test.afterEach(async () => {
        // Clean up test files
        if (fs.existsSync(testConfigDir)) {
            fs.rmSync(testConfigDir, { recursive: true, force: true });
        }

        // Close Electron app
        if (electronApp) {
            await electronApp.close();
        }
    }); test('should display config picker section in backup UI', async () => {
        // Verify config picker section exists
        const configSection = window.locator('#config-picker-section');
        await expect(configSection).toBeVisible();

        // Verify section header
        await expect(configSection.locator('h3')).toContainText('Configuration Files & Settings');

        // Verify add config button exists
        const addConfigBtn = window.locator('#add-config-path-btn');
        await expect(addConfigBtn).toBeVisible();
        await expect(addConfigBtn).toContainText('Add Files/Folders');
    }); test('should allow adding configuration file paths', async () => {
        // Click add config button
        await window.click('#add-config-path-btn');

        // Should show path input dialog or file picker
        const pathInput = window.locator('#config-path-input');
        await expect(pathInput).toBeVisible();

        // Add a test config path
        await pathInput.fill(testConfigDir);

        // Confirm adding the path
        const confirmBtn = window.locator('#confirm-config-path-btn');
        await confirmBtn.click();

        // Verify the path appears in the list
        const configList = window.locator('#config-paths-list');
        await expect(configList).toContainText(testConfigDir);
    });

    test('should allow removing configuration paths', async ({ page }) => {
        // First add a config path
        await page.click('#add-config-path-btn');
        const pathInput = page.locator('#config-path-input');
        await pathInput.fill(testConfigDir);
        await page.click('#confirm-config-path-btn');

        // Verify path was added
        const configList = page.locator('#config-paths-list');
        await expect(configList).toContainText(testConfigDir);

        // Remove the path
        const removeBtn = page.locator('.config-path-item .remove-btn').first();
        await removeBtn.click();

        // Verify path was removed
        await expect(configList).not.toContainText(testConfigDir);
    });

    test('should validate config paths before adding', async ({ page }) => {
        // Try to add invalid path
        await page.click('#add-config-path-btn');
        const pathInput = page.locator('#config-path-input');
        await pathInput.fill('/invalid/nonexistent/path');
        await page.click('#confirm-config-path-btn');

        // Should show error message
        const errorMsg = page.locator('#config-path-error');
        await expect(errorMsg).toBeVisible();
        await expect(errorMsg).toContainText('Path does not exist');
    });

    test('should include config files in backup when paths are selected', async ({ page }) => {
        // Add config path
        await page.click('#add-config-path-btn');
        const pathInput = page.locator('#config-path-input');
        await pathInput.fill(testConfigDir);
        await page.click('#confirm-config-path-btn');

        // Start backup
        await page.click('#backup-btn');

        // Wait for backup completion
        await page.waitForSelector('#backup-status', { timeout: 10000 });
        const status = page.locator('#backup-status');
        await expect(status).toContainText('Backup created successfully');

        // Verify config files were included in backup
        const backupDir = path.join(__dirname, '..', 'tmp');
        const configBackupDir = path.join(backupDir, 'config-backup');

        // Should create config backup directory
        expect(fs.existsSync(configBackupDir)).toBe(true);

        // Should contain the test config files
        const backedUpConfig = path.join(configBackupDir, 'app.config');
        const backedUpSettings = path.join(configBackupDir, 'settings.json');
        expect(fs.existsSync(backedUpConfig)).toBe(true);
        expect(fs.existsSync(backedUpSettings)).toBe(true);
    });

    test('should show registry backup options on Windows', async ({ page }) => {
        // Registry section should be visible on Windows
        const registrySection = page.locator('#registry-backup-section');
        await expect(registrySection).toBeVisible();

        // Should have registry key input
        const registryInput = page.locator('#registry-key-input');
        await expect(registryInput).toBeVisible();

        // Should have add registry key button
        const addRegBtn = page.locator('#add-registry-key-btn');
        await expect(addRegBtn).toBeVisible();
    });

    test('should validate registry key format', async ({ page }) => {
        // Try to add invalid registry key
        const registryInput = page.locator('#registry-key-input');
        await registryInput.fill('invalid-registry-key');

        await page.click('#add-registry-key-btn');

        // Should show validation error
        const errorMsg = page.locator('#registry-key-error');
        await expect(errorMsg).toBeVisible();
        await expect(errorMsg).toContainText('Invalid registry key format');

        // Try valid format
        await registryInput.fill('HKEY_CURRENT_USER\\Software\\MyApp');
        await page.click('#add-registry-key-btn');

        // Should be added successfully
        const regList = page.locator('#registry-keys-list');
        await expect(regList).toContainText('HKEY_CURRENT_USER\\Software\\MyApp');
    });

    test('should preview config backup contents before creating backup', async ({ page }) => {
        // Add config path
        await page.click('#add-config-path-btn');
        const pathInput = page.locator('#config-path-input');
        await pathInput.fill(testConfigDir);
        await page.click('#confirm-config-path-btn');

        // Click preview button
        const previewBtn = page.locator('#preview-config-backup-btn');
        await previewBtn.click();

        // Should show preview dialog
        const previewDialog = page.locator('#config-backup-preview');
        await expect(previewDialog).toBeVisible();

        // Should list files to be backed up
        await expect(previewDialog).toContainText('app.config');
        await expect(previewDialog).toContainText('settings.json');

        // Should show estimated backup size
        const sizeInfo = page.locator('#backup-size-estimate');
        await expect(sizeInfo).toBeVisible();
    });
});
