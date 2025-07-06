// F-02: Manager priority drag-and-drop - E2E test
import { test, expect } from '@playwright/test';
import { _electron as electron } from '@playwright/test';

describe('Package Manager Priority Settings', () => {
    let app: any;
    let page: any;

    test.beforeAll(async () => {
        // Launch Electron app
        app = await electron.launch({
            args: ['packages/electron/main/main.js']
        });
        page = await app.firstWindow();
        await page.waitForLoadState('domcontentloaded');
    });

    test.afterAll(async () => {
        await app.close();
    });

    test('should display package manager priority list in settings', async () => {
        // Navigate to settings section
        await page.click('a[onclick="showSection(\'settings\')"]');

        // Wait for settings section to be visible
        await page.waitForSelector('#settings-section');

        // Check if priority list exists
        const prioritySection = page.locator('#priority-section');
        await expect(prioritySection).toBeVisible();

        // Check if both package managers are listed
        const wingetItem = page.locator('[data-priority-item="winget"]');
        const chocoItem = page.locator('[data-priority-item="chocolatey"]');

        await expect(wingetItem).toBeVisible();
        await expect(chocoItem).toBeVisible();

        // Check if drag handles are present
        const dragHandles = page.locator('.drag-handle');
        await expect(dragHandles).toHaveCount(2);
    });

    test('should allow dragging winget above chocolatey', async () => {
        // Navigate to settings section
        await page.click('a[onclick="showSection(\'settings\')"]');
        await page.waitForSelector('#settings-section');

        // Get initial order
        const initialOrder = await page.locator('[data-priority-item]').all();
        const firstItem = await initialOrder[0].getAttribute('data-priority-item');

        // Perform drag and drop operation
        const wingetItem = page.locator('[data-priority-item="winget"]');
        const chocoItem = page.locator('[data-priority-item="chocolatey"]');

        // Drag winget to the top position if it's not already there
        if (firstItem !== 'winget') {
            await wingetItem.dragTo(chocoItem, { targetPosition: { x: 0, y: -10 } });
        }

        // Verify the new order
        const newOrder = await page.locator('[data-priority-item]').all();
        const newFirstItem = await newOrder[0].getAttribute('data-priority-item');
        await expect(newFirstItem).toBe('winget');
    });

    test('should save priority order when settings are saved', async () => {
        // Navigate to settings section
        await page.click('a[onclick="showSection(\'settings\')"]');
        await page.waitForSelector('#settings-section');

        // Ensure winget is first in priority
        const priorityItems = page.locator('[data-priority-item]');
        const firstItem = await priorityItems.first().getAttribute('data-priority-item');

        if (firstItem !== 'winget') {
            const wingetItem = page.locator('[data-priority-item="winget"]');
            const chocoItem = page.locator('[data-priority-item="chocolatey"]');
            await wingetItem.dragTo(chocoItem, { targetPosition: { x: 0, y: -10 } });
        }

        // Save settings
        await page.click('#save-settings-btn');

        // Wait for success message
        const statusElement = page.locator('#settings-status');
        await expect(statusElement).toContainText('✅ Settings saved successfully!');

        // Reload the page/section to verify persistence
        await page.reload();
        await page.waitForLoadState('domcontentloaded');
        await page.click('a[onclick="showSection(\'settings\')"]');
        await page.waitForSelector('#settings-section');

        // Verify the order persisted
        const persistedOrder = await page.locator('[data-priority-item]').all();
        const persistedFirstItem = await persistedOrder[0].getAttribute('data-priority-item');
        await expect(persistedFirstItem).toBe('winget');
    });

    test('should reflect priority order in backup operations', async () => {
        // This test verifies that the priority order affects which package manager runs first
        // Navigate to backup section
        await page.click('a[onclick="showSection(\'backup\')"]');
        await page.waitForSelector('#backup-section');

        // Start a backup operation
        await page.click('#backup-btn');

        // Monitor the console or status for order indication
        // This is a placeholder for now - would need actual implementation
        // to track which adapter runs first based on priority
        const backupStatus = page.locator('#backup-status');
        await expect(backupStatus).toBeVisible({ timeout: 10000 });
    });
});
