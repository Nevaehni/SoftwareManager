// AppController logic included directly to avoid module loading issues
class AppController {
    constructor() {
        this.selectedBundlePath = null;
    } initialize() {
        this.setupEventListeners();
        this.loadSettings();
        this.setupProgressListeners();
        this.setupDragAndDrop(); this.setupDragAndDrop();        this.initializePackageSearch();
    }initializePackageSearch() {
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
