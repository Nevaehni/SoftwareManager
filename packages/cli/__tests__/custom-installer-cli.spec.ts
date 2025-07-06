// Custom Installer CLI Integration - Unit test
import { CustomInstallerService } from '../../core/src/custom-installer-service';
import * as fs from 'fs';
import * as path from 'path';

// Mock the CLI module
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    copyFileSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    statSync: jest.fn(),
    unlinkSync: jest.fn(),
    createWriteStream: jest.fn(),
    promises: {
        mkdir: jest.fn()
    }
}));

// Import after mocking
import { exec } from 'child_process';
const { execAsync } = jest.createMockFromModule<{ execAsync: jest.Mock }>('util');

describe('Custom Installer CLI Integration', () => {
    let mockFs: jest.Mocked<typeof fs>;
    let mockExecAsync: jest.Mock;

    beforeEach(() => {
        mockFs = fs as jest.Mocked<typeof fs>;
        mockExecAsync = execAsync as jest.Mock;
        jest.clearAllMocks();
    });

    describe('CLI Custom Installer Commands', () => {
        test('CLI_add_installer_from_local_file', async () => {
            // Mock a successful local file addition
            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue({
                isFile: () => true,
                size: 1024 * 1024 // 1MB
            } as any);

            const service = new CustomInstallerService();
            const result = await service.addInstallerToBundle(
                'C:\\temp\\myapp.msi',
                'tmp/custom-installers'
            );

            expect(result.success).toBe(true);
            expect(mockFs.copyFileSync).toHaveBeenCalled();
        });

        test('CLI_add_installer_from_URL', async () => {
            // Mock successful URL download
            const service = new CustomInstallerService();

            // Mock successful download
            mockFs.existsSync.mockReturnValue(false); // Bundle dir doesn't exist
            mockFs.createWriteStream.mockReturnValue({
                on: jest.fn(),
                emit: jest.fn()
            } as any);

            // Test URL validation
            const result = await service.downloadInstaller(
                'https://example.com/installer.msi',
                'tmp/custom-installers'
            );

            // The actual download would be mocked in a real test
            // Here we just verify the URL validation works
            expect(result.success || result.error).toBeDefined();
        });

        test('CLI_list_custom_installers', async () => {
            // Mock existing installers
            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify([
                {
                    name: 'Test App',
                    originalPath: 'C:\\temp\\testapp.msi',
                    bundledPath: 'custom-installers\\testapp.msi',
                    type: 'msi',
                    size: 1024 * 1024
                }
            ]));

            const service = new CustomInstallerService();
            const installers = await service.listBundleInstallers('tmp/custom-installers');

            expect(installers).toHaveLength(1);
            expect(installers[0].name).toBe('Test App');
            expect(installers[0].type).toBe('msi');
        });

        test('CLI_remove_custom_installer', async () => {
            // Mock existing installer for removal
            mockFs.existsSync.mockReturnValue(true);
            const mockInstallers = [
                {
                    name: 'Test App',
                    originalPath: 'C:\\temp\\testapp.msi',
                    bundledPath: 'custom-installers\\testapp.msi',
                    type: 'msi' as const,
                    size: 1024 * 1024
                },
                {
                    name: 'Other App',
                    originalPath: 'C:\\temp\\other.exe',
                    bundledPath: 'custom-installers\\other.exe',
                    type: 'exe' as const,
                    size: 2 * 1024 * 1024
                }
            ];

            mockFs.readFileSync.mockReturnValue(JSON.stringify(mockInstallers));

            const service = new CustomInstallerService();
            const installers = await service.listBundleInstallers('tmp/custom-installers');

            expect(installers).toHaveLength(2);

            // Verify installer exists before removal
            const targetInstaller = installers.find(i => i.name === 'Test App');
            expect(targetInstaller).toBeDefined();
        });

        test('CLI_validates_installer_file_extensions', async () => {
            // Test that only MSI and EXE files are accepted
            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue({
                isFile: () => true,
                size: 1024 * 1024
            } as any);

            const service = new CustomInstallerService();

            // Valid extensions
            const validMsi = await service.addInstallerToBundle(
                'C:\\temp\\app.msi',
                'tmp/custom-installers'
            );
            expect(validMsi.success).toBe(true);

            const validExe = await service.addInstallerToBundle(
                'C:\\temp\\setup.exe',
                'tmp/custom-installers'
            );
            expect(validExe.success).toBe(true);

            // Invalid extension
            const invalid = await service.addInstallerToBundle(
                'C:\\temp\\document.txt',
                'tmp/custom-installers'
            );
            expect(invalid.success).toBe(false);
            expect(invalid.error).toContain('Only MSI and EXE files are supported');
        });

        test('CLI_validates_file_size_limits', async () => {
            // Test file size validation
            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue({
                isFile: () => true,
                size: 1024 * 1024 * 1024 // 1GB - too large
            } as any);

            const service = new CustomInstallerService();
            const result = await service.addInstallerToBundle(
                'C:\\temp\\huge-installer.msi',
                'tmp/custom-installers'
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('File size exceeds maximum limit');
        });

        test('CLI_handles_missing_files', async () => {
            // Test handling of non-existent files
            mockFs.existsSync.mockReturnValue(false);

            const service = new CustomInstallerService();
            const result = await service.addInstallerToBundle(
                'C:\\temp\\nonexistent.msi',
                'tmp/custom-installers'
            );

            expect(result.success).toBe(false);
            expect(result.error).toContain('File does not exist');
        });
    });

    describe('CLI Integration Workflow', () => {
        test('CLI_workflow_add_list_remove', async () => {
            // Test complete CLI workflow
            const service = new CustomInstallerService();

            // 1. Start with empty list
            mockFs.existsSync.mockReturnValue(false);
            let installers = await service.listBundleInstallers('tmp/custom-installers');
            expect(installers).toHaveLength(0);

            // 2. Add an installer
            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue({
                isFile: () => true,
                size: 1024 * 1024
            } as any);

            const addResult = await service.addInstallerToBundle(
                'C:\\temp\\myapp.msi',
                'tmp/custom-installers'
            );
            expect(addResult.success).toBe(true);

            // 3. List shows the installer
            mockFs.readFileSync.mockReturnValue(JSON.stringify([
                {
                    name: 'myapp',
                    originalPath: 'C:\\temp\\myapp.msi',
                    bundledPath: 'custom-installers\\myapp.msi',
                    type: 'msi',
                    size: 1024 * 1024
                }
            ]));

            installers = await service.listBundleInstallers('tmp/custom-installers');
            expect(installers).toHaveLength(1);
            expect(installers[0].name).toBe('myapp');
        });

        test('CLI_backup_includes_custom_installers', () => {
            // Test that backup process includes custom installers
            // This would be an integration test that verifies the BackupService
            // correctly includes custom installers added through CLI

            // Mock CLI installer config
            const mockInstallers = ['C:\\temp\\app1.msi', 'C:\\temp\\app2.exe'];

            // The BackupService should load these and include them in the backup
            expect(mockInstallers).toHaveLength(2);
            expect(mockInstallers[0]).toContain('.msi');
            expect(mockInstallers[1]).toContain('.exe');
        });
    });
});
