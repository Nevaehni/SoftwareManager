"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppController = void 0;
class AppController {
    constructor() {
        this.selectedBundlePath = null;
        this.consoleLogger = null;
        this.versionPins = {};
        // ...existing code...
    }
    initialize() {
        this.setupEventListeners();
        this.loadSettings();
        this.setupProgressListeners();
        this.initializeConsoleLogger();
    }
    initializeConsoleLogger() {
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
    setupConsoleLogger() {
        if (!this.consoleLogger && typeof window !== 'undefined') {
            try {
                // Use global ConsoleLogger if available (browser version)
                if (typeof ConsoleLogger !== 'undefined') {
                    this.consoleLogger = new ConsoleLogger();
                    window.consoleLogger = this.consoleLogger;
                    console.log('Console logger initialized successfully');
                }
                else {
                    console.warn('ConsoleLogger class not found');
                }
            }
            catch (error) {
                console.error('Failed to initialize console logger:', error);
            }
        }
    }
    setupEventListeners() {
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
            // Log to console
            if (this.consoleLogger) {
                this.consoleLogger.info('Starting backup operation...', 'Backup');
                if (Object.keys(this.versionPins).length > 0) {
                    this.consoleLogger.info(`Applying ${Object.keys(this.versionPins).length} version pins`, 'Backup');
                }
            }
            // Disable button during backup
            if (backupBtn)
                backupBtn.disabled = true;
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
                }
                else {
                    this.consoleLogger.error('Backup operation failed', 'Backup');
                }
            }
            // Re-enable button
            if (backupBtn)
                backupBtn.disabled = false;
        }
        catch (error) {
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
                // Enable preview button
                const previewBtn = document.getElementById('preview-restore-btn');
                if (previewBtn) {
                    previewBtn.disabled = false;
                }
                // Show preview section
                const previewSection = document.getElementById('restore-preview-section');
                if (previewSection) {
                    previewSection.classList.remove('hidden');
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
            // Log to console
            if (this.consoleLogger) {
                this.consoleLogger.info(`Starting restore operation from: ${this.selectedBundlePath}`, 'Restore');
            }
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
            // Log result to console
            if (this.consoleLogger) {
                if (result.success) {
                    this.consoleLogger.success('Restore operation completed successfully', 'Restore');
                }
                else {
                    this.consoleLogger.error('Restore operation failed', 'Restore');
                }
            }
            // Re-enable button
            if (restoreBtn)
                restoreBtn.disabled = false;
        }
        catch (error) {
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
        // Listen for preview progress
        window.electronAPI.onPreviewProgress((progress) => {
            // Log preview progress to console
            if (this.consoleLogger) {
                this.consoleLogger.info(`[${progress.progress}%] ${progress.message}`, 'Preview');
            }
        });
    }
    updateProgress(type, progress, message) {
        const progressBarElement = document.getElementById(`${type}-progress`);
        const progressFillElement = progressBarElement?.querySelector('.progress-fill');
        const statusElement = document.getElementById(`${type}-status`);
        // Log progress to console
        if (this.consoleLogger) {
            if (type === 'backup') {
                this.consoleLogger.logBackupProgress(progress, message);
            }
            else {
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
    async handlePreviewRestore() {
        if (!this.selectedBundlePath)
            return;
        try {
            const previewBtn = document.getElementById('preview-restore-btn');
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
            }
            else {
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
        }
        catch (error) {
            console.error('Preview failed:', error);
            // Log error to console
            if (this.consoleLogger) {
                this.consoleLogger.error(`Preview analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Preview');
            }
            // Re-enable button
            const previewBtn = document.getElementById('preview-restore-btn');
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
    displayPreviewResults(preview) {
        // Update summary counts
        this.updateElement('preview-new-count', preview.summary.willInstall.toString());
        this.updateElement('preview-upgrade-count', preview.summary.willUpgrade.toString());
        this.updateElement('preview-downgrade-count', preview.summary.willDowngrade.toString());
        this.updateElement('preview-reinstall-count', preview.summary.willReinstall.toString());
        this.updateElement('preview-skip-count', preview.summary.willSkip.toString());
        // Display detailed lists
        this.displayPackageList('preview-new-installs', 'preview-new-list', preview.newInstalls, (pkg) => `<div class="flex items-center justify-between p-2 bg-white rounded border">
                <span class="font-medium">${pkg.name}</span>
                <span class="text-sm text-gray-600">v${pkg.bundleVersion}</span>
            </div>`);
        this.displayPackageList('preview-upgrades', 'preview-upgrade-list', preview.upgrades, (pkg) => `<div class="flex items-center justify-between p-2 bg-white rounded border">
                <span class="font-medium">${pkg.name}</span>
                <span class="text-sm text-gray-600">v${pkg.installedVersion} → v${pkg.bundleVersion}</span>
            </div>`);
        this.displayPackageList('preview-downgrades', 'preview-downgrade-list', preview.downgrades, (pkg) => `<div class="flex items-center justify-between p-2 bg-white rounded border">
                <span class="font-medium">${pkg.name}</span>
                <span class="text-sm text-gray-600">v${pkg.installedVersion} → v${pkg.bundleVersion}</span>
            </div>`);
        this.displayPackageList('preview-reinstalls', 'preview-reinstall-list', preview.reinstalls, (pkg) => `<div class="flex items-center justify-between p-2 bg-white rounded border">
                <span class="font-medium">${pkg.name}</span>
                <span class="text-sm text-gray-600">v${pkg.bundleVersion}</span>
            </div>`);
        // Show preview results
        const previewResults = document.getElementById('preview-results');
        if (previewResults) {
            previewResults.classList.remove('hidden');
        }
    }
    displayPackageList(sectionId, listId, packages, formatPackage) {
        const section = document.getElementById(sectionId);
        const list = document.getElementById(listId);
        if (!section || !list)
            return;
        if (packages.length > 0) {
            section.classList.remove('hidden');
            list.innerHTML = packages.map(formatPackage).join('');
        }
        else {
            section.classList.add('hidden');
        }
    }
    updateElement(id, content) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = content;
        }
    }
    async handleLoadPackages() {
        try {
            const loadBtn = document.getElementById('load-packages-btn');
            const loadingDiv = document.getElementById('packages-loading');
            const packagesDiv = document.getElementById('version-pin-packages');
            const emptyDiv = document.getElementById('version-pin-empty');
            const packageList = document.getElementById('pin-package-list');
            if (!loadBtn || !loadingDiv || !packagesDiv || !emptyDiv || !packageList)
                return;
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
                const packagesBySource = result.packages.reduce((acc, pkg) => {
                    if (!acc[pkg.source])
                        acc[pkg.source] = [];
                    acc[pkg.source].push(pkg);
                    return acc;
                }, {});
                // Render packages grouped by source
                Object.entries(packagesBySource).forEach(([source, packages]) => {
                    // Add source header
                    const sourceHeader = document.createElement('div');
                    sourceHeader.className = 'text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2 mt-4 first:mt-0';
                    sourceHeader.textContent = source;
                    packageList.appendChild(sourceHeader);
                    // Add packages for this source
                    packages.forEach(pkg => {
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
            }
            else {
                if (this.consoleLogger) {
                    this.consoleLogger.error(`Failed to load packages: ${result.error || 'Unknown error'}`, 'Version Pinning');
                }
                emptyDiv.classList.remove('hidden');
            }
        }
        catch (error) {
            console.error('Failed to load packages:', error);
            if (this.consoleLogger) {
                this.consoleLogger.error(`Failed to load packages: ${error}`, 'Version Pinning');
            }
            const emptyDiv = document.getElementById('version-pin-empty');
            if (emptyDiv)
                emptyDiv.classList.remove('hidden');
        }
        finally {
            const loadBtn = document.getElementById('load-packages-btn');
            const loadingDiv = document.getElementById('packages-loading');
            if (loadBtn)
                loadBtn.disabled = false;
            if (loadingDiv)
                loadingDiv.classList.add('hidden');
        }
    }
    createPackageItem(pkg) {
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
            const target = e.target;
            const value = target.value.trim();
            if (value) {
                this.versionPins[pkg.id] = value;
                item.classList.add('bg-blue-50', 'border-blue-300');
            }
            else {
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
    handleClearPins() {
        this.versionPins = {};
        // Clear all version inputs and styling
        const packageList = document.getElementById('pin-package-list');
        if (packageList) {
            const inputs = packageList.querySelectorAll('input[type="text"]');
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
    }
    updatePinnedCount() {
        const countElement = document.getElementById('pinned-count');
        if (countElement) {
            const count = Object.keys(this.versionPins).length;
            countElement.textContent = `${count} package${count !== 1 ? 's' : ''} pinned`;
        }
    }
}
exports.AppController = AppController;
//# sourceMappingURL=app-controller.js.map