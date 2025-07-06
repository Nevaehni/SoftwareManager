"use strict";
// F-03: Search & install packages (UI) - Component test
// Load the browser-compatible version
require('../package-search-ui-browser.js');
// Now we can access the class from the global window object
const PackageSearchUI = global.window.PackageSearchUI;
describe('Package Search UI', () => {
    let mockElectronAPI;
    let container;
    beforeEach(() => {
        // Setup DOM
        container = document.createElement('div');
        container.innerHTML = `
            <div id="package-search-section">
                <input id="package-search-input" type="text" placeholder="Search packages...">
                <div id="search-results"></div>
                <div id="search-status" class="hidden"></div>
                <button id="install-selected-btn" disabled>Install Selected</button>
            </div>
        `;
        document.body.appendChild(container); // Mock electronAPI
        mockElectronAPI = {
            searchPackages: jest.fn(),
            installPackage: jest.fn()
        };
        // Setup global window mock properly
        global.window = {
            electronAPI: mockElectronAPI,
            PackageSearchUI: PackageSearchUI
        };
        // Use fake timers
        jest.useFakeTimers();
    });
    afterEach(() => {
        document.body.removeChild(container);
        jest.restoreAllMocks();
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });
    test('Search_input_triggers_package_search', async () => {
        // Test that typing in search input calls electronAPI.searchPackages
        mockElectronAPI.searchPackages.mockResolvedValue({
            success: true,
            packages: [
                { id: 'Git.Git', name: 'Git', version: '2.42.0', source: 'winget' },
                { id: 'GitHub.GitHubDesktop', name: 'GitHub Desktop', version: '3.3.4', source: 'winget' }
            ]
        });
        const searchUI = new PackageSearchUI();
        const searchInput = document.getElementById('package-search-input');
        // Ensure the input value is at least 2 characters as per the implementation
        searchInput.value = 'git';
        // Create and dispatch the input event with the proper target
        const inputEvent = new Event('input', { bubbles: true });
        Object.defineProperty(inputEvent, 'target', {
            writable: false,
            value: searchInput
        });
        searchInput.dispatchEvent(inputEvent);
        // Fast-forward timers to trigger the debounced function
        jest.advanceTimersByTime(400);
        // Wait for any promises to resolve with more time
        await new Promise(resolve => setTimeout(resolve, 100));
        expect(mockElectronAPI.searchPackages).toHaveBeenCalledWith('git');
    }, 10000); // Increase timeout
    test('Search_results_display_with_install_buttons', async () => {
        // Test that search results are displayed with individual install buttons
        const searchUI = new PackageSearchUI();
        const searchResults = document.getElementById('search-results');
        // Simulate displaying results
        searchUI.displayResults([
            { id: 'Git.Git', name: 'Git', version: '2.42.0', source: 'winget' },
            { id: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code', version: '1.85.0', source: 'winget' }
        ]);
        const installButtons = searchResults.querySelectorAll('.install-package-btn');
        expect(installButtons).toHaveLength(2);
        const firstButton = installButtons[0];
        expect(firstButton.dataset.packageId).toBe('Git.Git');
    });
    test('Install_button_triggers_package_installation', async () => {
        // Test that clicking install button calls electronAPI.installPackage
        mockElectronAPI.installPackage.mockResolvedValue({ success: true, message: 'Package installed successfully' });
        const searchUI = new PackageSearchUI();
        searchUI.displayResults([{ id: 'Git.Git', name: 'Git', version: '2.42.0', source: 'winget' }]);
        const installButton = document.querySelector('.install-package-btn');
        // Click the button and wait for async operation
        const clickPromise = new Promise((resolve) => {
            installButton.addEventListener('click', () => {
                // Give some time for the async operation to complete
                setTimeout(resolve, 200);
            });
        });
        installButton.click();
        await clickPromise;
        expect(mockElectronAPI.installPackage).toHaveBeenCalledWith('Git.Git', 'winget', '2.42.0');
    }, 10000); // Increase timeout
});
//# sourceMappingURL=package-search-ui.spec.js.map