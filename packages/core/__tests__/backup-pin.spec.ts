import { BackupService } from '../src/backup-service';
import { PackageAdapter, PackageInfo } from '../src/package-adapter';
import * as fs from 'fs';

// Mock fs
jest.mock('fs');
const mockFs = fs as jest.Mocked<typeof fs>;

describe('BackupService Version Pinning', () => {
    let backupService: BackupService;
    let mockAdapter: jest.Mocked<PackageAdapter>;

    beforeEach(() => {
        jest.clearAllMocks();

        // Setup mock adapter
        mockAdapter = {
            exportList: jest.fn(),
            search: jest.fn(),
            install: jest.fn(),
            uninstall: jest.fn(),
            ensurePresent: jest.fn(),
            listInstalled: jest.fn()
        };

        backupService = new BackupService();
        backupService.addAdapter('winget', mockAdapter);

        // Mock fs operations
        mockFs.existsSync.mockReturnValue(true);
        mockFs.mkdirSync.mockImplementation(() => '');
        mockFs.readFileSync.mockReturnValue('packages:\n  - id: Git.Git\n    name: Git\n    version: 2.45.0');
        mockFs.writeFileSync.mockImplementation(() => { });
        mockFs.unlinkSync.mockImplementation(() => { });
    });

    describe('Version Pinning Configuration', () => {
        it('should allow setting version pinning preferences for packages', async () => {
            // Red phase: Test that fails because version pinning doesn't exist yet
            const versionPins = {
                'Git.Git': '2.45.0',
                'Microsoft.VisualStudioCode': '1.90.0'
            };

            // This should not throw an error when version pinning is implemented
            expect(() => {
                backupService.setVersionPinning(versionPins);
            }).not.toThrow();
        });

        it('should validate version pin format', async () => {
            // Red phase: Version pinning validation doesn't exist yet
            const invalidVersionPins = {
                'Git.Git': 'invalid-version',
                'Microsoft.VisualStudioCode': ''
            };

            expect(() => {
                backupService.setVersionPinning(invalidVersionPins);
            }).toThrow('Invalid version format');
        });

        it('should apply version pins during backup creation', async () => {
            // Red phase: Version pinning in backup doesn't exist yet
            const versionPins = {
                'Git.Git': '2.44.0', // Pin to older version
                'Microsoft.VisualStudioCode': '1.89.0'
            };

            // Mock installed packages with current versions
            const installedPackages: PackageInfo[] = [
                { id: 'Git.Git', name: 'Git', version: '2.45.0', source: 'winget' },
                { id: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code', version: '1.90.0', source: 'winget' }
            ];

            mockAdapter.listInstalled = jest.fn().mockResolvedValue(installedPackages);

            backupService.setVersionPinning(versionPins);

            await backupService.run();

            // Check that backup contains pinned versions instead of installed versions
            const writeCall = mockFs.writeFileSync.mock.calls.find(call =>
                call[0] === 'tmp/spec.yaml'
            );
            expect(writeCall).toBeDefined();

            const backupContent = writeCall![1] as string;
            expect(backupContent).toContain('version: 2.44.0'); // Pinned version for Git
            expect(backupContent).toContain('version: 1.89.0'); // Pinned version for VS Code
            expect(backupContent).not.toContain('version: 2.45.0'); // Should not contain current version
            expect(backupContent).not.toContain('version: 1.90.0'); // Should not contain current version
        });

        it('should use installed version when no pin is specified', async () => {
            // Red phase: Selective version pinning doesn't exist yet
            const versionPins = {
                'Git.Git': '2.44.0' // Only pin Git, leave VS Code unpinned
            };

            const installedPackages: PackageInfo[] = [
                { id: 'Git.Git', name: 'Git', version: '2.45.0', source: 'winget' },
                { id: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code', version: '1.90.0', source: 'winget' }
            ];

            mockAdapter.listInstalled = jest.fn().mockResolvedValue(installedPackages);

            backupService.setVersionPinning(versionPins);

            await backupService.run();

            const writeCall = mockFs.writeFileSync.mock.calls.find(call =>
                call[0] === 'tmp/spec.yaml'
            );
            expect(writeCall).toBeDefined();

            const backupContent = writeCall![1] as string;
            expect(backupContent).toContain('version: 2.44.0'); // Pinned version for Git
            expect(backupContent).toContain('version: 1.90.0'); // Installed version for VS Code (no pin)
        });
    });

    describe('Backup File Format with Version Pins', () => {
        it('should include pinned version metadata in backup', async () => {
            // Red phase: Backup metadata for version pins doesn't exist yet
            const versionPins = {
                'Git.Git': '2.44.0'
            };

            const installedPackages: PackageInfo[] = [
                { id: 'Git.Git', name: 'Git', version: '2.45.0', source: 'winget' }
            ];

            mockAdapter.listInstalled = jest.fn().mockResolvedValue(installedPackages);

            backupService.setVersionPinning(versionPins);

            await backupService.run();

            const writeCall = mockFs.writeFileSync.mock.calls.find(call =>
                call[0] === 'tmp/spec.yaml'
            );
            expect(writeCall).toBeDefined();

            const backupContent = writeCall![1] as string;
            // Should include metadata about version pinning
            expect(backupContent).toContain('# VERSION PINNING');
            expect(backupContent).toContain('# Git.Git: 2.44.0 (pinned from 2.45.0)');
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid package IDs in version pins gracefully', async () => {
            // Red phase: Error handling for invalid package IDs doesn't exist yet
            const versionPins = {
                'NonExistent.Package': '1.0.0',
                'Git.Git': '2.44.0'
            };

            const installedPackages: PackageInfo[] = [
                { id: 'Git.Git', name: 'Git', version: '2.45.0', source: 'winget' }
            ];

            mockAdapter.listInstalled = jest.fn().mockResolvedValue(installedPackages);

            backupService.setVersionPinning(versionPins);

            // Should not throw error, but should log warning
            await expect(backupService.run()).resolves.not.toThrow();
        });
    });
});
