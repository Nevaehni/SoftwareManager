#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SoftwareManagerCLI = void 0;
const backup_service_1 = require("../core/src/backup-service");
const restore_service_1 = require("../core/src/restore-service");
const package_manager_installer_1 = require("../core/src/package-manager-installer");
const winget_adapter_1 = require("../adapters/windows/winget-adapter");
const choco_adapter_1 = require("../adapters/windows/choco-adapter");
const child_process_1 = require("child_process");
const util_1 = require("util");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class SoftwareManagerCLI {
    constructor(options = {}) {
        this.settings = {
            enableChoco: options.enableChoco ?? true,
            enableWinget: options.enableWinget ?? true,
            ...options
        };
    }
    async createExecFunction() {
        return async (command, args) => {
            const result = await execAsync(`${command} ${args.join(' ')}`);
            return {
                stdout: result.stdout,
                stderr: result.stderr,
                exitCode: 0
            };
        };
    }
    async backup(outputPath = 'software-backup.yaml') {
        console.log('🔄 Starting backup...');
        const execFunction = await this.createExecFunction();
        const backupService = new backup_service_1.BackupService(undefined, this.settings);
        // Set up progress callback
        backupService.setProgressCallback((progress, message) => {
            console.log(`[${progress}%] ${message}`);
        });
        // Add adapters based on settings
        if (this.settings.enableWinget) {
            console.log('📦 Adding Winget adapter...');
            const wingetAdapter = new winget_adapter_1.WingetAdapter(execFunction);
            backupService.addAdapter('winget', wingetAdapter);
        }
        if (this.settings.enableChoco) {
            console.log('🍫 Adding Chocolatey adapter...');
            const chocoAdapter = new choco_adapter_1.ChocoAdapter(execFunction);
            backupService.addAdapter('choco', chocoAdapter);
        }
        await backupService.run();
        // Move the generated file to the desired output path
        const tmpPath = 'tmp/spec.yaml';
        if (fs.existsSync(tmpPath)) {
            fs.copyFileSync(tmpPath, outputPath);
            console.log(`✅ Backup saved to: ${path.resolve(outputPath)}`);
        }
        else {
            const error = new Error('Backup file not created');
            console.error('❌ Backup file not created');
            throw error;
        }
    }
    async restore(bundlePath) {
        console.log(`🔄 Starting restore from: ${bundlePath}`);
        if (!fs.existsSync(bundlePath)) {
            const error = new Error(`Bundle file not found: ${bundlePath}`);
            console.error(`❌ Bundle file not found: ${bundlePath}`);
            throw error;
        }
        const execFunction = await this.createExecFunction();
        const adapter = new winget_adapter_1.WingetAdapter(execFunction); // Default to Winget for restore
        const restoreService = new restore_service_1.RestoreService(adapter);
        // Set up progress callback
        restoreService.setProgressCallback((progress, message) => {
            console.log(`[${progress}%] ${message}`);
        });
        const result = await restoreService.run(bundlePath);
        if (result.success) {
            console.log(`✅ Restore completed successfully!`);
            console.log(`   Installed: ${result.installed.length}`);
            console.log(`   Failed: ${result.failed.length}`);
        }
        else {
            const error = new Error('Restore failed');
            console.error(`❌ Restore failed`);
            if (result.failed.length > 0) {
                console.error('Failed packages:');
                result.failed.forEach(pkg => console.error(`   - ${pkg.id}`));
            }
            throw error;
        }
    }
    async listPackages() {
        console.log('📋 Listing installed packages...');
        const execFunction = await this.createExecFunction();
        if (this.settings.enableWinget) {
            console.log('\n🪟 Winget packages:');
            try {
                const wingetAdapter = new winget_adapter_1.WingetAdapter(execFunction);
                await wingetAdapter.exportList('tmp/winget-list.yaml');
                if (fs.existsSync('tmp/winget-list.yaml')) {
                    const content = fs.readFileSync('tmp/winget-list.yaml', 'utf8');
                    console.log(content);
                }
            }
            catch (error) {
                console.error('   Error listing Winget packages:', error);
            }
        }
        if (this.settings.enableChoco) {
            console.log('\n🍫 Chocolatey packages:');
            try {
                const chocoAdapter = new choco_adapter_1.ChocoAdapter(execFunction);
                await chocoAdapter.exportList('tmp/choco-list.yaml');
                if (fs.existsSync('tmp/choco-list.yaml')) {
                    const content = fs.readFileSync('tmp/choco-list.yaml', 'utf8');
                    console.log(content);
                }
            }
            catch (error) {
                console.error('   Error listing Chocolatey packages:', error);
            }
        }
    }
    showVersion() {
        console.log('Software Manager CLI v1.0.0');
        console.log('Built with Test-Driven Development');
    }
    showHelp() {
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
        `);
    }
    async bootstrap() {
        console.log('🔧 Checking package manager installation...');
        const installer = new package_manager_installer_1.PackageManagerInstaller();
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
                }
                else if (manager === 'Chocolatey') {
                    result = await installer.installChocolatey();
                }
                else {
                    console.log(`⚠️  Unknown package manager: ${manager}`);
                    continue;
                }
                if (result.success) {
                    console.log(`✅ ${result.message}`);
                }
                else {
                    console.error(`❌ ${result.message}`);
                }
            }
            console.log('\n🎉 Bootstrap process completed!');
        }
        catch (error) {
            console.error('❌ Bootstrap failed:', error);
            throw error;
        }
    }
}
exports.SoftwareManagerCLI = SoftwareManagerCLI;
// CLI entry point
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args.includes('help') || args.includes('--help')) {
        new SoftwareManagerCLI().showHelp();
        return;
    }
    const command = args[0];
    const options = {
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
                break;
            default:
                console.error(`❌ Unknown command: ${command}`);
                cli.showHelp();
                process.exit(1);
        }
    }
    catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}
// Only run if this file is executed directly
if (require.main === module) {
    main();
}
//# sourceMappingURL=software-manager.js.map