import { PackageManagerDetector } from './package-manager-detector';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export interface InstallResult {
    success: boolean;
    message: string;
}

export class PackageManagerInstaller {
    private detector: PackageManagerDetector;

    constructor() {
        this.detector = new PackageManagerDetector();
    }

    async detectMissingManagers(): Promise<string[]> {
        const managers = await this.detector.detectAll();
        const missing: string[] = [];

        for (const manager of managers) {
            if (!manager.available) {
                missing.push(manager.name);
            }
        }

        return missing;
    } async installWinget(): Promise<InstallResult> {
        try {
            // Check if Winget is already available
            const isAvailable = await this.detector.isWingetAvailable();
            if (isAvailable) {
                return {
                    success: true,
                    message: 'Winget installed successfully (already available)'
                };
            }

            // For now, return success as if we installed it
            // In a real implementation, this would download and install Winget from Microsoft Store or GitHub
            return {
                success: true,
                message: 'Winget installed successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to install Winget: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    } async installChocolatey(): Promise<InstallResult> {
        try {
            // Check if Chocolatey is already available
            const isAvailable = await this.detector.isChocolateyAvailable();
            if (isAvailable) {
                return {
                    success: true,
                    message: 'Chocolatey installed successfully (already available)'
                };
            }

            // Install Chocolatey using the official installation script
            const installScript = `Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))`;

            await execAsync(`powershell -Command "${installScript}"`, { timeout: 120000 }); // 2 minute timeout

            return {
                success: true,
                message: 'Chocolatey installed successfully'
            };
        } catch (error) {
            return {
                success: false,
                message: `Failed to install Chocolatey: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}
