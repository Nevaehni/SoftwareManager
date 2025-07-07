"use strict";
/**
 * @jest-environment jsdom
 */
Object.defineProperty(exports, "__esModule", { value: true });
// Mock the electron API that would be exposed by preload
global.electronAPI = {
    backupPackages: jest.fn().mockResolvedValue({ success: true }),
    restorePackages: jest.fn().mockResolvedValue({ success: true }),
    previewRestore: jest.fn().mockResolvedValue({ success: true, preview: { totalPackages: 0, newInstalls: [], upgrades: [], downgrades: [], reinstalls: [], skipped: [], summary: { willInstall: 0, willUpgrade: 0, willDowngrade: 0, willReinstall: 0, willSkip: 0 } } }),
    getSettings: jest.fn().mockResolvedValue({ enableChoco: true }),
    saveSettings: jest.fn().mockResolvedValue({ success: true }),
    selectFile: jest.fn().mockResolvedValue({ filePath: '/test/bundle.yaml' }),
    selectDirectory: jest.fn().mockResolvedValue({ directoryPath: '/test' }),
    onBackupProgress: jest.fn(),
    onRestoreProgress: jest.fn(),
    onPreviewProgress: jest.fn(),
    removeAllListeners: jest.fn(),
};
const app_controller_1 = require("../app-controller");
describe('Renderer App Controller', () => {
    let appController;
    let mockDocument;
    beforeEach(() => {
        // Set up DOM
        document.body.innerHTML = `
            <div id="app">
                <div id="backup-section">
                    <button id="backup-btn">Create Backup</button>
                    <div id="backup-status"></div>
                </div>                <div id="restore-section">
                    <button id="select-bundle-btn">Select Bundle</button>
                    <div id="restore-preview-section" class="hidden">
                        <button id="preview-restore-btn" disabled>Preview Changes</button>
                        <div id="preview-results" class="hidden">
                            <div id="preview-new-count">0</div>
                            <div id="preview-upgrade-count">0</div>
                            <div id="preview-downgrade-count">0</div>
                            <div id="preview-reinstall-count">0</div>
                            <div id="preview-skip-count">0</div>
                        </div>
                    </div>
                    <button id="restore-btn" disabled>Restore Packages</button>
                    <div id="restore-status"></div>
                </div>
                <div id="settings-section">
                    <input type="checkbox" id="enable-choco" />
                    <label for="enable-choco">Enable Chocolatey</label>
                    <button id="save-settings-btn">Save Settings</button>
                </div>
            </div>
        `;
        appController = new app_controller_1.AppController();
        jest.clearAllMocks();
    });
    test('App_controller_initializes_UI', () => {
        // Red phase: Test that app controller sets up event listeners
        appController.initialize();
        const backupBtn = document.getElementById('backup-btn');
        const restoreBtn = document.getElementById('restore-btn');
        const selectBundleBtn = document.getElementById('select-bundle-btn');
        expect(backupBtn).toBeDefined();
        expect(restoreBtn).toBeDefined();
        expect(selectBundleBtn).toBeDefined();
    });
    test('Backup_button_triggers_backup', async () => {
        // Red phase: Test that clicking backup button calls electronAPI
        appController.initialize();
        const backupBtn = document.getElementById('backup-btn');
        backupBtn.click();
        // Wait a tick for async operations
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(global.electronAPI.backupPackages).toHaveBeenCalled();
    });
    test('Restore_button_enabled_after_bundle_selection', async () => {
        // Red phase: Test that restore button is enabled after selecting bundle
        appController.initialize();
        const selectBundleBtn = document.getElementById('select-bundle-btn');
        const restoreBtn = document.getElementById('restore-btn');
        expect(restoreBtn.disabled).toBe(true);
        selectBundleBtn.click();
        // Wait a tick for async operations
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(global.electronAPI.selectFile).toHaveBeenCalled();
        expect(restoreBtn.disabled).toBe(false);
    });
    test('Settings_checkbox_reflects_stored_settings', async () => {
        // Red phase: Test that settings UI reflects stored settings
        appController.initialize();
        // Wait a tick for async operations
        await new Promise(resolve => setTimeout(resolve, 0));
        const chocoCheckbox = document.getElementById('enable-choco');
        expect(global.electronAPI.getSettings).toHaveBeenCalled();
        expect(chocoCheckbox.checked).toBe(true);
    });
});
//# sourceMappingURL=app-controller.spec.js.map