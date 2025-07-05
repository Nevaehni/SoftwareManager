#!/usr/bin/env node

import { BackupService } from '../core/src/backup-service';
import { RestoreService } from '../core/src/restore-service';
import { WingetAdapter } from '../adapters/windows/winget-adapter';
import { ChocoAdapter } from '../adapters/windows/choco-adapter';
import { Settings } from '../core/src/settings';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';

const execAsync = promisify(exec);

interface CLIOptions {
    command: 'backup' | 'restore' | 'list' | 'version';
    bundlePath?: string;
    enableChoco?: boolean;
    enableWinget?: boolean;
    output?: string;
}

class SoftwareManagerCLI {
    private settings: Settings;

    constructor(options: Partial<Settings> = {}) {
        this.settings = {
            enableChoco: options.enableChoco ?? true,
            enableWinget: options.enableWinget ?? true,
            ...options
        };
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
    }

    showHelp(): void {
        console.log(`
Software Manager CLI - Backup and restore your software packages

Usage:
  software-manager <command> [options]

Commands:
  backup [output]      Create a backup of installed packages (default: software-backup.yaml)
  restore <bundle>     Restore packages from a backup bundle
  list                 List currently installed packages
  version              Show version information
  help                 Show this help message

Options:
  --no-choco          Disable Chocolatey package manager
  --no-winget         Disable Winget package manager

Examples:
  software-manager backup
  software-manager backup my-packages.yaml
  software-manager restore my-packages.yaml
  software-manager list
  software-manager --no-choco backup
        `);
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
