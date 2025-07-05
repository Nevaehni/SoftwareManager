"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
class AppController {
    constructor() {
        this.selectedBundlePath = null;
    }
    initialize() {
        this.setupEventListeners();
        this.loadSettings();
    }
    setupEventListeners() {
        // Backup functionality
        const backupBtn = document.getElementById('backup-btn');
        if (backupBtn) {
            backupBtn.addEventListener('click', () => this.handleBackup());
        }
        // Restore functionality
        const selectBundleBtn = document.getElementById('select-bundle-btn');
        if (selectBundleBtn) {
            selectBundleBtn.addEventListener('click', () => this.handleSelectBundle());
        }
        const restoreBtn = document.getElementById('restore-btn');
        if (restoreBtn) {
            restoreBtn.addEventListener('click', () => this.handleRestore());
        }
        // Settings functionality
        const saveSettingsBtn = document.getElementById('save-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.handleSaveSettings());
        }
    }
    async handleBackup() {
        try {
            const result = await window.electronAPI.backupPackages();
            const statusElement = document.getElementById('backup-status');
            if (statusElement) {
                statusElement.textContent = result.success ? 'Backup created successfully!' : 'Backup failed';
            }
        }
        catch (error) {
            console.error('Backup failed:', error);
        }
    }
    async handleSelectBundle() {
        try {
            const result = await window.electronAPI.selectFile({
                filters: [{ name: 'YAML files', extensions: ['yaml', 'yml'] }]
            });
            if (result.filePath) {
                this.selectedBundlePath = result.filePath;
                const restoreBtn = document.getElementById('restore-btn');
                if (restoreBtn) {
                    restoreBtn.disabled = false;
                }
            }
        }
        catch (error) {
            console.error('File selection failed:', error);
        }
    }
    async handleRestore() {
        if (!this.selectedBundlePath)
            return;
        try {
            const result = await window.electronAPI.restorePackages(this.selectedBundlePath);
            const statusElement = document.getElementById('restore-status');
            if (statusElement) {
                statusElement.textContent = result.success ? 'Restore completed successfully!' : 'Restore failed';
            }
        }
        catch (error) {
            console.error('Restore failed:', error);
        }
    }
    async loadSettings() {
        try {
            const settings = await window.electronAPI.getSettings();
            const chocoCheckbox = document.getElementById('enable-choco');
            if (chocoCheckbox) {
                chocoCheckbox.checked = settings.enableChoco ?? true;
            }
        }
        catch (error) {
            console.error('Failed to load settings:', error);
        }
    }
    async handleSaveSettings() {
        try {
            const chocoCheckbox = document.getElementById('enable-choco');
            const settings = {
                enableChoco: chocoCheckbox?.checked ?? true
            };
            const result = await window.electronAPI.saveSettings(settings);
            // Could add some UI feedback here
        }
        catch (error) {
            console.error('Failed to save settings:', error);
        }
    }
}
exports.AppController = AppController;
//# sourceMappingURL=app-controller.js.map