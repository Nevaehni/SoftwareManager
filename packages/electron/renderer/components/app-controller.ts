declare global {
    interface Window {
        electronAPI: {
            backupPackages: () => Promise<{ success: boolean }>;
            restorePackages: (bundlePath: string) => Promise<{ success: boolean }>;
            getSettings: () => Promise<{ enableChoco?: boolean; enableWinget?: boolean }>;
            saveSettings: (settings: any) => Promise<{ success: boolean }>;
            selectFile: (options?: any) => Promise<{ filePath?: string }>;
            selectDirectory: () => Promise<{ directoryPath?: string }>;
            searchPackages: (query: string) => Promise<{ success: boolean; packages?: any[]; error?: string }>;
            installPackage: (packageId: string, source: string, version?: string) => Promise<{ success: boolean; message?: string; error?: string }>;
            onBackupProgress: (callback: Function) => void;
            onRestoreProgress: (callback: Function) => void;
            removeAllListeners: (channel: string) => void;
        };
        consoleLogger?: any;
    }
}

// Declare ConsoleLogger as a global class for browser usage
declare const ConsoleLogger: any;

export class AppController {
    private selectedBundlePath: string | null = null;
    private consoleLogger: any = null; initialize(): void {
        this.setupEventListeners();
        this.loadSettings();
        this.setupProgressListeners();
        this.initializeConsoleLogger();
    }

    private initializeConsoleLogger(): void {
        // Initialize console logger when console section is shown
        const consoleNavItem = document.querySelector('a[onclick="showSection(\'console\')"]');
        if (consoleNavItem) {
            consoleNavItem.addEventListener('click', () => {
                setTimeout(() => {
                    this.setupConsoleLogger();
                }, 100);
            });
        }
    }

    private setupConsoleLogger(): void {
        if (!this.consoleLogger && typeof window !== 'undefined') {
            try {
                // Use global ConsoleLogger if available (browser version)
                if (typeof ConsoleLogger !== 'undefined') {
                    this.consoleLogger = new ConsoleLogger();
                    window.consoleLogger = this.consoleLogger;
                    console.log('Console logger initialized successfully');
                } else {
                    console.warn('ConsoleLogger class not found');
                }
            } catch (error) {
                console.error('Failed to initialize console logger:', error);
            }
        }
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
    } private async handleBackup(): Promise<void> {
        try {
            const backupBtn = document.getElementById('backup-btn') as HTMLButtonElement;
            const statusElement = document.getElementById('backup-status');

            // Log to console
            if (this.consoleLogger) {
                this.consoleLogger.info('Starting backup operation...', 'Backup');
            }

            // Disable button during backup
            if (backupBtn) backupBtn.disabled = true;

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

            // Log result to console
            if (this.consoleLogger) {
                if (result.success) {
                    this.consoleLogger.success('Backup operation completed successfully', 'Backup');
                } else {
                    this.consoleLogger.error('Backup operation failed', 'Backup');
                }
            }

            // Re-enable button
            if (backupBtn) backupBtn.disabled = false;
        } catch (error) {
            console.error('Backup failed:', error);

            // Log error to console
            if (this.consoleLogger) {
                this.consoleLogger.error(`Backup operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Backup');
            }

            const statusElement = document.getElementById('backup-status');
            if (statusElement) {
                statusElement.textContent = 'Backup failed';
                statusElement.className = 'status error';
            }

            // Re-enable button
            const backupBtn = document.getElementById('backup-btn') as HTMLButtonElement;
            if (backupBtn) backupBtn.disabled = false;
        }
    } private async handleSelectBundle(): Promise<void> {
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
                const restoreBtn = document.getElementById('restore-btn') as HTMLButtonElement;
                if (restoreBtn) {
                    restoreBtn.disabled = false;
                }
            }
        } catch (error) {
            console.error('File selection failed:', error);
        }
    } private async handleRestore(): Promise<void> {
        if (!this.selectedBundlePath) return;

        try {
            const restoreBtn = document.getElementById('restore-btn') as HTMLButtonElement;
            const statusElement = document.getElementById('restore-status');

            // Log to console
            if (this.consoleLogger) {
                this.consoleLogger.info(`Starting restore operation from: ${this.selectedBundlePath}`, 'Restore');
            }

            // Disable button during restore
            if (restoreBtn) restoreBtn.disabled = true;

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
                } else {
                    statusElement.textContent = 'Restore failed';
                    statusElement.className = 'status error';
                }
            }

            // Log result to console
            if (this.consoleLogger) {
                if (result.success) {
                    this.consoleLogger.success('Restore operation completed successfully', 'Restore');
                } else {
                    this.consoleLogger.error('Restore operation failed', 'Restore');
                }
            }

            // Re-enable button
            if (restoreBtn) restoreBtn.disabled = false;
        } catch (error) {
            console.error('Restore failed:', error);

            // Log error to console
            if (this.consoleLogger) {
                this.consoleLogger.error(`Restore operation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Restore');
            }

            const statusElement = document.getElementById('restore-status');
            if (statusElement) {
                statusElement.textContent = 'Restore failed';
                statusElement.className = 'status error';
            }

            // Re-enable button
            const restoreBtn = document.getElementById('restore-btn') as HTMLButtonElement;
            if (restoreBtn) restoreBtn.disabled = false;
        }
    } private async loadSettings(): Promise<void> {
        try {
            const settings = await window.electronAPI.getSettings();
            const chocoCheckbox = document.getElementById('enable-choco') as HTMLInputElement;
            const wingetCheckbox = document.getElementById('enable-winget') as HTMLInputElement;

            if (chocoCheckbox) {
                chocoCheckbox.checked = settings.enableChoco ?? true;
            }
            if (wingetCheckbox) {
                wingetCheckbox.checked = settings.enableWinget ?? true;
            }
        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    } private async handleSaveSettings(): Promise<void> {
        try {
            const chocoCheckbox = document.getElementById('enable-choco') as HTMLInputElement;
            const wingetCheckbox = document.getElementById('enable-winget') as HTMLInputElement;

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
        } catch (error) {
            console.error('Failed to save settings:', error);
        }
    } private setupProgressListeners(): void {
        // Listen for backup progress
        window.electronAPI.onBackupProgress((progress: { progress: number; message: string }) => {
            this.updateProgress('backup', progress.progress, progress.message);
        });

        // Listen for restore progress
        window.electronAPI.onRestoreProgress((progress: { progress: number; message: string }) => {
            this.updateProgress('restore', progress.progress, progress.message);
        });
    } private updateProgress(type: 'backup' | 'restore', progress: number, message: string): void {
        const progressBarElement = document.getElementById(`${type}-progress`);
        const progressFillElement = progressBarElement?.querySelector('.progress-fill') as HTMLElement;
        const statusElement = document.getElementById(`${type}-status`);

        // Log progress to console
        if (this.consoleLogger) {
            if (type === 'backup') {
                this.consoleLogger.logBackupProgress(progress, message);
            } else {
                this.consoleLogger.logRestoreProgress(progress, message);
            }
        }

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
