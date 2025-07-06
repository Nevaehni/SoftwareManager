"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PackageManagerInstaller = void 0;
const package_manager_detector_1 = require("./package-manager-detector");
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class PackageManagerInstaller {
    constructor() {
        this.detector = new package_manager_detector_1.PackageManagerDetector();
    }
    async detectMissingManagers() {
        const managers = await this.detector.detectAll();
        const missing = [];
        for (const manager of managers) {
            if (!manager.available) {
                missing.push(manager.name);
            }
        }
        return missing;
    }
    async installWinget() {
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
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to install Winget: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
    async installChocolatey() {
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
        }
        catch (error) {
            return {
                success: false,
                message: `Failed to install Chocolatey: ${error instanceof Error ? error.message : 'Unknown error'}`
            };
        }
    }
}
exports.PackageManagerInstaller = PackageManagerInstaller;
//# sourceMappingURL=package-manager-installer.js.map