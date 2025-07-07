/**
 * F-06: YAML/JSON Editor with Validation - E2E Test
 * Playwright test for the Monaco editor functionality
 */

import { test, expect, _electron as electron, Page, ElectronApplication } from '@playwright/test';

test.describe('YAML/JSON Editor with Validation', () => {
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
        // Navigate to Editor section
        await window.click('a[onclick="showSection(\'editor\')"]');
        await window.waitForSelector('#editor-section:not(.hidden)');
    }); test('Editor loads Monaco editor with syntax highlighting', async () => {
        // Check that the Monaco editor container is present
        const editorContainer = window.locator('#spec-editor-container');
        await expect(editorContainer).toBeVisible();

        // Wait for editor to initialize
        await window.waitForTimeout(2000);

        // Check that the language selector is set to YAML by default
        const languageSelect = window.locator('#editor-language');
        await expect(languageSelect).toHaveValue('yaml');

        // Check that the editor status shows ready
        const statusDiv = window.locator('#editor-status');
        await expect(statusDiv).toContainText('Ready');
    }); test('Language switcher changes editor mode', async () => {
        const languageSelect = window.locator('#editor-language');
        const statusDiv = window.locator('#editor-status');

        // Initially should be YAML
        await expect(languageSelect).toHaveValue('yaml');

        // Wait a bit for editor to initialize
        await window.waitForTimeout(1000);

        // Switch to JSON
        await languageSelect.selectOption('json');
        await expect(languageSelect).toHaveValue('json');

        // Wait longer for the status to update
        await window.waitForTimeout(2000);

        // Check that the editor status shows the change
        await expect(statusDiv).toContainText('JSON');
    });

    test('Load spec file button is present and functional', async () => {
        const loadButton = window.locator('#load-spec-btn');
        await expect(loadButton).toBeVisible();
        await expect(loadButton).toContainText('Load Spec');

        // Button should be clickable
        await expect(loadButton).toBeEnabled();
    });

    test('Save spec file button is present and functional', async () => {
        const saveButton = window.locator('#save-spec-btn');
        await expect(saveButton).toBeVisible();
        await expect(saveButton).toContainText('Save Spec');

        // Button should be clickable
        await expect(saveButton).toBeEnabled();
    }); test('Validate button is present and functional', async () => {
        const validateButton = window.locator('#validate-spec-btn');
        const validationErrors = window.locator('#validation-errors');

        await expect(validateButton).toBeVisible();
        await expect(validateButton).toContainText('Validate');

        // Button should be clickable
        await expect(validateButton).toBeEnabled();

        // Validation errors div should be present (even if empty)
        await expect(validationErrors).toBeAttached();
    }); test('Editor section layout is properly structured', async () => {
        // Check all main editor components are present
        await expect(window.locator('#editor-section')).toBeVisible();
        await expect(window.locator('#spec-editor-container')).toBeVisible();
        await expect(window.locator('#editor-language')).toBeVisible();
        await expect(window.locator('#load-spec-btn')).toBeVisible();
        await expect(window.locator('#save-spec-btn')).toBeVisible();
        await expect(window.locator('#validate-spec-btn')).toBeVisible();
        await expect(window.locator('#editor-status')).toBeVisible();
        await expect(window.locator('#validation-errors')).toBeAttached();
    });

    test('Editor controls are properly labeled', async () => {
        // Check language selector options
        const yamlOption = window.locator('#editor-language option[value="yaml"]');
        const jsonOption = window.locator('#editor-language option[value="json"]');

        await expect(yamlOption).toContainText('YAML');
        await expect(jsonOption).toContainText('JSON');

        // Check buttons have proper text
        await expect(window.locator('#load-spec-btn')).toContainText('Load Spec');
        await expect(window.locator('#save-spec-btn')).toContainText('Save Spec');
        await expect(window.locator('#validate-spec-btn')).toContainText('Validate');
    });

    test('Navigation to editor section works correctly', async () => {
        // Start from a different section (packages)
        await window.click('a[onclick="showSection(\'packages\')"]');
        await window.waitForSelector('#packages-section:not(.hidden)');

        // Navigate to editor
        await window.click('a[onclick="showSection(\'editor\')"]');
        await window.waitForSelector('#editor-section:not(.hidden)');

        // Verify editor section is visible and packages section is hidden
        await expect(window.locator('#editor-section')).toBeVisible();
        await expect(window.locator('#packages-section')).toHaveClass(/hidden/);
    });
});
