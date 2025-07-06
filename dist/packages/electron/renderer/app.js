// AppController logic included directly to avoid module loading issues
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
            console.log('Backup button clicked');

            if (!window.electronAPI) {
                console.error('electronAPI not available');
                this.updateStatus('backup-status', '❌ Application error: electronAPI not available', true);
                return;
            }

            const backupBtn = document.getElementById('backup-btn');
            const statusElement = document.getElementById('backup-status');

            if (backupBtn) backupBtn.disabled = true;
            this.updateStatus('backup-status', '🔄 Starting backup...', false);

            const result = await window.electronAPI.backupPackages();

            if (result.success) {
                this.updateStatus('backup-status', '✅ Backup completed successfully!', false);
            } else {
                this.updateStatus('backup-status', `❌ Backup failed: ${result.error || 'Unknown error'}`, true);
            }
        } catch (error) {
            console.error('Backup error:', error);
            this.updateStatus('backup-status', `❌ Backup failed: ${error.message}`, true);
        } finally {
            const backupBtn = document.getElementById('backup-btn');
            if (backupBtn) backupBtn.disabled = false;
        }
    }

    async handleSelectBundle() {
        try {
            console.log('Select bundle button clicked');

            if (!window.electronAPI) {
                console.error('electronAPI not available');
                return;
            }

            const result = await window.electronAPI.selectFile({
                title: 'Select backup bundle',
                filters: [
                    { name: 'YAML files', extensions: ['yaml', 'yml'] },
                    { name: 'All files', extensions: ['*'] }
                ]
            });            if (result.filePath) {
                this.selectedBundlePath = result.filePath;
                const selectedFileDiv = document.getElementById('selected-file');
                const selectedPathElement = document.getElementById('selected-bundle-path');
                const restoreBtn = document.getElementById('restore-btn');

                if (selectedFileDiv) {
                    selectedFileDiv.classList.remove('hidden');
                }
                if (selectedPathElement) {
                    selectedPathElement.textContent = result.filePath;
                }
                if (restoreBtn) {
                    restoreBtn.disabled = false;
                }
            }
        } catch (error) {
            console.error('File selection error:', error);
        }
    }

    async handleRestore() {
        if (!this.selectedBundlePath) {
            this.updateStatus('restore-status', '❌ Please select a bundle file first', true);
            return;
        }

        try {
            console.log('Restore button clicked');

            if (!window.electronAPI) {
                console.error('electronAPI not available');
                this.updateStatus('restore-status', '❌ Application error: electronAPI not available', true);
                return;
            }

            const restoreBtn = document.getElementById('restore-btn');
            if (restoreBtn) restoreBtn.disabled = true;

            this.updateStatus('restore-status', '🔄 Starting restore...', false);

            const result = await window.electronAPI.restorePackages(this.selectedBundlePath);

            if (result.success) {
                this.updateStatus('restore-status', '✅ Restore completed successfully!', false);
            } else {
                this.updateStatus('restore-status', `❌ Restore failed: ${result.error || 'Unknown error'}`, true);
            }
        } catch (error) {
            console.error('Restore error:', error);
            this.updateStatus('restore-status', `❌ Restore failed: ${error.message}`, true);
        } finally {
            const restoreBtn = document.getElementById('restore-btn');
            if (restoreBtn) restoreBtn.disabled = false;
        }
    }

    async handleSaveSettings() {
        try {
            console.log('Save settings button clicked');

            if (!window.electronAPI) {
                console.error('electronAPI not available');
                return;
            }            const enableChoco = document.getElementById('enable-choco')?.checked ?? true;
            const enableWinget = document.getElementById('enable-winget')?.checked ?? true;

            const settings = {
                enableChoco,
                enableWinget
            };

            const result = await window.electronAPI.saveSettings(settings);

            if (result.success) {
                this.updateStatus('settings-status', '✅ Settings saved successfully!', false);
            } else {
                this.updateStatus('settings-status', `❌ Failed to save settings: ${result.error || 'Unknown error'}`, true);
            }
        } catch (error) {
            console.error('Save settings error:', error);
            this.updateStatus('settings-status', `❌ Failed to save settings: ${error.message}`, true);
        }
    }

    async loadSettings() {
        try {
            if (!window.electronAPI) {
                console.error('electronAPI not available for loading settings');
                return;
            }

            const settings = await window.electronAPI.getSettings();            const enableChocoCheckbox = document.getElementById('enable-choco');
            const enableWingetCheckbox = document.getElementById('enable-winget');

            if (enableChocoCheckbox) {
                enableChocoCheckbox.checked = settings.enableChoco !== false;
            }
            if (enableWingetCheckbox) {
                enableWingetCheckbox.checked = settings.enableWinget !== false;
            }
        } catch (error) {
            console.error('Load settings error:', error);
        }
    }

    setupProgressListeners() {
        if (!window.electronAPI) {
            console.error('electronAPI not available for progress listeners');
            return;
        }

        window.electronAPI.onBackupProgress((event, data) => {
            this.updateStatus('backup-status', `🔄 ${data.message} (${data.progress}%)`, false);
        });

        window.electronAPI.onRestoreProgress((event, data) => {
            this.updateStatus('restore-status', `🔄 ${data.message} (${data.progress}%)`, false);
        });
    }    updateStatus(elementId, message, isError) {
        const element = document.getElementById(elementId);
        if (element) {
            element.textContent = message;
            element.classList.remove('hidden');
            
            // Clear existing classes
            element.classList.remove('bg-green-50', 'border-green-200', 'text-green-800', 
                                   'bg-red-50', 'border-red-200', 'text-red-800',
                                   'bg-blue-50', 'border-blue-200', 'text-blue-800');
            
            if (isError) {
                element.classList.add('bg-red-50', 'border-red-200', 'text-red-800');
            } else if (message.includes('✅')) {
                element.classList.add('bg-green-50', 'border-green-200', 'text-green-800');
            } else {
                element.classList.add('bg-blue-50', 'border-blue-200', 'text-blue-800');
            }
        }
    }
}

// Initialize the application when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing app...');

    // Check if electronAPI is available
    if (!window.electronAPI) {
        console.error('electronAPI not available! Check preload script.');
        return;
    }

    console.log('electronAPI available:', Object.keys(window.electronAPI));

    const app = new AppController();
    app.initialize();

    console.log('Software Manager initialized');
});
