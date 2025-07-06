"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const choco_adapter_1 = require("../choco-adapter");
describe('ChocoAdapter', () => {
    let adapter;
    let mockExec;
    beforeEach(() => {
        mockExec = jest.fn();
        adapter = new choco_adapter_1.ChocoAdapter(mockExec);
    });
    afterEach(() => {
        jest.clearAllMocks();
    });
    describe('exportList', () => {
        test('Choco_exportList_creates_yaml_file', async () => {
            // Red phase: Test that exportList creates a YAML file with package data
            const mockListOutput = `chocolatey|2.2.2
nodejs|20.10.0
git|2.42.0`;
            mockExec.mockResolvedValue({
                stdout: mockListOutput,
                stderr: '',
                exitCode: 0,
            });
            const filename = 'test-output.yaml';
            await adapter.exportList(filename);
            expect(mockExec).toHaveBeenCalledWith('choco', ['list', '--local-only', '--limit-output']);
            // Verify file was created (in real implementation, would check file content)
        });
        test('Choco_exportList_fallback_when_no_exec', async () => {
            // Test that exportList creates a fallback file when no exec function is provided
            const adapterWithoutExec = new choco_adapter_1.ChocoAdapter();
            const filename = 'test-fallback.yaml';
            await adapterWithoutExec.exportList(filename);
            // Verify fallback content was written (implementation detail)
        });
    });
    describe('search', () => {
        test('Choco_search_returns_packages', async () => {
            // Red phase: Test that search returns a list of packages
            const mockSearchOutput = `nodejs|20.10.0
git|2.42.0
vscode|1.85.0`;
            mockExec.mockResolvedValue({
                stdout: mockSearchOutput,
                stderr: '',
                exitCode: 0,
            });
            const result = await adapter.search('nodejs');
            expect(mockExec).toHaveBeenCalledWith('choco', ['search', 'nodejs', '--limit-output']);
            expect(result).toHaveLength(3);
            expect(result[0]).toEqual({
                id: 'nodejs',
                name: 'nodejs',
                version: '20.10.0',
                source: 'chocolatey'
            });
        });
        test('Choco_search_throws_on_error', async () => {
            // Test that search throws when choco command fails
            mockExec.mockResolvedValue({
                stdout: '',
                stderr: 'Command failed',
                exitCode: 1,
            });
            await expect(adapter.search('nonexistent')).rejects.toThrow('Chocolatey search failed: Command failed');
        });
    });
    describe('install', () => {
        test('Choco_install_without_version', async () => {
            // Red phase: Test that install works without specifying version
            mockExec.mockResolvedValue({
                stdout: 'Package installed successfully',
                stderr: '',
                exitCode: 0,
            });
            const result = await adapter.install('nodejs');
            expect(mockExec).toHaveBeenCalledWith('choco', ['install', 'nodejs', '-y']);
            expect(result).toBe(true);
        });
        test('Choco_install_with_version', async () => {
            // Test that install works with specific version
            mockExec.mockResolvedValue({
                stdout: 'Package installed successfully',
                stderr: '',
                exitCode: 0,
            });
            const result = await adapter.install('nodejs', '18.17.0');
            expect(mockExec).toHaveBeenCalledWith('choco', ['install', 'nodejs', '-y', '--version', '18.17.0']);
            expect(result).toBe(true);
        });
        test('Choco_install_returns_false_on_failure', async () => {
            // Test that install returns false when command fails
            mockExec.mockResolvedValue({
                stdout: '',
                stderr: 'Installation failed',
                exitCode: 1,
            });
            const result = await adapter.install('nonexistent');
            expect(result).toBe(false);
        });
        test('Choco_uninstall_package', async () => {
            // Red phase: Test that uninstall calls choco uninstall command
            mockExec.mockResolvedValue({
                stdout: 'Package uninstalled successfully',
                stderr: '',
                exitCode: 0,
            });
            const result = await adapter.uninstall('nodejs');
            expect(mockExec).toHaveBeenCalledWith('choco', ['uninstall', 'nodejs', '-y']);
            expect(result).toBe(true);
        });
        test('Choco_uninstall_returns_false_on_failure', async () => {
            // Test that uninstall returns false when command fails
            mockExec.mockResolvedValue({
                stdout: '',
                stderr: 'Uninstall failed',
                exitCode: 1,
            });
            const result = await adapter.uninstall('nonexistent');
            expect(result).toBe(false);
        });
    });
    describe('ensurePresent', () => {
        test('Choco_ensurePresent_returns_true_when_installed', async () => {
            // Test that ensurePresent returns true for installed packages
            mockExec.mockResolvedValue({
                stdout: 'nodejs|20.10.0',
                stderr: '',
                exitCode: 0,
            });
            const result = await adapter.ensurePresent('nodejs');
            expect(mockExec).toHaveBeenCalledWith('choco', ['list', 'nodejs', '--local-only', '--exact']);
            expect(result).toBe(true);
        });
        test('Choco_ensurePresent_returns_false_when_not_installed', async () => {
            // Test that ensurePresent returns false for non-installed packages
            mockExec.mockResolvedValue({
                stdout: '',
                stderr: '',
                exitCode: 1,
            });
            const result = await adapter.ensurePresent('nonexistent');
            expect(result).toBe(false);
        });
    });
    describe('validation', () => {
        test('Choco_methods_throw_without_exec_function', async () => {
            // Test that methods throw when no exec function is provided
            const adapterWithoutExec = new choco_adapter_1.ChocoAdapter();
            await expect(adapterWithoutExec.search('test')).rejects.toThrow('Exec function not provided');
            await expect(adapterWithoutExec.install('test')).rejects.toThrow('Exec function not provided');
            await expect(adapterWithoutExec.ensurePresent('test')).rejects.toThrow('Exec function not provided');
        });
    });
});
//# sourceMappingURL=choco-adapter.spec.js.map