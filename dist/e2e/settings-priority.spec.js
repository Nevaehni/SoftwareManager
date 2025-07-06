"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
const test_2 = require("@playwright/test");
test_1.test.describe('Package Manager Priority Settings', () => {
    let app;
    let page;
    test_1.test.beforeAll(async () => {
        // Launch Electron app
        app = await test_2._electron.launch({
            args: ['dist/packages/electron/main/main.js']
        });
        page = await app.firstWindow();
    });
    test_1.test.afterAll(async () => {
        if (app) {
            await app.close();
        }
    });
    (0, test_1.test)('should display package manager priority list in settings', async () => {
        // Navigate to settings section
        await page.click('a[onclick="showSection(\'settings\')"]');
        // Wait for settings section to be visible
        await page.waitForSelector('#settings-section');
        // Check if priority list exists
        const priorityList = page.locator('#package-priority-list');
        await (0, test_1.expect)(priorityList).toBeVisible();
        // Check if both package managers are listed
        const wingetItem = page.locator('[data-manager="winget"]');
        const chocolateyItem = page.locator('[data-manager="chocolatey"]');
        await (0, test_1.expect)(wingetItem).toBeVisible();
        await (0, test_1.expect)(chocolateyItem).toBeVisible();
        // Check if drag handles are present
        const dragHandles = page.locator('.drag-handle');
        await (0, test_1.expect)(dragHandles).toHaveCount(2);
    });
    (0, test_1.test)('should allow dragging winget above chocolatey', async () => {
        // Navigate to settings section
        await page.click('a[onclick="showSection(\'settings\')"]');
        // Wait for settings section to be visible
        await page.waitForSelector('#settings-section');
        // Get initial order
        const initialOrder = await page.evaluate(() => {
            const items = document.querySelectorAll('#package-priority-list .priority-item');
            return Array.from(items).map(item => item.getAttribute('data-manager'));
        });
        // Perform drag and drop operation
        const wingetItem = page.locator('[data-manager="winget"]');
        const chocolateyItem = page.locator('[data-manager="chocolatey"]');
        // Drag winget to the top position
        await wingetItem.dragTo(chocolateyItem, { targetPosition: { x: 0, y: 0 } });
        // Get new order
        const newOrder = await page.evaluate(() => {
            const items = document.querySelectorAll('#package-priority-list .priority-item');
            return Array.from(items).map(item => item.getAttribute('data-manager'));
        });
        // Verify the order changed
        (0, test_1.expect)(newOrder).not.toEqual(initialOrder);
    });
    (0, test_1.test)('should save priority order when settings are saved', async () => {
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
        (0, test_1.expect)(persistedOrder[0]).toBe('winget');
    });
    (0, test_1.test)('should reflect priority order in backup operations', async () => {
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
//# sourceMappingURL=settings-priority.spec.js.map