// F-03: Search & install packages (UI) - Component test
import { PackageSearchUI } from '../package-search-ui';

describe('Package Search UI', () => {
    let mockElectronAPI: any;
    let container: HTMLElement;

    beforeEach(() => {
        // Setup DOM
        container = document.createElement('div');
        container.innerHTML = `
            <div id="package-search-section">
                <input id="package-search-input" type="text" placeholder="Search packages...">
                <div id="search-results"></div>
                <button id="install-selected-btn" disabled>Install Selected</button>
            </div>
        `;
        document.body.appendChild(container);

        // Mock electronAPI
        mockElectronAPI = {
            searchPackages: jest.fn(),
            installPackage: jest.fn()
        };
        (global as any).window = { electronAPI: mockElectronAPI };
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    test('Search_input_triggers_package_search', async () => {
        // Red phase: Test that typing in search input calls electronAPI.searchPackages
        const searchInput = document.getElementById('package-search-input') as HTMLInputElement;

        mockElectronAPI.searchPackages.mockResolvedValue([
            { id: 'Git.Git', name: 'Git', version: '2.42.0' },
            { id: 'GitHub.GitHubDesktop', name: 'GitHub Desktop', version: '3.3.4' }
        ]);

        searchInput.value = 'git';
        searchInput.dispatchEvent(new Event('input'));

        // Wait for debounce
        await new Promise(resolve => setTimeout(resolve, 500));

        expect(mockElectronAPI.searchPackages).toHaveBeenCalledWith('git');
    });

    test('Search_results_display_with_install_buttons', async () => {
        // Red phase: Test that search results are displayed with individual install buttons
        const searchResults = document.getElementById('search-results') as HTMLElement;

        // This test will fail until we implement the PackageSearchUI component
        const searchUI = new PackageSearchUI();
        searchUI.displayResults([
            { id: 'Git.Git', name: 'Git', version: '2.42.0' },
            { id: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code', version: '1.85.0' }
        ]);

        const installButtons = searchResults.querySelectorAll('.install-package-btn');
        expect(installButtons).toHaveLength(2);

        const firstButton = installButtons[0] as HTMLButtonElement;
        expect(firstButton.dataset.packageId).toBe('Git.Git');
    });

    test('Install_button_triggers_package_installation', async () => {
        // Red phase: Test that clicking install button calls electronAPI.installPackage
        mockElectronAPI.installPackage.mockResolvedValue({ success: true });

        const searchUI = new PackageSearchUI();
        searchUI.displayResults([{ id: 'Git.Git', name: 'Git', version: '2.42.0' }]);

        const installButton = document.querySelector('.install-package-btn') as HTMLButtonElement;
        installButton.click();

        expect(mockElectronAPI.installPackage).toHaveBeenCalledWith('Git.Git', '2.42.0');
    });
});
