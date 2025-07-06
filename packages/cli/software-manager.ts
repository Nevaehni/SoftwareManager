#!/usr/bin/env node

import { BackupService } from '../core/src/backup-service';
import { RestoreService } from '../core/src/restore-service';
import { PackageManagerInstaller } from '../core/src/package-manager-installer';
import { CustomInstallerService } from '../core/src/custom-installer-service';
import { WingetAdapter } from '../adapters/windows/winget-adapter';
import { ChocoAdapter } from '../adapters/windows/choco-adapter';
import { Settings } from '../core/src/settings';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface CLIOptions {
    command: 'backup' | 'restore' | 'list' | 'version' | 'bootstrap' | 'add-installer' | 'list-installers' | 'remove-installer';
    bundlePath?: string;
    enableChoco?: boolean;
    enableWinget?: boolean;
    output?: string;
    installerPath?: string;
    installerName?: string;
}

class SoftwareManagerCLI {
    private settings: Settings;
    private customInstallerService: CustomInstallerService;
    private installersConfigPath: string = 'tmp/cli-custom-installers.json';

    constructor(options: Partial<Settings> = {}) {
        this.settings = {
            enableChoco: options.enableChoco ?? true,
            enableWinget: options.enableWinget ?? true,
            ...options
        };
        this.customInstallerService = new CustomInstallerService();

        // Ensure tmp directory exists for storing CLI config
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }
    }

    /**
     * Load custom installers list from persistent storage
     */
    private loadCustomInstallers(): string[] {
        try {
            if (fs.existsSync(this.installersConfigPath)) {
                const content = fs.readFileSync(this.installersConfigPath, 'utf8');
                return JSON.parse(content) || [];
            }
        } catch (error) {
            console.warn('Failed to load custom installers config:', error);
        }
        return [];
    }

    /**
     * Save custom installers list to persistent storage
     */
    private saveCustomInstallers(installers: string[]): void {
        try {
            fs.writeFileSync(this.installersConfigPath, JSON.stringify(installers, null, 2));
        } catch (error) {
            console.warn('Failed to save custom installers config:', error);
        }
    }

    async createExecFunction() {
        return async (command: string, args: string[]) => {
            const result = await execAsync(`${command} ${args.join(' ')}`);
            return {
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: 0
            };
        };
    } async backup(outputPath: string = 'software-backup.yaml'): Promise<void> {
        console.log('🔄 Starting backup...');

        const execFunction = await this.createExecFunction();
        const backupService = new BackupService(undefined, this.settings);

        // Set up progress callback
        backupService.setProgressCallback((progress: number, message: string) => {
            console.log(`[${progress}%] ${message}`);
        });

        // Add adapters based on settings
        if (this.settings.enableWinget) {
            console.log('📦 Adding Winget adapter...');
            const wingetAdapter = new WingetAdapter(execFunction);
            backupService.addAdapter('winget', wingetAdapter);
        }

        if (this.settings.enableChoco) {
            console.log('🍫 Adding Chocolatey adapter...');
            const chocoAdapter = new ChocoAdapter(execFunction);
            backupService.addAdapter('choco', chocoAdapter);
        }

        // Add custom installers from CLI
        const customInstallers = this.loadCustomInstallers();
        if (customInstallers.length > 0) {
            console.log(`📱 Adding ${customInstallers.length} custom installer(s)...`);
            customInstallers.forEach(installerPath => {
                backupService.addCustomInstaller(installerPath);
            });
        }

        await backupService.run();

        // Move the generated file to the desired output path
        const tmpPath = 'tmp/spec.yaml';
        if (fs.existsSync(tmpPath)) {
            fs.copyFileSync(tmpPath, outputPath);
            console.log(`✅ Backup saved to: ${path.resolve(outputPath)}`);
        } else {
            const error = new Error('Backup file not created');
            console.error('❌ Backup file not created');
            throw error;
        }
    } async restore(bundlePath: string): Promise<void> {
        console.log(`🔄 Starting restore from: ${bundlePath}`);

        if (!fs.existsSync(bundlePath)) {
            const error = new Error(`Bundle file not found: ${bundlePath}`);
            console.error(`❌ Bundle file not found: ${bundlePath}`);
            throw error;
        }

        const execFunction = await this.createExecFunction();
        const adapter = new WingetAdapter(execFunction); // Default to Winget for restore
        const restoreService = new RestoreService(adapter);

        // Set up progress callback
        restoreService.setProgressCallback((progress: number, message: string) => {
            console.log(`[${progress}%] ${message}`);
        });

        const result = await restoreService.run(bundlePath);

        if (result.success) {
            console.log(`✅ Restore completed successfully!`);
            console.log(`   Installed: ${result.installed.length}`);
            console.log(`   Failed: ${result.failed.length}`);
        } else {
            const error = new Error('Restore failed');
            console.error(`❌ Restore failed`);
            if (result.failed.length > 0) {
                console.error('Failed packages:');
                result.failed.forEach(pkg => console.error(`   - ${pkg.id}`));
            }
            throw error;
        }
    }

    async listPackages(): Promise<void> {
        console.log('📋 Listing installed packages...');

        const execFunction = await this.createExecFunction();

        if (this.settings.enableWinget) {
            console.log('\n🪟 Winget packages:');
            try {
                const wingetAdapter = new WingetAdapter(execFunction);
                await wingetAdapter.exportList('tmp/winget-list.yaml');

                if (fs.existsSync('tmp/winget-list.yaml')) {
                    const content = fs.readFileSync('tmp/winget-list.yaml', 'utf8');
                    console.log(content);
                }
            } catch (error) {
                console.error('   Error listing Winget packages:', error);
            }
        }

        if (this.settings.enableChoco) {
            console.log('\n🍫 Chocolatey packages:');
            try {
                const chocoAdapter = new ChocoAdapter(execFunction);
                await chocoAdapter.exportList('tmp/choco-list.yaml');

                if (fs.existsSync('tmp/choco-list.yaml')) {
                    const content = fs.readFileSync('tmp/choco-list.yaml', 'utf8');
                    console.log(content);
                }
            } catch (error) {
                console.error('   Error listing Chocolatey packages:', error);
            }
        }
    }

    showVersion(): void {
        console.log('Software Manager CLI v1.0.0');
        console.log('Built with Test-Driven Development');
    } showHelp(): void {
        console.log(`
Software Manager CLI - Backup and restore your software packages

Usage:
  software-manager <command> [options]

Commands:
  backup [output]      Create a backup of installed packages (default: software-backup.yaml)
  restore <bundle>     Restore packages from a backup bundle
  list                 List currently installed packages
  bootstrap            Install missing package managers (Winget/Chocolatey)
  version              Show version information
  help                 Show this help message
  add-installer <path> <name>   Add a custom installer
  list-installers      List all custom installers
  remove-installer <name>   Remove a custom installer

Options:
  --no-choco          Disable Chocolatey package manager
  --no-winget         Disable Winget package manager

Examples:
  software-manager backup
  software-manager backup my-packages.yaml
  software-manager restore my-packages.yaml
  software-manager list
  software-manager bootstrap
  software-manager --no-choco backup
  software-manager add-installer ./my-installer.exe "My Installer"
  software-manager list-installers
  software-manager remove-installer "My Installer"
        `);
    }

    async bootstrap(): Promise<void> {
        console.log('🔧 Checking package manager installation...');

        const installer = new PackageManagerInstaller();

        try {
            // Check which package managers are missing
            const missing = await installer.detectMissingManagers();

            if (missing.length === 0) {
                console.log('✅ All package managers are already installed!');
                return;
            }

            console.log(`📦 Missing package managers: ${missing.join(', ')}`);

            // Install missing package managers
            for (const manager of missing) {
                console.log(`\n🔄 Installing ${manager}...`);

                let result;
                if (manager === 'Winget') {
                    result = await installer.installWinget();
                } else if (manager === 'Chocolatey') {
                    result = await installer.installChocolatey();
                } else {
                    console.log(`⚠️  Unknown package manager: ${manager}`);
                    continue;
                }

                if (result.success) {
                    console.log(`✅ ${result.message}`);
                } else {
                    console.error(`❌ ${result.message}`);
                }
            }

            console.log('\n🎉 Bootstrap process completed!');
        } catch (error) {
            console.error('❌ Bootstrap failed:', error);
            throw error;
        }
    } async addCustomInstaller(installerPath: string, installerName?: string): Promise<void> {
        console.log(`➕ Adding custom installer: ${installerPath}`);

        try {
            // Determine if it's a URL or file path
            const isUrl = installerPath.startsWith('http://') || installerPath.startsWith('https://');
            let result;

            if (isUrl) {
                // Download from URL
                result = await this.customInstallerService.downloadInstaller(
                    installerPath,
                    'tmp/custom-installers'
                );
            } else {
                // Add local file
                if (!fs.existsSync(installerPath)) {
                    throw new Error(`Installer file not found: ${installerPath}`);
                }

                result = await this.customInstallerService.addInstallerToBundle(
                    installerPath,
                    'tmp/custom-installers'
                );
            }

            if (result.success) {
                // Update CLI installer list
                const installers = this.loadCustomInstallers();
                if (!installers.includes(installerPath)) {
                    installers.push(installerPath);
                    this.saveCustomInstallers(installers);
                }
                console.log(`✅ Custom installer added successfully`);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            console.error(`❌ Failed to add installer: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    async listCustomInstallers(): Promise<void> {
        console.log('📦 Listing custom installers...');

        try {
            const installers = await this.customInstallerService.listBundleInstallers('tmp/custom-installers');

            if (installers.length === 0) {
                console.log('   No custom installers found');
                return;
            }

            console.log(`   Found ${installers.length} custom installer(s):`);
            installers.forEach((installer, index) => {
                const source = installer.downloadUrl ? `Downloaded from: ${installer.downloadUrl}` : `Local file: ${installer.originalPath}`;
                console.log(`   ${index + 1}. ${installer.name} (${installer.type.toUpperCase()})`);
                console.log(`      ${source}`);
                console.log(`      Size: ${Math.round(installer.size / 1024 / 1024 * 100) / 100} MB`);
                console.log('');
            });
        } catch (error) {
            console.error(`❌ Failed to list installers: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }

    async removeCustomInstaller(installerName: string): Promise<void> {
        console.log(`🗑️  Removing custom installer: ${installerName}`);

        try {
            const installers = await this.customInstallerService.listBundleInstallers('tmp/custom-installers');
            const installer = installers.find(i => i.name === installerName);

            if (!installer) {
                throw new Error(`Installer '${installerName}' not found`);
            }

            // Remove the installer file
            const installerPath = path.join('tmp/custom-installers', path.basename(installer.bundledPath));
            if (fs.existsSync(installerPath)) {
                fs.unlinkSync(installerPath);
            }

            // Update manifest by filtering out the removed installer
            const remainingInstallers = installers.filter(i => i.name !== installerName);
            const manifestPath = path.join('tmp/custom-installers', 'custom-installers.json');
            fs.writeFileSync(manifestPath, JSON.stringify(remainingInstallers, null, 2));

            // Update CLI installer list
            const cliInstallers = this.loadCustomInstallers();
            const updatedList = cliInstallers.filter(path => !path.includes(installerName));
            this.saveCustomInstallers(updatedList);

            console.log(`✅ Custom installer removed successfully`);
        } catch (error) {
            console.error(`❌ Failed to remove installer: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
}

// CLI entry point
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('help') || args.includes('--help')) {
        new SoftwareManagerCLI().showHelp();
        return;
    }

    const command = args[0];
    const options: Partial<Settings> = {
        enableChoco: !args.includes('--no-choco'),
        enableWinget: !args.includes('--no-winget')
    };

    const cli = new SoftwareManagerCLI(options);

    try {
        switch (command) {
            case 'backup':
                const outputPath = args[1] || 'software-backup.yaml';
                await cli.backup(outputPath);
                break;

            case 'restore':
                if (!args[1]) {
                    console.error('❌ Error: Bundle path is required for restore command');
                    process.exit(1);
                }
                await cli.restore(args[1]);
                break;

            case 'list':
                await cli.listPackages();
                break;

            case 'version':
                cli.showVersion();
                break;

            case 'bootstrap':
                await cli.bootstrap();
                break; case 'add-installer':
                if (!args[1]) {
                    console.error('❌ Error: Installer path or URL is required for add-installer command');
                    console.error('Usage: software-manager add-installer <path-or-url>');
                    process.exit(1);
                }
                await cli.addCustomInstaller(args[1]);
                break;

            case 'list-installers':
                await cli.listCustomInstallers();
                break;

            case 'remove-installer':
                if (!args[1]) {
                    console.error('❌ Error: Installer name is required for remove-installer command');
                    process.exit(1);
                }
                await cli.removeCustomInstaller(args[1]);
                break;

            default:
                console.error(`❌ Unknown command: ${command}`);
                cli.showHelp();
                process.exit(1);
        }
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

// Only run if this file is executed directly
if (require.main === module) {
    main();
}

export { SoftwareManagerCLI };
