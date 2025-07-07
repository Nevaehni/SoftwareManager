import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * E2E tests for F-08: Selective config backup (files/registry)
 * Tests the complete workflow of configuration backup functionality
 */
test.describe('Selective Config Backup E2E', () => {
    const testConfigDir = path.join(__dirname, '..', 'tmp', 'test-config');

    test.beforeEach(async ({ page }) => {
        // Create test config files
        if (!fs.existsSync(testConfigDir)) {
            fs.mkdirSync(testConfigDir, { recursive: true });
        }

        // Create sample config files for testing
        fs.writeFileSync(path.join(testConfigDir, 'app.config'), 'test config content');
        fs.writeFileSync(path.join(testConfigDir, 'settings.json'), '{"theme": "dark"}');
        // Navigate to the app - use built version
        await page.goto('file://' + path.join(__dirname, '..', 'dist', 'packages', 'electron', 'renderer', 'index.html'));
        await page.waitForLoadState('domcontentloaded');

        // Navigate to backup section
        await page.click('a[onclick="showSection(\'backup\')"]');
        await page.waitForSelector('#backup-section');
    });

    test.afterEach(async () => {
        // Clean up test files
        if (fs.existsSync(testConfigDir)) {
            fs.rmSync(testConfigDir, { recursive: true, force: true });
        }
    }); test('should display config picker section in backup UI', async ({ page }) => {
        // Verify config picker section exists
        const configSection = page.locator('#config-picker-section');
        await expect(configSection).toBeVisible();

        // Verify section header
        await expect(configSection.locator('h3')).toContainText('Configuration Files & Settings');

        // Verify add config button exists
        const addConfigBtn = page.locator('#add-config-path-btn');
        await expect(addConfigBtn).toBeVisible();
        await expect(addConfigBtn).toContainText('Add Files/Folders');
    }); test('should open config path modal when add button is clicked', async ({ page }) => {
        // Navigate to backup section
        await page.click('a[onclick="showSection(\'backup\')"]');
        await page.waitForTimeout(1000);

        // Click add config button
        await page.click('#add-config-path-btn');

        // Should show path input modal
        const modal = page.locator('#config-path-modal');
        await expect(modal).toBeVisible();

        // Should have input field
        const pathInput = page.locator('#config-path-input');
        await expect(pathInput).toBeVisible();

        // Should have confirm and cancel buttons
        const confirmBtn = page.locator('#confirm-config-path-btn');
        const cancelBtn = page.locator('#cancel-config-path-btn');
        await expect(confirmBtn).toBeVisible();
        await expect(cancelBtn).toBeVisible();
    }); test('should allow adding configuration file paths', async ({ page }) => {
        // Navigate to backup section
        await page.click('a[onclick="showSection(\'backup\')"]');
        await page.waitForTimeout(1000);

        // Click add config button
        await page.click('#add-config-path-btn');

        // Fill in test config path
        const pathInput = page.locator('#config-path-input');
        await pathInput.fill(testConfigDir);

        // Confirm adding the path
        await page.click('#confirm-config-path-btn');

        // Modal should be hidden
        const modal = page.locator('#config-path-modal');
        await expect(modal).not.toBeVisible();

        // Verify the path appears in the list
        const configList = page.locator('#config-paths-list');
        await expect(configList).toContainText(testConfigDir);

        // Empty state should be hidden
        const emptyState = page.locator('#config-paths-empty');
        await expect(emptyState).not.toBeVisible();
    });
});
