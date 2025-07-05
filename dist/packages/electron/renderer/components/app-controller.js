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
        this.setupProgressListeners();
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
            const backupBtn = document.getElementById('backup-btn');
            const statusElement = document.getElementById('backup-status');
            // Disable button during backup
            if (backupBtn)
                backupBtn.disabled = true;
            // Clear previous status
            if (statusElement) {
                statusElement.textContent = 'Starting backup...';
                statusElement.className = 'status';
            }
            const result = await window.electronAPI.backupPackages();
            if (statusElement) {
                statusElement.textContent = result.success ? 'Backup created successfully!' : 'Backup failed';
                statusElement.className = result.success ? 'status success' : 'status error';
            }
            // Re-enable button
            if (backupBtn)
                backupBtn.disabled = false;
        }
        catch (error) {
            console.error('Backup failed:', error);
            const statusElement = document.getElementById('backup-status');
            if (statusElement) {
                statusElement.textContent = 'Backup failed';
                statusElement.className = 'status error';
            }
            // Re-enable button
            const backupBtn = document.getElementById('backup-btn');
            if (backupBtn)
                backupBtn.disabled = false;
        }
    }
    async handleSelectBundle() {
        try {
            const result = await window.electronAPI.selectFile({
                filters: [{ name: 'YAML files', extensions: ['yaml', 'yml'] }]
            });
            if (result.filePath) {
                this.selectedBundlePath = result.filePath;
                // Update UI to show selected file
                const selectedFileElement = document.getElementById('selected-file');
                if (selectedFileElement) {
                    selectedFileElement.textContent = `Selected: ${result.filePath}`;
                    selectedFileElement.style.display = 'block';
                }
                // Enable restore button
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
            const restoreBtn = document.getElementById('restore-btn');
            const statusElement = document.getElementById('restore-status');
            // Disable button during restore
            if (restoreBtn)
                restoreBtn.disabled = true;
            // Clear previous status
            if (statusElement) {
                statusElement.textContent = 'Starting restore...';
                statusElement.className = 'status';
            }
            const result = await window.electronAPI.restorePackages(this.selectedBundlePath);
            if (statusElement) {
                if (result.success) {
                    statusElement.textContent = 'Restore completed successfully!';
                    statusElement.className = 'status success';
                }
                else {
                    statusElement.textContent = 'Restore failed';
                    statusElement.className = 'status error';
                }
            }
            // Re-enable button
            if (restoreBtn)
                restoreBtn.disabled = false;
        }
        catch (error) {
            console.error('Restore failed:', error);
            const statusElement = document.getElementById('restore-status');
            if (statusElement) {
                statusElement.textContent = 'Restore failed';
                statusElement.className = 'status error';
            }
            // Re-enable button
            const restoreBtn = document.getElementById('restore-btn');
            if (restoreBtn)
                restoreBtn.disabled = false;
        }
    }
    async loadSettings() {
        try {
            const settings = await window.electronAPI.getSettings();
            const chocoCheckbox = document.getElementById('enable-choco');
            const wingetCheckbox = document.getElementById('enable-winget');
            if (chocoCheckbox) {
                chocoCheckbox.checked = settings.enableChoco ?? true;
            }
            if (wingetCheckbox) {
                wingetCheckbox.checked = settings.enableWinget ?? true;
            }
        }
        catch (error) {
            console.error('Failed to load settings:', error);
        }
    }
    async handleSaveSettings() {
        try {
            const chocoCheckbox = document.getElementById('enable-choco');
            const wingetCheckbox = document.getElementById('enable-winget');
            const settings = {
                enableChoco: chocoCheckbox?.checked ?? true,
                enableWinget: wingetCheckbox?.checked ?? true
            };
            const result = await window.electronAPI.saveSettings(settings);
            const statusElement = document.getElementById('settings-status');
            if (statusElement) {
                statusElement.className = result.success ? 'status success' : 'status error';
                statusElement.textContent = result.success ? 'Settings saved successfully!' : 'Failed to save settings';
            }
        }
        catch (error) {
            console.error('Failed to save settings:', error);
        }
    }
    setupProgressListeners() {
        // Listen for backup progress
        window.electronAPI.onBackupProgress((progress) => {
            this.updateProgress('backup', progress.progress, progress.message);
        });
        // Listen for restore progress
        window.electronAPI.onRestoreProgress((progress) => {
            this.updateProgress('restore', progress.progress, progress.message);
        });
    }
    updateProgress(type, progress, message) {
        const progressBarElement = document.getElementById(`${type}-progress`);
        const progressFillElement = progressBarElement?.querySelector('.progress-fill');
        const statusElement = document.getElementById(`${type}-status`);
        if (progressBarElement && progressFillElement && statusElement) {
            // Show progress bar
            progressBarElement.style.display = 'block';
            // Update progress fill
            progressFillElement.style.width = `${progress}%`;
            // Update status message
            statusElement.textContent = message;
            statusElement.className = 'status';
            // Hide progress bar when complete
            if (progress >= 100) {
                setTimeout(() => {
                    progressBarElement.style.display = 'none';
                    statusElement.className = 'status success';
                }, 2000);
            }
        }
    }
}
exports.AppController = AppController;
//# sourceMappingURL=app-controller.js.map