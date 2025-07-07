interface ConsoleLogger {
    info(message: string, category: string): void;
    success(message: string, category: string): void;
    error(message: string, category: string): void;
    warn(message: string, category: string): void;
}

// Declare ConsoleLogger as a global class for browser usage
declare const ConsoleLogger: any;

export class AppController {
    private selectedBundlePath: string | null = null;
    private consoleLogger: any = null;
    private versionPins: { [packageId: string]: string } = {};

    initialize(): void {
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

        // Version pinning functionality
        const loadPackagesBtn = document.getElementById('load-packages-btn');
        if (loadPackagesBtn) {
            loadPackagesBtn.addEventListener('click', () => this.handleLoadPackages());
        }

        const clearPinsBtn = document.getElementById('clear-pins-btn');
        if (clearPinsBtn) {
            clearPinsBtn.addEventListener('click', () => this.handleClearPins());
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

        // Preview functionality
        const previewBtn = document.getElementById('preview-restore-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.handlePreviewRestore());
        }        // Settings functionality
        const saveSettingsBtn = document.getElementById('save-settings-btn');
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', () => this.handleSaveSettings());
        }

        // Config picker functionality
        const addConfigPathBtn = document.getElementById('add-config-path-btn');
        if (addConfigPathBtn) {
            addConfigPathBtn.addEventListener('click', () => this.handleAddConfigPath());
        }

        const confirmConfigPathBtn = document.getElementById('confirm-config-path-btn');
        if (confirmConfigPathBtn) {
            confirmConfigPathBtn.addEventListener('click', () => this.handleConfirmConfigPath());
        }

        const cancelConfigPathBtn = document.getElementById('cancel-config-path-btn');
        if (cancelConfigPathBtn) {
            cancelConfigPathBtn.addEventListener('click', () => this.handleCancelConfigPath());
        }

        const previewConfigBackupBtn = document.getElementById('preview-config-backup-btn');
        if (previewConfigBackupBtn) {
            previewConfigBackupBtn.addEventListener('click', () => this.handlePreviewConfigBackup());
        }

        const closeConfigPreviewBtn = document.getElementById('close-config-preview-btn');
        if (closeConfigPreviewBtn) {
            closeConfigPreviewBtn.addEventListener('click', () => this.handleCloseConfigPreview());
        }

        const closePreviewBtn = document.getElementById('close-preview-btn');
        if (closePreviewBtn) {
            closePreviewBtn.addEventListener('click', () => this.handleCloseConfigPreview());
        }

        const addRegistryKeyBtn = document.getElementById('add-registry-key-btn');
        if (addRegistryKeyBtn) {
            addRegistryKeyBtn.addEventListener('click', () => this.handleAddRegistryKey());
        }
    } private async handleBackup(): Promise<void> {
        try {
            const backupBtn = document.getElementById('backup-btn') as HTMLButtonElement;
            const statusElement = document.getElementById('backup-status');

            // Log to console
            if (this.consoleLogger) {
                this.consoleLogger.info('Starting backup operation...', 'Backup');
                if (Object.keys(this.versionPins).length > 0) {
                    this.consoleLogger.info(`Applying ${Object.keys(this.versionPins).length} version pins`, 'Backup');
                }
            }

            // Disable button during backup
            if (backupBtn) backupBtn.disabled = true;

            // Clear previous status
            if (statusElement) {
                statusElement.textContent = 'Starting backup...';
                statusElement.className = 'status';
            }

            // Include version pins in backup request
            const result = await window.electronAPI.backupPackages(this.versionPins);

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

                // Enable preview button
                const previewBtn = document.getElementById('preview-restore-btn') as HTMLButtonElement;
                if (previewBtn) {
                    previewBtn.disabled = false;
                }

                // Show preview section
                const previewSection = document.getElementById('restore-preview-section');
                if (previewSection) {
                    previewSection.classList.remove('hidden');
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

        // Listen for preview progress
        window.electronAPI.onPreviewProgress((progress: { progress: number; message: string }) => {
            // Log preview progress to console
            if (this.consoleLogger) {
                this.consoleLogger.info(`[${progress.progress}%] ${progress.message}`, 'Preview');
            }
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
    } private async handlePreviewRestore(): Promise<void> {
        if (!this.selectedBundlePath) return;

        try {
            const previewBtn = document.getElementById('preview-restore-btn') as HTMLButtonElement;

            // Log to console
            if (this.consoleLogger) {
                this.consoleLogger.info(`Starting preview analysis for: ${this.selectedBundlePath}`, 'Preview');
            }

            // Disable button during preview
            if (previewBtn) {
                previewBtn.disabled = true;
                previewBtn.innerHTML = `
                    <div class="flex items-center justify-center space-x-2">
                        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Analyzing...</span>
                    </div>
                `;
            }

            const result = await window.electronAPI.previewRestore(this.selectedBundlePath);

            if (result.success && result.preview) {
                this.displayPreviewResults(result.preview);

                // Log success to console
                if (this.consoleLogger) {
                    this.consoleLogger.success(`Preview analysis completed. Found ${result.preview.totalPackages} packages to analyze.`, 'Preview');
                }
            } else {
                // Handle error
                if (this.consoleLogger) {
                    this.consoleLogger.error(`Preview analysis failed: ${result.error || 'Unknown error'}`, 'Preview');
                }

                // Hide preview results
                const previewResults = document.getElementById('preview-results');
                if (previewResults) {
                    previewResults.classList.add('hidden');
                }
            }

            // Re-enable button
            if (previewBtn) {
                previewBtn.disabled = false;
                previewBtn.innerHTML = `
                    <div class="flex items-center justify-center space-x-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                        <span>Preview Changes</span>
                    </div>
                `;
            }
        } catch (error) {
            console.error('Preview failed:', error);

            // Log error to console
            if (this.consoleLogger) {
                this.consoleLogger.error(`Preview analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Preview');
            }

            // Re-enable button
            const previewBtn = document.getElementById('preview-restore-btn') as HTMLButtonElement;
            if (previewBtn) {
                previewBtn.disabled = false;
                previewBtn.innerHTML = `
                    <div class="flex items-center justify-center space-x-2">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path>
                        </svg>
                        <span>Preview Changes</span>
                    </div>
                `;
            }
        }
    }

    private displayPreviewResults(preview: any): void {
        // Update summary counts
        this.updateElement('preview-new-count', preview.summary.willInstall.toString());
        this.updateElement('preview-upgrade-count', preview.summary.willUpgrade.toString());
        this.updateElement('preview-downgrade-count', preview.summary.willDowngrade.toString());
        this.updateElement('preview-reinstall-count', preview.summary.willReinstall.toString());
        this.updateElement('preview-skip-count', preview.summary.willSkip.toString());

        // Display detailed lists
        this.displayPackageList('preview-new-installs', 'preview-new-list', preview.newInstalls, (pkg: any) =>
            `<div class="flex items-center justify-between p-2 bg-white rounded border">
                <span class="font-medium">${pkg.name}</span>
                <span class="text-sm text-gray-600">v${pkg.bundleVersion}</span>
            </div>`
        );

        this.displayPackageList('preview-upgrades', 'preview-upgrade-list', preview.upgrades, (pkg: any) =>
            `<div class="flex items-center justify-between p-2 bg-white rounded border">
                <span class="font-medium">${pkg.name}</span>
                <span class="text-sm text-gray-600">v${pkg.installedVersion} → v${pkg.bundleVersion}</span>
            </div>`
        );

        this.displayPackageList('preview-downgrades', 'preview-downgrade-list', preview.downgrades, (pkg: any) =>
            `<div class="flex items-center justify-between p-2 bg-white rounded border">
                <span class="font-medium">${pkg.name}</span>
                <span class="text-sm text-gray-600">v${pkg.installedVersion} → v${pkg.bundleVersion}</span>
            </div>`
        );

        this.displayPackageList('preview-reinstalls', 'preview-reinstall-list', preview.reinstalls, (pkg: any) =>
            `<div class="flex items-center justify-between p-2 bg-white rounded border">
                <span class="font-medium">${pkg.name}</span>
                <span class="text-sm text-gray-600">v${pkg.bundleVersion}</span>
            </div>`
        );

        // Show preview results
        const previewResults = document.getElementById('preview-results');
        if (previewResults) {
            previewResults.classList.remove('hidden');
        }
    }

    private displayPackageList(sectionId: string, listId: string, packages: any[], formatPackage: (pkg: any) => string): void {
        const section = document.getElementById(sectionId);
        const list = document.getElementById(listId);

        if (!section || !list) return;

        if (packages.length > 0) {
            section.classList.remove('hidden');
            list.innerHTML = packages.map(formatPackage).join('');
        } else {
            section.classList.add('hidden');
        }
    }

    private updateElement(id: string, content: string): void {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = content;
        }
    }

    private async handleLoadPackages(): Promise<void> {
        try {
            const loadBtn = document.getElementById('load-packages-btn') as HTMLButtonElement;
            const loadingDiv = document.getElementById('packages-loading');
            const packagesDiv = document.getElementById('version-pin-packages');
            const emptyDiv = document.getElementById('version-pin-empty');
            const packageList = document.getElementById('pin-package-list');

            if (!loadBtn || !loadingDiv || !packagesDiv || !emptyDiv || !packageList) return;

            // Show loading state
            loadBtn.disabled = true;
            loadingDiv.classList.remove('hidden');
            emptyDiv.classList.add('hidden');
            packagesDiv.classList.add('hidden');

            if (this.consoleLogger) {
                this.consoleLogger.info('Loading installed packages for version pinning...', 'Version Pinning');
            }

            const result = await window.electronAPI.listInstalledPackages();

            if (result.success && result.packages) {
                // Clear existing package list
                packageList.innerHTML = '';

                // Group packages by source
                const packagesBySource = result.packages.reduce((acc: any, pkg: any) => {
                    if (!acc[pkg.source]) acc[pkg.source] = [];
                    acc[pkg.source].push(pkg);
                    return acc;
                }, {});

                // Render packages grouped by source
                Object.entries(packagesBySource).forEach(([source, packages]: [string, any]) => {
                    // Add source header
                    const sourceHeader = document.createElement('div');
                    sourceHeader.className = 'text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2 mt-4 first:mt-0';
                    sourceHeader.textContent = source;
                    packageList.appendChild(sourceHeader);

                    // Add packages for this source
                    (packages as any[]).forEach(pkg => {
                        const packageItem = this.createPackageItem(pkg);
                        packageList.appendChild(packageItem);
                    });
                });

                // Show packages div
                packagesDiv.classList.remove('hidden');
                this.updatePinnedCount();

                if (this.consoleLogger) {
                    this.consoleLogger.success(`Loaded ${result.packages.length} packages for version pinning`, 'Version Pinning');
                }
            } else {
                if (this.consoleLogger) {
                    this.consoleLogger.error(`Failed to load packages: ${result.error || 'Unknown error'}`, 'Version Pinning');
                }
                emptyDiv.classList.remove('hidden');
            }
        } catch (error) {
            console.error('Failed to load packages:', error);
            if (this.consoleLogger) {
                this.consoleLogger.error(`Failed to load packages: ${error}`, 'Version Pinning');
            }
            const emptyDiv = document.getElementById('version-pin-empty');
            if (emptyDiv) emptyDiv.classList.remove('hidden');
        } finally {
            const loadBtn = document.getElementById('load-packages-btn') as HTMLButtonElement;
            const loadingDiv = document.getElementById('packages-loading');
            if (loadBtn) loadBtn.disabled = false;
            if (loadingDiv) loadingDiv.classList.add('hidden');
        }
    }

    private createPackageItem(pkg: { id: string, name: string, version: string, source: string }): HTMLElement {
        const item = document.createElement('div');
        item.className = 'bg-white rounded-lg p-3 border border-gray-200 flex items-center justify-between';

        const leftSection = document.createElement('div');
        leftSection.className = 'flex-1 min-w-0';

        const nameDiv = document.createElement('div');
        nameDiv.className = 'font-medium text-gray-900 truncate';
        nameDiv.textContent = pkg.name;

        const detailsDiv = document.createElement('div');
        detailsDiv.className = 'text-sm text-gray-500 truncate';
        detailsDiv.textContent = `${pkg.id} • v${pkg.version}`;

        leftSection.appendChild(nameDiv);
        leftSection.appendChild(detailsDiv);

        const rightSection = document.createElement('div');
        rightSection.className = 'flex items-center space-x-2 ml-4';

        // Version input
        const versionInput = document.createElement('input');
        versionInput.type = 'text';
        versionInput.placeholder = 'Pin version';
        versionInput.className = 'w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500';
        versionInput.value = this.versionPins[pkg.id] || '';

        versionInput.addEventListener('input', (e) => {
            const target = e.target as HTMLInputElement;
            const value = target.value.trim();

            if (value) {
                this.versionPins[pkg.id] = value;
                item.classList.add('bg-blue-50', 'border-blue-300');
            } else {
                delete this.versionPins[pkg.id];
                item.classList.remove('bg-blue-50', 'border-blue-300');
            }

            this.updatePinnedCount();
        });

        // Clear button
        const clearBtn = document.createElement('button');
        clearBtn.className = 'text-gray-400 hover:text-red-600 transition-colors';
        clearBtn.innerHTML = `
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>
        `;
        clearBtn.addEventListener('click', () => {
            versionInput.value = '';
            delete this.versionPins[pkg.id];
            item.classList.remove('bg-blue-50', 'border-blue-300');
            this.updatePinnedCount();
        });

        rightSection.appendChild(versionInput);
        rightSection.appendChild(clearBtn);

        item.appendChild(leftSection);
        item.appendChild(rightSection);

        // Apply existing pin styling if this package is already pinned
        if (this.versionPins[pkg.id]) {
            item.classList.add('bg-blue-50', 'border-blue-300');
        }

        return item;
    }

    private handleClearPins(): void {
        this.versionPins = {};

        // Clear all version inputs and styling
        const packageList = document.getElementById('pin-package-list');
        if (packageList) {
            const inputs = packageList.querySelectorAll('input[type="text"]') as NodeListOf<HTMLInputElement>;
            inputs.forEach(input => {
                input.value = '';
            });

            const items = packageList.querySelectorAll('.bg-blue-50');
            items.forEach(item => {
                item.classList.remove('bg-blue-50', 'border-blue-300');
            });
        }

        this.updatePinnedCount();

        if (this.consoleLogger) {
            this.consoleLogger.info('Cleared all version pins', 'Version Pinning');
        }
    } private updatePinnedCount(): void {
        const countElement = document.getElementById('pinned-count');
        if (countElement) {
            const count = Object.keys(this.versionPins).length;
            countElement.textContent = `${count} package${count !== 1 ? 's' : ''} pinned`;
        }
    }

    // Config picker functionality
    private configPaths: string[] = [];
    private registryKeys: string[] = [];

    private handleAddConfigPath(): void {
        const modal = document.getElementById('config-path-modal');
        if (modal) {
            modal.classList.remove('hidden');
            const input = document.getElementById('config-path-input') as HTMLInputElement;
            if (input) {
                input.value = '';
                input.focus();
            }
        }
    }

    private handleConfirmConfigPath(): void {
        const input = document.getElementById('config-path-input') as HTMLInputElement;
        const errorElement = document.getElementById('config-path-error');

        if (!input) return;

        const path = input.value.trim();
        if (!path) {
            this.showConfigError('Please enter a path');
            return;
        }

        // Basic path validation (would need proper file system validation in real app)
        if (!this.validateConfigPath(path)) {
            this.showConfigError('Path does not exist or is invalid');
            return;
        }

        // Add to config paths if not already present
        if (!this.configPaths.includes(path)) {
            this.configPaths.push(path);
            this.updateConfigPathsList();

            if (this.consoleLogger) {
                this.consoleLogger.info(`Added config path: ${path}`, 'Config Backup');
            }
        }

        // Hide modal and clear error
        this.handleCancelConfigPath();
        if (errorElement) {
            errorElement.classList.add('hidden');
        }
    }

    private handleCancelConfigPath(): void {
        const modal = document.getElementById('config-path-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    private validateConfigPath(path: string): boolean {
        // Basic validation - in a real app, this would check if the path exists
        // For now, just check format
        return path.length > 0 && (path.includes('\\') || path.includes('/'));
    }

    private showConfigError(message: string): void {
        const errorElement = document.getElementById('config-path-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
    }

    private updateConfigPathsList(): void {
        const listElement = document.getElementById('config-paths-list');
        const emptyElement = document.getElementById('config-paths-empty');

        if (!listElement || !emptyElement) return;

        if (this.configPaths.length === 0) {
            emptyElement.style.display = 'block';
            listElement.innerHTML = '';
        } else {
            emptyElement.style.display = 'none';
            listElement.innerHTML = this.configPaths.map((path, index) => `
                <div class="config-path-item flex items-center justify-between p-2 bg-white rounded border">
                    <div class="flex items-center space-x-2">
                        <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z"></path>
                        </svg>
                        <span class="text-sm font-mono">${path}</span>
                    </div>
                    <button class="remove-btn text-red-600 hover:text-red-800 p-1" onclick="appController.removeConfigPath(${index})">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                        </svg>
                    </button>
                </div>
            `).join('');
        }
    }

    public removeConfigPath(index: number): void {
        if (index >= 0 && index < this.configPaths.length) {
            const removedPath = this.configPaths[index];
            this.configPaths.splice(index, 1);
            this.updateConfigPathsList();

            if (this.consoleLogger) {
                this.consoleLogger.info(`Removed config path: ${removedPath}`, 'Config Backup');
            }
        }
    }

    private handleAddRegistryKey(): void {
        const input = document.getElementById('registry-key-input') as HTMLInputElement;
        const errorElement = document.getElementById('registry-key-error');

        if (!input) return;

        const key = input.value.trim();
        if (!key) {
            this.showRegistryError('Please enter a registry key');
            return;
        }

        // Validate registry key format
        if (!this.validateRegistryKey(key)) {
            this.showRegistryError('Invalid registry key format. Use HKEY_* format.');
            return;
        }

        // Add to registry keys if not already present
        if (!this.registryKeys.includes(key)) {
            this.registryKeys.push(key);
            this.updateRegistryKeysList();
            input.value = '';

            if (this.consoleLogger) {
                this.consoleLogger.info(`Added registry key: ${key}`, 'Config Backup');
            }
        }

        // Clear error
        if (errorElement) {
            errorElement.classList.add('hidden');
        }
    }

    private validateRegistryKey(key: string): boolean {
        // Basic registry key validation
        const validRoots = ['HKEY_CLASSES_ROOT', 'HKEY_CURRENT_USER', 'HKEY_LOCAL_MACHINE', 'HKEY_USERS', 'HKEY_CURRENT_CONFIG'];
        return validRoots.some(root => key.startsWith(root + '\\'));
    }

    private showRegistryError(message: string): void {
        const errorElement = document.getElementById('registry-key-error');
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.classList.remove('hidden');
        }
    }

    private updateRegistryKeysList(): void {
        const listElement = document.getElementById('registry-keys-list');
        if (!listElement) return;

        listElement.innerHTML = this.registryKeys.map((key, index) => `
            <div class="flex items-center justify-between p-1 bg-gray-100 rounded text-sm">
                <span class="font-mono">${key}</span>
                <button class="text-red-600 hover:text-red-800 p-1" onclick="appController.removeRegistryKey(${index})">
                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
                    </svg>
                </button>
            </div>
        `).join('');
    }

    public removeRegistryKey(index: number): void {
        if (index >= 0 && index < this.registryKeys.length) {
            const removedKey = this.registryKeys[index];
            this.registryKeys.splice(index, 1);
            this.updateRegistryKeysList();

            if (this.consoleLogger) {
                this.consoleLogger.info(`Removed registry key: ${removedKey}`, 'Config Backup');
            }
        }
    }

    private handlePreviewConfigBackup(): void {
        const modal = document.getElementById('config-backup-preview');
        const contentElement = document.getElementById('config-preview-content');
        const sizeElement = document.getElementById('backup-size-estimate');

        if (!modal || !contentElement) return;

        // Generate preview content
        let previewHtml = '<div class="space-y-4">';

        if (this.configPaths.length > 0) {
            previewHtml += `
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">Configuration Files & Folders (${this.configPaths.length})</h4>
                    <div class="bg-gray-50 rounded p-3 max-h-48 overflow-y-auto">
                        ${this.configPaths.map(path => `
                            <div class="flex items-center space-x-2 mb-1">
                                <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z"></path>
                                </svg>
                                <span class="text-sm font-mono">${path}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (this.registryKeys.length > 0) {
            previewHtml += `
                <div>
                    <h4 class="font-medium text-gray-900 mb-2">Registry Keys (${this.registryKeys.length})</h4>
                    <div class="bg-gray-50 rounded p-3 max-h-48 overflow-y-auto">
                        ${this.registryKeys.map(key => `
                            <div class="flex items-center space-x-2 mb-1">
                                <svg class="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                                </svg>
                                <span class="text-sm font-mono">${key}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        if (this.configPaths.length === 0 && this.registryKeys.length === 0) {
            previewHtml += `
                <div class="text-center py-8 text-gray-500">
                    <svg class="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                            d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2 2z"></path>
                    </svg>
                    <p>No configuration items selected</p>
                    <p class="text-sm">Add files, folders, or registry keys to preview backup contents</p>
                </div>
            `;
        }

        previewHtml += '</div>';
        contentElement.innerHTML = previewHtml;

        // Show estimated size
        if (sizeElement) {
            const totalItems = this.configPaths.length + this.registryKeys.length;
            sizeElement.textContent = `Estimated backup size: ~${Math.max(1, totalItems * 2)}KB (${totalItems} items)`;
        }

        modal.classList.remove('hidden');
    }

    private handleCloseConfigPreview(): void {
        const modal = document.getElementById('config-backup-preview');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    // ...existing code...
}
