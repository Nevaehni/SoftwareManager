declare global {
    interface Window {
        electronAPI: {
            backupPackages: () => Promise<{ success: boolean }>;
            restorePackages: (bundlePath: string) => Promise<{ success: boolean }>;
            getSettings: () => Promise<{ enableChoco?: boolean }>;
            saveSettings: (settings: any) => Promise<{ success: boolean }>;
            selectFile: (options?: any) => Promise<{ filePath?: string }>;
            selectDirectory: () => Promise<{ directoryPath?: string }>;
            onBackupProgress: (callback: Function) => void;
            onRestoreProgress: (callback: Function) => void;
            removeAllListeners: (channel: string) => void;
        };
    }
}

export class AppController {
    private selectedBundlePath: string | null = null;

    initialize(): void {
        this.setupEventListeners();
        this.loadSettings();
    }

    private setupEventListeners(): void {
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

    private async handleBackup(): Promise<void> {
        try {
            const result = await window.electronAPI.backupPackages();
            const statusElement = document.getElementById('backup-status');
            if (statusElement) {
                statusElement.textContent = result.success ? 'Backup created successfully!' : 'Backup failed';
            }
        } catch (error) {
            console.error('Backup failed:', error);
        }
    }

    private async handleSelectBundle(): Promise<void> {
        try {
            const result = await window.electronAPI.selectFile({
                filters: [{ name: 'YAML files', extensions: ['yaml', 'yml'] }]
            });

            if (result.filePath) {
                this.selectedBundlePath = result.filePath;
                const restoreBtn = document.getElementById('restore-btn') as HTMLButtonElement;
                if (restoreBtn) {
                    restoreBtn.disabled = false;
                }
            }
        } catch (error) {
            console.error('File selection failed:', error);
        }
    }

    private async handleRestore(): Promise<void> {
        if (!this.selectedBundlePath) return;

        try {
            const result = await window.electronAPI.restorePackages(this.selectedBundlePath);
            const statusElement = document.getElementById('restore-status');
            if (statusElement) {
                statusElement.textContent = result.success ? 'Restore completed successfully!' : 'Restore failed';
            }
        } catch (error) {
            console.error('Restore failed:', error);
        }
    }

    private async loadSettings(): Promise<void> {
        try {
            const settings = await window.electronAPI.getSettings();
            const chocoCheckbox = document.getElementById('enable-choco') as HTMLInputElement;
            if (chocoCheckbox) {
                chocoCheckbox.checked = settings.enableChoco ?? true;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    private async handleSaveSettings(): Promise<void> {
        try {
            const chocoCheckbox = document.getElementById('enable-choco') as HTMLInputElement;
            const settings = {
                enableChoco: chocoCheckbox?.checked ?? true
            };

            const result = await window.electronAPI.saveSettings(settings);
            // Could add some UI feedback here
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    }
}
