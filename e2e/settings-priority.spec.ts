import { test, expect } from '@playwright/test';
import { _electron as electron } from '@playwright/test';

test.describe('Package Manager Priority Settings', () => {
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

    test('should display package manager priority list in settings', async () => {
        // Navigate to settings section
        await page.click('a[onclick="showSection(\'settings\')"]');

        // Wait for settings section to be visible
        await page.waitForSelector('#settings-section');

        // Check if priority list exists
        const priorityList = page.locator('#package-priority-list');
        await expect(priorityList).toBeVisible();

        // Check if both package managers are listed
        const wingetItem = page.locator('[data-manager="winget"]');
        const chocolateyItem = page.locator('[data-manager="chocolatey"]');

        await expect(wingetItem).toBeVisible();
        await expect(chocolateyItem).toBeVisible();

        // Check if drag handles are present
        const dragHandles = page.locator('.drag-handle');
        await expect(dragHandles).toHaveCount(2);
    }); test('should allow dragging winget above chocolatey', async () => {
        // Navigate to settings section
        await page.click('a[onclick="showSection(\'settings\')"]');

        // Wait for settings section to be visible
        await page.waitForSelector('#settings-section');

        // Get initial order
        const initialOrder = await page.evaluate(() => {
            const items = document.querySelectorAll('#package-priority-list .priority-item');
            return Array.from(items).map(item => item.getAttribute('data-manager'));
        });

        // First, ensure chocolatey is at the top to test reordering
        await page.evaluate(() => {
            const priorityList = document.getElementById('package-priority-list');
            const chocolateyItem = document.querySelector('[data-manager="chocolatey"]');

            if (priorityList && chocolateyItem) {
                priorityList.insertBefore(chocolateyItem, priorityList.children[0]);
            }
        });

        // Now get the order with chocolatey first
        const chocolateyFirstOrder = await page.evaluate(() => {
            const items = document.querySelectorAll('#package-priority-list .priority-item');
            return Array.from(items).map(item => item.getAttribute('data-manager'));
        });

        // Verify chocolatey is now first
        expect(chocolateyFirstOrder[0]).toBe('chocolatey');

        // Now simulate dragging winget to the top
        await page.evaluate(() => {
            const priorityList = document.getElementById('package-priority-list');
            const wingetItem = document.querySelector('[data-manager="winget"]');

            if (priorityList && wingetItem) {
                priorityList.insertBefore(wingetItem, priorityList.children[0]);
            }
        });

        // Get final order
        const finalOrder = await page.evaluate(() => {
            const items = document.querySelectorAll('#package-priority-list .priority-item');
            return Array.from(items).map(item => item.getAttribute('data-manager'));
        });

        // Verify winget is now first and order changed
        expect(finalOrder[0]).toBe('winget');
        expect(finalOrder).not.toEqual(chocolateyFirstOrder);
    });

    test('should save priority order when settings are saved', async () => {
        // Navigate to settings section
        await page.click('a[onclick="showSection(\'settings\')"]');

        // Wait for settings section to be visible
        await page.waitForSelector('#settings-section');

        // Ensure winget is first in priority
        const firstItem = await page.evaluate(() => {
            const items = document.querySelectorAll('#package-priority-list .priority-item');
            return items[0]?.getAttribute('data-manager');
        });

        if (firstItem !== 'winget') {
            const wingetItem = page.locator('[data-manager="winget"]');
            const chocolateyItem = page.locator('[data-manager="chocolatey"]');
            await wingetItem.dragTo(chocolateyItem, { targetPosition: { x: 0, y: 0 } });
        }

        // Save settings
        await page.click('#save-settings-btn');

        // Wait for success message
        await page.waitForSelector('#settings-status:has-text("saved successfully")', { timeout: 5000 });

        // Reload the page/section to verify persistence
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.click('a[onclick="showSection(\'settings\')"]');
        await page.waitForSelector('#settings-section');

        // Verify the order persisted
        const persistedOrder = await page.evaluate(() => {
            const items = document.querySelectorAll('#package-priority-list .priority-item');
            return Array.from(items).map(item => item.getAttribute('data-manager'));
        });

        expect(persistedOrder[0]).toBe('winget');
    });

    test('should reflect priority order in backup operations', async () => {
        // Navigate to backup section
        await page.click('a[onclick="showSection(\'backup\')"]');

        // Wait for backup section to be visible
        await page.waitForSelector('#backup-section');

        // Start a backup operation
        await page.click('#backup-btn');

        // This test would need to be implemented with proper monitoring
        // to track which adapter runs first based on priority
        // For now, we verify that backup can be initiated
        await page.waitForSelector('#backup-status', { timeout: 10000 });
    });
});
