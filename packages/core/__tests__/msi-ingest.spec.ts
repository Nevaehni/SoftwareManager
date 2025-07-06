// F-05: Add custom MSI/EXE to bundle - Unit test
import { CustomInstallerService } from '../src/custom-installer-service';
import * as fs from 'fs';
import * as path from 'path';

// Mock fs module
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    copyFileSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
    statSync: jest.fn(),
    createWriteStream: jest.fn(),
    promises: {
        mkdir: jest.fn()
    }
}));

// Mock child_process
jest.mock('child_process', () => ({
    exec: jest.fn(),
}));

// Mock util
jest.mock('util', () => ({
    promisify: jest.fn().mockReturnValue(jest.fn()),
}));

// Mock https module for URL downloads
jest.mock('https', () => ({
    get: jest.fn(),
}));

// Mock http module for URL downloads
jest.mock('http', () => ({
    get: jest.fn(),
}));

// Helper function to create a proper mock writeStream
function createMockWriteStream(): any {
    const handlers: any = {};
    const mockStream: any = {
        handlers,
        on: jest.fn((event: string, handler: Function): any => {
            handlers[event] = handler;
            return mockStream;
        }),
        emit: jest.fn((event: string, ...args: any[]): any => {
            if (handlers[event]) {
                handlers[event](...args);
            }
            return mockStream;
        })
    };
    return mockStream;
}

describe('Custom Installer Service', () => {
    let service: CustomInstallerService;
    let mockFs: jest.Mocked<typeof fs>;

    beforeEach(() => {
        service = new CustomInstallerService();
        mockFs = fs as jest.Mocked<typeof fs>;
        jest.clearAllMocks();
    });

    describe('addInstallerToBundle', () => {
        test('MSI_ingest_adds_file_to_bundle', async () => {
            // Red phase: Test that MSI files can be added to backup bundle
            const msiPath = 'C:\\temp\\custom-app.msi';
            const bundleDir = 'tmp\\custom-installers';

            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue({
                isFile: () => true,
                size: 1024 * 1024 // 1MB
            } as any);

            const result = await service.addInstallerToBundle(msiPath, bundleDir);

            expect(result.success).toBe(true);
            expect(result.installerPath).toContain('custom-app.msi');
            expect(mockFs.copyFileSync).toHaveBeenCalledWith(
                msiPath,
                expect.stringContaining('custom-app.msi')
            );
        });

        test('EXE_ingest_adds_file_to_bundle', async () => {
            // Red phase: Test that EXE files can be added to backup bundle
            const exePath = 'C:\\temp\\custom-setup.exe';
            const bundleDir = 'tmp\\custom-installers';

            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue({
                isFile: () => true,
                size: 2 * 1024 * 1024 // 2MB
            } as any);

            const result = await service.addInstallerToBundle(exePath, bundleDir);

            expect(result.success).toBe(true);
            expect(result.installerPath).toContain('custom-setup.exe');
            expect(mockFs.copyFileSync).toHaveBeenCalledWith(
                exePath,
                expect.stringContaining('custom-setup.exe')
            );
        });

        test('MSI_ingest_fails_for_nonexistent_file', async () => {
            // Red phase: Test that adding non-existent files fails gracefully
            const nonExistentPath = 'C:\\temp\\nonexistent.msi';
            const bundleDir = 'tmp\\custom-installers';

            mockFs.existsSync.mockReturnValue(false);

            const result = await service.addInstallerToBundle(nonExistentPath, bundleDir);

            expect(result.success).toBe(false);
            expect(result.error).toContain('File does not exist');
            expect(mockFs.copyFileSync).not.toHaveBeenCalled();
        });

        test('MSI_ingest_validates_file_extension', async () => {
            // Red phase: Test that only MSI/EXE files are accepted
            const invalidPath = 'C:\\temp\\document.txt';
            const bundleDir = 'tmp\\custom-installers';

            mockFs.existsSync.mockReturnValue(true);

            const result = await service.addInstallerToBundle(invalidPath, bundleDir);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Only MSI and EXE files are supported');
            expect(mockFs.copyFileSync).not.toHaveBeenCalled();
        });
    });

    describe('listBundleInstallers', () => {
        test('MSI_ingest_lists_bundled_installers', async () => {
            // Red phase: Test that bundled installers can be listed
            const bundleDir = 'tmp\\custom-installers';

            mockFs.existsSync.mockReturnValue(true);
            mockFs.readFileSync.mockReturnValue(JSON.stringify([
                {
                    name: 'Custom App',
                    originalPath: 'C:\\temp\\custom-app.msi',
                    bundledPath: 'custom-installers\\custom-app.msi',
                    type: 'msi',
                    size: 1024 * 1024
                },
                {
                    name: 'Setup Tool',
                    originalPath: 'C:\\temp\\setup.exe',
                    bundledPath: 'custom-installers\\setup.exe',
                    type: 'exe',
                    size: 2 * 1024 * 1024
                }
            ]));

            const installers = await service.listBundleInstallers(bundleDir);

            expect(installers).toHaveLength(2);
            expect(installers[0].name).toBe('Custom App');
            expect(installers[0].type).toBe('msi');
            expect(installers[1].name).toBe('Setup Tool');
            expect(installers[1].type).toBe('exe');
        });
    });

    describe('installFromBundle', () => {
        test('MSI_ingest_installs_msi_from_bundle', async () => {
            // Red phase: Test that MSI files can be installed during restore
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            execAsync.mockResolvedValue({
                stdout: 'Installation completed successfully',
                stderr: ''
            });

            const installer = {
                name: 'Custom App',
                originalPath: 'C:\\temp\\custom-app.msi',
                bundledPath: 'custom-installers\\custom-app.msi',
                type: 'msi' as const,
                size: 1024 * 1024
            };

            const result = await service.installFromBundle(installer, 'tmp\\bundle');

            expect(result.success).toBe(true);
            expect(execAsync).toHaveBeenCalledWith(
                expect.stringContaining('msiexec /i'),
                expect.any(Object)
            );
        });

        test('EXE_ingest_installs_exe_from_bundle', async () => {
            // Red phase: Test that EXE files can be installed during restore
            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            execAsync.mockResolvedValue({
                stdout: 'Installation completed successfully',
                stderr: ''
            });

            const installer = {
                name: 'Setup Tool',
                originalPath: 'C:\\temp\\setup.exe',
                bundledPath: 'custom-installers\\setup.exe',
                type: 'exe' as const,
                size: 2 * 1024 * 1024
            };

            const result = await service.installFromBundle(installer, 'tmp\\bundle');

            expect(result.success).toBe(true);
            expect(execAsync).toHaveBeenCalledWith(
                expect.stringContaining('"tmp\\bundle\\custom-installers\\setup.exe" /S'),
                expect.any(Object)
            );
        });
    });

    describe('validation', () => {
        test('MSI_ingest_validates_file_size_limit', async () => {
            // Red phase: Test that files over size limit are rejected
            const largeMsiPath = 'C:\\temp\\large-app.msi';
            const bundleDir = 'tmp\\custom-installers';

            mockFs.existsSync.mockReturnValue(true);
            mockFs.statSync.mockReturnValue({
                isFile: () => true,
                size: 1024 * 1024 * 1024 // 1GB - too large
            } as any);

            const result = await service.addInstallerToBundle(largeMsiPath, bundleDir);

            expect(result.success).toBe(false);
            expect(result.error).toContain('File size exceeds maximum limit');
        });

        test('MSI_ingest_creates_bundle_directory', async () => {
            // Red phase: Test that bundle directory is created if it doesn't exist
            const msiPath = 'C:\\temp\\app.msi';
            const bundleDir = 'tmp\\custom-installers';

            mockFs.existsSync
                .mockReturnValueOnce(true)  // File exists
                .mockReturnValueOnce(false); // Bundle dir doesn't exist
            mockFs.statSync.mockReturnValue({
                isFile: () => true,
                size: 1024 * 1024
            } as any);

            await service.addInstallerToBundle(msiPath, bundleDir);

            expect(mockFs.mkdirSync).toHaveBeenCalledWith(bundleDir, { recursive: true });
        });
    });

    describe('downloadInstaller', () => {
        test('MSI_download_from_url', async () => {
            // Red phase: Test that MSI files can be downloaded from URLs
            const https = require('https');
            const url = 'https://example.com/installer.msi';
            const bundleDir = 'tmp\\custom-installers';

            const mockWriteStream = createMockWriteStream();

            // Mock successful download
            const mockResponse = {
                statusCode: 200,
                headers: { 'content-length': '1048576' }, // 1MB
                pipe: jest.fn((writeStream) => {
                    // Simulate successful download
                    setTimeout(() => writeStream.emit('finish'), 0);
                    return writeStream;
                }),
                on: jest.fn()
            };

            https.get.mockImplementation((url: any, callback: any) => {
                callback(mockResponse);
                return { on: jest.fn() };
            });

            mockFs.existsSync.mockReturnValue(false); // Bundle dir doesn't exist
            mockFs.createWriteStream.mockReturnValue(mockWriteStream);

            const result = await service.downloadInstaller(url, bundleDir);

            expect(result.success).toBe(true);
            expect(result.installerPath).toContain('installer.msi');
            expect(https.get).toHaveBeenCalledWith(url, expect.any(Function));
        });

        test('EXE_download_from_url', async () => {
            // Red phase: Test that EXE files can be downloaded from URLs
            const https = require('https');
            const url = 'https://example.com/setup.exe';
            const bundleDir = 'tmp\\custom-installers';

            const mockWriteStream = createMockWriteStream();

            // Mock successful download
            const mockResponse = {
                statusCode: 200,
                headers: { 'content-length': '2097152' }, // 2MB
                pipe: jest.fn((writeStream) => {
                    setTimeout(() => writeStream.emit('finish'), 0);
                    return writeStream;
                }),
                on: jest.fn()
            };

            https.get.mockImplementation((url: any, callback: any) => {
                callback(mockResponse);
                return { on: jest.fn() };
            });

            mockFs.existsSync.mockReturnValue(false);
            mockFs.createWriteStream.mockReturnValue(mockWriteStream);

            const result = await service.downloadInstaller(url, bundleDir);

            expect(result.success).toBe(true);
            expect(result.installerPath).toContain('setup.exe');
        });

        test('Download_fails_for_invalid_url', async () => {
            // Red phase: Test that invalid URLs are rejected
            const invalidUrl = 'not-a-url';
            const bundleDir = 'tmp\\custom-installers';

            const result = await service.downloadInstaller(invalidUrl, bundleDir);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Invalid URL format');
        });

        test('Download_fails_for_unsupported_file_type', async () => {
            // Red phase: Test that non-MSI/EXE files are rejected
            const url = 'https://example.com/document.txt';
            const bundleDir = 'tmp\\custom-installers';

            const result = await service.downloadInstaller(url, bundleDir);

            expect(result.success).toBe(false);
            expect(result.error).toContain('Only MSI and EXE files are supported');
        });

        test('Download_fails_for_large_files', async () => {
            // Red phase: Test that files over size limit are rejected
            const https = require('https');
            const url = 'https://example.com/large-installer.msi';
            const bundleDir = 'tmp\\custom-installers';

            // Mock response with large content-length
            const mockResponse = {
                statusCode: 200,
                headers: { 'content-length': '1073741824' }, // 1GB
                pipe: jest.fn(),
                on: jest.fn()
            };

            https.get.mockImplementation((url: any, callback: any) => {
                callback(mockResponse);
                return { on: jest.fn() };
            });

            const result = await service.downloadInstaller(url, bundleDir);

            expect(result.success).toBe(false);
            expect(result.error).toContain('File size exceeds maximum limit');
        });

        test('Download_handles_http_urls', async () => {
            // Red phase: Test that HTTP URLs are supported
            const http = require('http');
            const url = 'http://example.com/installer.msi';
            const bundleDir = 'tmp\\custom-installers';

            const mockWriteStream = createMockWriteStream();

            // Mock successful download
            const mockResponse = {
                statusCode: 200,
                headers: { 'content-length': '1048576' },
                pipe: jest.fn((writeStream) => {
                    setTimeout(() => writeStream.emit('finish'), 0);
                    return writeStream;
                }),
                on: jest.fn()
            };

            http.get.mockImplementation((url: any, callback: any) => {
                callback(mockResponse);
                return { on: jest.fn() };
            });

            mockFs.createWriteStream.mockReturnValue(mockWriteStream);

            const result = await service.downloadInstaller(url, bundleDir);

            expect(result.success).toBe(true);
            expect(http.get).toHaveBeenCalledWith(url, expect.any(Function));
        });

        test('Download_handles_404_errors', async () => {
            // Red phase: Test that 404 errors are handled gracefully
            const https = require('https');
            const url = 'https://example.com/nonexistent.msi';
            const bundleDir = 'tmp\\custom-installers';

            // Mock 404 response
            const mockResponse = {
                statusCode: 404,
                headers: {},
                on: jest.fn()
            };

            https.get.mockImplementation((url: any, callback: any) => {
                callback(mockResponse);
                return { on: jest.fn() };
            });

            const result = await service.downloadInstaller(url, bundleDir);

            expect(result.success).toBe(false);
            expect(result.error).toContain('HTTP 404');
        });
    });
});
