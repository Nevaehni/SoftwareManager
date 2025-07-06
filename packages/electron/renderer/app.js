// AppController logic included directly to avoid module loading issues
class AppController {
    constructor() {
        this.selectedBundlePath = null;
    } initialize() {
        this.setupEventListeners();
        this.loadSettings();
        this.setupProgressListeners();
        this.setupDragAndDrop(); this.setupDragAndDrop(); this.initializePackageSearch();
        this.setupPackageTabs();
    } initializePackageSearch() {
        // Function to initialize the package search UI
        const initSearchUI = () => {
            if (!window.packageSearchUI) {
                try {
                    // PackageSearchUI will be loaded from separate file
                    if (typeof PackageSearchUI !== 'undefined') {
                        window.packageSearchUI = new PackageSearchUI();
                        console.log('Package search UI initialized');
                    } else {
                        console.error('PackageSearchUI class not found');
                    }
                } catch (error) {
                    console.error('Failed to initialize package search UI:', error);
                }
            }
        };

        // Initialize immediately if packages section is visible
        setTimeout(() => {
            const packagesSection = document.getElementById('packages');
            if (packagesSection && !packagesSection.classList.contains('hidden')) {
                initSearchUI();
            }
        }, 200);

        // Also initialize when packages section is shown
        const packagesNavItem = document.querySelector('a[onclick="showSection(\'packages\')"]');
        if (packagesNavItem) {
            packagesNavItem.addEventListener('click', () => {
                // Delay initialization to ensure DOM is ready
                setTimeout(initSearchUI, 100);
            });
        }
    }

    setupPackageTabs() {
        // Set up tab switching functionality
        const tabs = document.querySelectorAll('.package-tab');
        const views = document.querySelectorAll('.package-view');

        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetView = tab.dataset.target;

                // Remove active class from all tabs
                tabs.forEach(t => t.classList.remove('active'));
                // Add active class to clicked tab
                tab.classList.add('active');

                // Hide all views
                views.forEach(view => view.classList.add('hidden'));
                // Show target view
                const targetElement = document.getElementById(targetView);
                if (targetElement) {
                    targetElement.classList.remove('hidden');
                }

                // If switching to installed packages, load them
                if (targetView === 'installed-packages-view') {
                    this.loadInstalledPackages();
                }
            });
        });

        // Set up refresh button for installed packages
        const refreshBtn = document.getElementById('refresh-installed-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => this.loadInstalledPackages());
        }
    }

    async loadInstalledPackages() {
        if (!window.electronAPI) {
            this.updateUninstallStatus('❌ Application error: electronAPI not available', true);
            return;
        }

        try {
            this.updateUninstallStatus('🔄 Loading installed packages...', false);

            const refreshBtn = document.getElementById('refresh-installed-btn');
            if (refreshBtn) refreshBtn.disabled = true;

            const result = await window.electronAPI.listInstalledPackages();

            if (result.success && result.packages) {
                this.displayInstalledPackages(result.packages);
                this.updateUninstallStatus(`Found ${result.packages.length} installed packages`, false);
            } else {
                this.updateUninstallStatus(`❌ Failed to load packages: ${result.error || 'Unknown error'}`, true);
                this.clearInstalledPackages();
            }
        } catch (error) {
            console.error('Load packages error:', error);
            this.updateUninstallStatus(`❌ Failed to load packages: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
            this.clearInstalledPackages();
        } finally {
            const refreshBtn = document.getElementById('refresh-installed-btn');
            if (refreshBtn) refreshBtn.disabled = false;
        }
    } displayInstalledPackages(packages) {
        const packagesList = document.getElementById('installed-packages-list');
        if (!packagesList) return;

        if (packages.length === 0) {
            packagesList.innerHTML = '<p class="text-gray-500 text-center py-4">No packages found</p>';
            packagesList.classList.remove('has-items');
            return;
        }

        // Add class to enable scrollbar when there are items
        packagesList.classList.add('has-items');

        const packagesHtml = packages.map(pkg => `
            <div class="bg-white border border-gray-200 rounded-lg p-4 hover:border-red-300 transition-colors">
                <div class="flex items-center justify-between">
                    <div class="flex-1">
                        <h4 class="font-medium text-gray-900">${this.escapeHtml(pkg.name)}</h4>
                        <p class="text-sm text-gray-600">ID: ${this.escapeHtml(pkg.id)}</p>
                        <div class="flex items-center space-x-2 mt-1">
                            <span class="text-xs px-2 py-1 rounded ${pkg.source === 'winget' ? 'bg-blue-100 text-blue-800' : 'bg-orange-100 text-orange-800'}">${pkg.source}</span>
                            <span class="text-xs text-gray-500">v${this.escapeHtml(pkg.version)}</span>
                        </div>
                    </div>
                    <button 
                        class="uninstall-package-btn bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                        data-package-id="${this.escapeHtml(pkg.id)}"
                        data-package-source="${this.escapeHtml(pkg.source)}"
                        data-package-name="${this.escapeHtml(pkg.name)}"
                    >
                        Uninstall
                    </button>
                </div>
            </div>
        `).join('');

        packagesList.innerHTML = packagesHtml;

        // Add event listeners to uninstall buttons
        packagesList.querySelectorAll('.uninstall-package-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                this.handleUninstall(event.target);
            });
        });

        // Check scrollability of the package list
        this.checkScrollable(packagesList);
    }

    async handleUninstall(button) {
        if (!window.electronAPI) {
            this.updateUninstallStatus('❌ Application error: electronAPI not available', true);
            return;
        }

        const packageId = button.dataset.packageId;
        const source = button.dataset.packageSource;
        const packageName = button.dataset.packageName;

        try {
            // Disable button and show loading state
            button.disabled = true;
            button.textContent = 'Uninstalling...';

            this.updateUninstallStatus(`🔄 Uninstalling ${packageName}...`, false);

            const result = await window.electronAPI.uninstallPackage(packageId, source);

            if (result.success) {
                this.updateUninstallStatus(`✅ ${packageName} uninstalled successfully!`, false);
                // Remove the package from the list
                button.closest('.bg-white').remove();
            } else {
                this.updateUninstallStatus(`❌ Failed to uninstall ${packageName}: ${result.error}`, true);
                button.disabled = false;
                button.textContent = 'Uninstall';
            }
        } catch (error) {
            console.error('Uninstall error:', error);
            this.updateUninstallStatus(`❌ Uninstall failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
            button.disabled = false;
            button.textContent = 'Uninstall';
        }
    } clearInstalledPackages() {
        const packagesList = document.getElementById('installed-packages-list');
        if (packagesList) {
            packagesList.innerHTML = '<p class="text-gray-500 text-center py-4">No packages found</p>';
            packagesList.classList.remove('has-items');
        }
    }

    updateUninstallStatus(message, isError) {
        const element = document.getElementById('uninstall-status');
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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
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
        }        // Settings functionality
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
            }); if (result.filePath) {
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
    } async handleSaveSettings() {
        try {
            console.log('Save settings button clicked');

            if (!window.electronAPI) {
                console.error('electronAPI not available');
                return;
            } const enableChoco = document.getElementById('enable-choco')?.checked ?? true;
            const enableWinget = document.getElementById('enable-winget')?.checked ?? true;

            // Get package priority order from the drag-and-drop list
            const packagePriority = this.getPackagePriorityOrder();

            console.log('Current checkbox values:');
            console.log('  enable-choco checked:', enableChoco);
            console.log('  enable-winget checked:', enableWinget);
            console.log('  package priority order:', packagePriority);

            const settings = {
                enableChoco,
                enableWinget,
                packagePriority
            };

            console.log('Settings object to save:', settings);

            const result = await window.electronAPI.saveSettings(settings);

            console.log('Save result:', result);

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

            console.log('Loading settings from main process...');
            const settings = await window.electronAPI.getSettings();
            console.log('Received settings:', settings);

            const enableChocoCheckbox = document.getElementById('enable-choco');
            const enableWingetCheckbox = document.getElementById('enable-winget');

            console.log('Updating UI with settings:'); if (enableChocoCheckbox) {
                enableChocoCheckbox.checked = settings.enableChoco !== false;
                console.log('  Set enable-choco to:', enableChocoCheckbox.checked);
                this.updateToggleAppearance(enableChocoCheckbox);
            } if (enableWingetCheckbox) {
                enableWingetCheckbox.checked = settings.enableWinget !== false;
                console.log('  Set enable-winget to:', enableWingetCheckbox.checked);
                this.updateToggleAppearance(enableWingetCheckbox);
            }

            // Load package priority order
            if (settings.packagePriority) {
                this.setPackagePriorityOrder(settings.packagePriority);
                console.log('  Set package priority to:', settings.packagePriority);
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
    } updateStatus(elementId, message, isError) {
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
    } updateToggleAppearance(checkbox) {
        console.log('updateToggleAppearance called for:', checkbox.id, 'checked:', checkbox.checked);
        const toggleBg = checkbox.parentElement.querySelector('.toggle-bg');
        const toggleDot = checkbox.parentElement.querySelector('.toggle-dot');

        if (toggleBg && toggleDot) {
            console.log('Found toggle elements for:', checkbox.id);
            if (checkbox.checked) {
                console.log('Setting toggle to checked state for:', checkbox.id);
                toggleBg.classList.remove('bg-gray-300');
                toggleBg.classList.add('bg-corporate-blue');
                toggleDot.classList.add('translate-x-5');
            } else {
                console.log('Setting toggle to unchecked state for:', checkbox.id);
                toggleBg.classList.remove('bg-corporate-blue');
                toggleBg.classList.add('bg-gray-300');
                toggleDot.classList.remove('translate-x-5');
            }
        } else {
            console.error('Could not find toggle elements for:', checkbox.id);
        }
    } setupDragAndDrop() {
        const priorityList = document.getElementById('package-priority-list');
        if (!priorityList) return;

        let draggedElement = null;

        // Add event listeners to all priority items
        const items = priorityList.querySelectorAll('.priority-item');
        items.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                draggedElement = item;
                item.classList.add('opacity-50');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', item.outerHTML);
            });

            item.addEventListener('dragend', (e) => {
                item.classList.remove('opacity-50');
                draggedElement = null;

                // Clean up any drop zone indicators
                const allItems = priorityList.querySelectorAll('.priority-item');
                allItems.forEach(item => {
                    item.classList.remove('border-blue-500', 'border-2');
                });
            });

            item.addEventListener('dragenter', (e) => {
                e.preventDefault();
                if (draggedElement && draggedElement !== item) {
                    item.classList.add('border-blue-500', 'border-2');
                }
            });

            item.addEventListener('dragleave', (e) => {
                // Only remove border if we're actually leaving the item
                if (!item.contains(e.relatedTarget)) {
                    item.classList.remove('border-blue-500', 'border-2');
                }
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
            });

            item.addEventListener('drop', (e) => {
                e.preventDefault();
                item.classList.remove('border-blue-500', 'border-2');

                if (draggedElement && draggedElement !== item) {
                    const rect = item.getBoundingClientRect();
                    const midpoint = rect.top + rect.height / 2;

                    if (e.clientY < midpoint) {
                        // Insert before current item
                        priorityList.insertBefore(draggedElement, item);
                    } else {
                        // Insert after current item
                        priorityList.insertBefore(draggedElement, item.nextSibling);
                    }
                }
            });
        });

        // Also allow dropping on the container itself
        priorityList.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
        });

        priorityList.addEventListener('drop', (e) => {
            e.preventDefault();
            // If dropped on empty space, add to the end
            if (draggedElement && e.target === priorityList) {
                priorityList.appendChild(draggedElement);
            }
        });
    } getPackagePriorityOrder() {
        const priorityList = document.getElementById('package-priority-list');
        if (!priorityList) return ['winget', 'chocolatey']; // Default order

        const items = priorityList.querySelectorAll('.priority-item');
        return Array.from(items).map(item => item.dataset.manager);
    } setPackagePriorityOrder(priorityOrder) {
        const priorityList = document.getElementById('package-priority-list');
        if (!priorityList || !priorityOrder) return;

        // Get all current items
        const items = Array.from(priorityList.querySelectorAll('.priority-item'));

        // Clear the list
        priorityList.innerHTML = '';

        // Re-add items in the specified order
        priorityOrder.forEach(managerName => {
            const item = items.find(item => item.dataset.manager === managerName);
            if (item) {
                priorityList.appendChild(item);
            }
        });

        // Re-setup drag and drop after reordering
        setTimeout(() => {
            this.setupDragAndDrop();
        }, 100);
    }

    // Add scroll detection utility
    checkScrollable(element) {
        if (!element) return;

        const isScrollable = element.scrollHeight > element.clientHeight;
        if (isScrollable) {
            element.classList.add('is-scrollable');
        } else {
            element.classList.remove('is-scrollable');
        }

        // Update scroll indicator based on scroll position
        const updateScrollIndicator = () => {
            const isAtBottom = element.scrollHeight - element.clientHeight <= element.scrollTop + 1;
            if (isAtBottom) {
                element.classList.remove('is-scrollable');
            } else if (isScrollable) {
                element.classList.add('is-scrollable');
            }
        };

        // Add scroll listener to update indicator
        element.removeEventListener('scroll', updateScrollIndicator);
        element.addEventListener('scroll', updateScrollIndicator);

        // Initial check
        updateScrollIndicator();
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
