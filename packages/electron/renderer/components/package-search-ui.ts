// F-03: Package Search UI Component
export interface PackageInfo {
    id: string;
    name: string;
    version: string;
    source: string;
}

export class PackageSearchUI {
    private searchInput: HTMLInputElement;
    private searchResults: HTMLElement;
    private statusElement: HTMLElement;
    private searchTimeout: NodeJS.Timeout | null = null;

    constructor() {
        this.searchInput = document.getElementById('package-search-input') as HTMLInputElement;
        this.searchResults = document.getElementById('search-results') as HTMLElement;
        this.statusElement = document.getElementById('search-status') as HTMLElement;

        this.setupEventListeners();
    }

    private setupEventListeners(): void {
        if (this.searchInput) {
            this.searchInput.addEventListener('input', (event) => {
                const query = (event.target as HTMLInputElement).value;
                this.debounceSearch(query);
            });
        }
    }

    private debounceSearch(query: string): void {
        if (this.searchTimeout) {
            clearTimeout(this.searchTimeout);
        }

        this.searchTimeout = setTimeout(() => {
            this.performSearch(query);
        }, 300); // 300ms debounce
    }

    private async performSearch(query: string): Promise<void> {
        if (!window.electronAPI) {
            this.updateStatus('❌ Application error: electronAPI not available', true);
            return;
        }

        if (query.trim().length < 2) {
            this.clearResults();
            return;
        }

        try {
            this.updateStatus('🔍 Searching packages...', false);
            const result = await window.electronAPI.searchPackages(query);

            if (result.success && result.packages) {
                this.displayResults(result.packages);
                this.updateStatus(`Found ${result.packages.length} packages`, false);
            } else {
                this.updateStatus(`❌ Search failed: ${result.error || 'No packages found'}`, true);
                this.clearResults();
            }
        } catch (error) {
            console.error('Search error:', error);
            this.updateStatus(`❌ Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
            this.clearResults();
        }
    } public displayResults(packages: PackageInfo[]): void {
        if (!this.searchResults) return;

        if (packages.length === 0) {
            this.searchResults.innerHTML = '<p class="text-gray-500 text-center py-4">No packages found</p>';
            this.searchResults.classList.remove('has-items');
            return;
        }

        // Add class to enable scrollbar when there are items
        this.searchResults.classList.add('has-items');

        const resultsHtml = packages.map(pkg => `
            <div class="bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors">
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
                        class="install-package-btn bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                        data-package-id="${this.escapeHtml(pkg.id)}"
                        data-package-source="${this.escapeHtml(pkg.source)}"
                        data-package-version="${this.escapeHtml(pkg.version)}"
                        data-package-name="${this.escapeHtml(pkg.name)}"
                    >
                        Install
                    </button>
                </div>
            </div>
        `).join('');

        this.searchResults.innerHTML = resultsHtml;

        // Add event listeners to install buttons
        this.searchResults.querySelectorAll('.install-package-btn').forEach(button => {
            button.addEventListener('click', (event) => {
                this.handleInstall(event.target as HTMLButtonElement);
            });
        });

        // Check if the results container is scrollable
        this.checkScrollable(this.searchResults);
    }

    private async handleInstall(button: HTMLButtonElement): Promise<void> {
        if (!window.electronAPI) {
            this.updateStatus('❌ Application error: electronAPI not available', true);
            return;
        }

        const packageId = button.dataset.packageId!;
        const source = button.dataset.packageSource!;
        const version = button.dataset.packageVersion;
        const packageName = button.dataset.packageName!;

        try {
            // Disable button and show loading state
            button.disabled = true;
            button.textContent = 'Installing...';

            this.updateStatus(`🔄 Installing ${packageName}...`, false);

            const result = await window.electronAPI.installPackage(packageId, source, version);

            if (result.success) {
                this.updateStatus(`✅ ${packageName} installed successfully!`, false);
                button.textContent = 'Installed';
                button.classList.remove('bg-green-600', 'hover:bg-green-700');
                button.classList.add('bg-gray-400', 'cursor-not-allowed');
            } else {
                this.updateStatus(`❌ Failed to install ${packageName}: ${result.error}`, true);
                button.disabled = false;
                button.textContent = 'Install';
            }
        } catch (error) {
            console.error('Install error:', error);
            this.updateStatus(`❌ Install failed: ${error instanceof Error ? error.message : 'Unknown error'}`, true);
            button.disabled = false;
            button.textContent = 'Install';
        }
    } private clearResults(): void {
        if (this.searchResults) {
            this.searchResults.innerHTML = '<p class="text-gray-500 text-center py-8">Start typing to search for packages...</p>';
            this.searchResults.classList.remove('has-items');
        }
    }

    private updateStatus(message: string, isError: boolean): void {
        if (!this.statusElement) return;

        this.statusElement.textContent = message;
        this.statusElement.classList.remove('hidden');

        // Clear existing classes
        this.statusElement.classList.remove('bg-green-50', 'border-green-200', 'text-green-800',
            'bg-red-50', 'border-red-200', 'text-red-800',
            'bg-blue-50', 'border-blue-200', 'text-blue-800');

        if (isError) {
            this.statusElement.classList.add('bg-red-50', 'border-red-200', 'text-red-800');
        } else if (message.includes('✅')) {
            this.statusElement.classList.add('bg-green-50', 'border-green-200', 'text-green-800');
        } else {
            this.statusElement.classList.add('bg-blue-50', 'border-blue-200', 'text-blue-800');
        }
    }

    private escapeHtml(text: string): string {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Add scroll detection utility
    private checkScrollable(element: HTMLElement): void {
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

// Global variable to hold the instance
declare global {
    interface Window {
        packageSearchUI?: PackageSearchUI;
        PackageSearchUI: typeof PackageSearchUI;
    }
}

// Make the class available globally
(window as any).PackageSearchUI = PackageSearchUI;
