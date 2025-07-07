import { test, expect } from '@playwright/test';
import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';

test.describe('Debug Config Picker', () => {
    let electronApp: any;
    let window: any;

    test.beforeEach(async ({ page }) => {
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
        if (electronApp) {
            await electronApp.close();
        }
    });

    test('should debug config picker functionality', async () => {
        // Check if elements exist
        const configSection = window.locator('#config-picker-section');
        await expect(configSection).toBeVisible();

        const addButton = window.locator('#add-config-path-btn');
        await expect(addButton).toBeVisible();

        const modal = window.locator('#config-path-modal');
        await expect(modal).toBeAttached();

        // Check console logs
        const logs: string[] = [];
        window.on('console', (msg: any) => {
            logs.push(msg.text());
            console.log('Browser console:', msg.text());
        });

        // Click the button and wait
        await addButton.click();
        await window.waitForTimeout(2000);

        // Print all logs
        console.log('All console logs:', logs);

        // Check if modal is visible now
        const isModalVisible = await modal.isVisible();
        console.log('Is modal visible after click:', isModalVisible);

        // Check modal classes
        const modalClasses = await modal.getAttribute('class');
        console.log('Modal classes after click:', modalClasses);
    });
});
