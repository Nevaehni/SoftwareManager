import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

const execAsync = promisify(exec);

export interface CustomInstallerInfo {
    name: string;
    originalPath: string;
    bundledPath: string;
    type: 'msi' | 'exe';
    size: number;
    downloadUrl?: string; // Optional field for downloaded installers
}

export interface InstallerResult {
    success: boolean;
    installerPath?: string;
    error?: string;
}

export interface InstallResult {
    success: boolean;
    message?: string;
    error?: string;
}

export class CustomInstallerService {
    private readonly maxFileSize = 500 * 1024 * 1024; // 500MB limit
    private readonly supportedExtensions = ['.msi', '.exe'];

    /**
     * Add a custom MSI/EXE installer to the backup bundle
     */
    async addInstallerToBundle(installerPath: string, bundleDir: string): Promise<InstallerResult> {
        try {
            // Validate file exists
            if (!fs.existsSync(installerPath)) {
                return {
                    success: false,
                    error: 'File does not exist'
                };
            }

            // Validate file extension
            const ext = path.extname(installerPath).toLowerCase();
            if (!this.supportedExtensions.includes(ext)) {
                return {
                    success: false,
                    error: 'Only MSI and EXE files are supported'
                };
            }

            // Validate file size
            const stats = fs.statSync(installerPath);
            if (!stats.isFile()) {
                return {
                    success: false,
                    error: 'Path is not a file'
                };
            }

            if (stats.size > this.maxFileSize) {
                return {
                    success: false,
                    error: 'File size exceeds maximum limit'
                };
            }

            // Create bundle directory if it doesn't exist
            if (!fs.existsSync(bundleDir)) {
                fs.mkdirSync(bundleDir, { recursive: true });
            }

            // Copy file to bundle directory
            const fileName = path.basename(installerPath);
            const bundledPath = path.join(bundleDir, fileName);
            fs.copyFileSync(installerPath, bundledPath);

            // Create installer info and save to manifest
            const installerInfo: CustomInstallerInfo = {
                name: path.parse(fileName).name,
                originalPath: installerPath,
                bundledPath: path.relative(path.dirname(bundleDir), bundledPath),
                type: ext.substring(1) as 'msi' | 'exe',
                size: stats.size
            };

            await this.updateInstallerManifest(bundleDir, installerInfo);

            return {
                success: true,
                installerPath: bundledPath
            };

        } catch (error) {
            return {
                success: false,
                error: `Failed to add installer to bundle: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Download a custom installer from a URL and add it to the bundle
     */
    async downloadInstaller(url: string, bundleDir: string): Promise<InstallerResult> {
        try {
            // Validate URL
            let parsedUrl: URL;
            try {
                parsedUrl = new URL(url);
            } catch (error) {
                return {
                    success: false,
                    error: 'Invalid URL format'
                };
            }

            // Validate protocol
            if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
                return {
                    success: false,
                    error: 'Only HTTP and HTTPS URLs are supported'
                };
            }

            // Extract filename and validate extension
            const pathname = parsedUrl.pathname;
            const fileName = path.basename(pathname);
            const ext = path.extname(fileName).toLowerCase();

            if (!this.supportedExtensions.includes(ext)) {
                return {
                    success: false,
                    error: 'Only MSI and EXE files are supported'
                };
            }

            // Create bundle directory if it doesn't exist
            if (!fs.existsSync(bundleDir)) {
                fs.mkdirSync(bundleDir, { recursive: true });
            }

            const filePath = path.join(bundleDir, fileName);

            // Download the file
            const downloadResult = await this.downloadFile(url, filePath);
            if (!downloadResult.success) {
                return downloadResult;
            }

            // Get file stats
            const stats = fs.statSync(filePath);

            // Create installer info and save to manifest
            const installerInfo: CustomInstallerInfo = {
                name: path.parse(fileName).name,
                originalPath: url, // Store the URL as the original path
                bundledPath: path.relative(path.dirname(bundleDir), filePath),
                type: ext.substring(1) as 'msi' | 'exe',
                size: stats.size,
                downloadUrl: url
            };

            await this.updateInstallerManifest(bundleDir, installerInfo);

            return {
                success: true,
                installerPath: filePath
            };

        } catch (error) {
            return {
                success: false,
                error: `Failed to download installer: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Download a file from URL to local path
     */
    private downloadFile(url: string, filePath: string): Promise<InstallerResult> {
        return new Promise((resolve) => {
            const parsedUrl = new URL(url);
            const client = parsedUrl.protocol === 'https:' ? https : http;

            const request = client.get(url, (response) => {
                // Check status code
                if (response.statusCode !== 200) {
                    resolve({
                        success: false,
                        error: `HTTP ${response.statusCode}: Failed to download file`
                    });
                    return;
                }

                // Check content length if available
                const contentLength = response.headers['content-length'];
                if (contentLength) {
                    const size = parseInt(contentLength, 10);
                    if (size > this.maxFileSize) {
                        resolve({
                            success: false,
                            error: 'File size exceeds maximum limit of 500MB'
                        });
                        return;
                    }
                }

                // Create write stream
                const writeStream = fs.createWriteStream(filePath);

                // Handle download completion
                writeStream.on('finish', () => {
                    resolve({
                        success: true,
                        installerPath: filePath
                    });
                });

                // Handle write errors
                writeStream.on('error', (error) => {
                    resolve({
                        success: false,
                        error: `Failed to write file: ${error.message}`
                    });
                });

                // Pipe response to file
                response.pipe(writeStream);
            });

            // Handle request errors
            request.on('error', (error) => {
                resolve({
                    success: false,
                    error: `Download failed: ${error.message}`
                });
            });
        });
    }

    /**
     * List all custom installers in a bundle
     */
    async listBundleInstallers(bundleDir: string): Promise<CustomInstallerInfo[]> {
        try {
            const manifestPath = path.join(bundleDir, 'custom-installers.json');

            if (!fs.existsSync(manifestPath)) {
                return [];
            }

            const manifestContent = fs.readFileSync(manifestPath, 'utf8');
            return JSON.parse(manifestContent) as CustomInstallerInfo[];

        } catch (error) {
            console.warn('Failed to read installer manifest:', error);
            return [];
        }
    }

    /**
     * Install a custom installer from the bundle during restore
     */
    async installFromBundle(installer: CustomInstallerInfo, bundleBasePath: string): Promise<InstallResult> {
        try {
            const installerPath = path.join(bundleBasePath, installer.bundledPath);

            if (!fs.existsSync(installerPath)) {
                return {
                    success: false,
                    error: `Installer file not found: ${installerPath}`
                };
            }

            let command: string;

            if (installer.type === 'msi') {
                // Use msiexec for MSI files with silent installation
                command = `msiexec /i "${installerPath}" /quiet /norestart`;
            } else if (installer.type === 'exe') {
                // Use common silent installation flags for EXE files
                command = `"${installerPath}" /S /silent /quiet`;
            } else {
                return {
                    success: false,
                    error: `Unsupported installer type: ${installer.type}`
                };
            }

            const result = await execAsync(command, {
                timeout: 5 * 60 * 1000, // 5 minutes timeout
                windowsHide: true
            });

            return {
                success: true,
                message: `Successfully installed ${installer.name}`
            };

        } catch (error) {
            return {
                success: false,
                error: `Failed to install ${installer.name}: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    /**
     * Update the installer manifest file
     */
    private async updateInstallerManifest(bundleDir: string, newInstaller: CustomInstallerInfo): Promise<void> {
        const manifestPath = path.join(bundleDir, 'custom-installers.json');

        let installers: CustomInstallerInfo[] = [];

        if (fs.existsSync(manifestPath)) {
            try {
                const existing = fs.readFileSync(manifestPath, 'utf8');
                installers = JSON.parse(existing);
            } catch (error) {
                console.warn('Failed to read existing manifest, creating new one');
            }
        }

        // Add new installer (or replace if same name exists)
        const existingIndex = installers.findIndex(i => i.name === newInstaller.name);
        if (existingIndex >= 0) {
            installers[existingIndex] = newInstaller;
        } else {
            installers.push(newInstaller);
        }

        fs.writeFileSync(manifestPath, JSON.stringify(installers, null, 2));
    }
}
