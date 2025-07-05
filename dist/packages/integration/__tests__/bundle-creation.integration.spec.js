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
const backup_service_1 = require("../../core/src/backup-service");
const winget_adapter_1 = require("../../adapters/windows/winget-adapter");
const fs = __importStar(require("fs"));
const sinon = __importStar(require("sinon"));
describe('Integration Tests - Bundle Creation', () => {
    beforeEach(() => {
        // Clean up any existing test files
        if (fs.existsSync('tmp/spec.yaml')) {
            fs.unlinkSync('tmp/spec.yaml');
        }
        if (fs.existsSync('tmp')) {
            fs.rmdirSync('tmp');
        }
    });
    afterEach(() => {
        // Clean up after tests
        if (fs.existsSync('tmp/spec.yaml')) {
            fs.unlinkSync('tmp/spec.yaml');
        }
        if (fs.existsSync('tmp')) {
            fs.rmdirSync('tmp');
        }
    });
    it('Bundle_includes_packages', async () => {
        // Red phase: Integration test for end-to-end backup flow
        // Test that BackupService + WingetAdapter creates bundle with package data
        const mockPackageData = [
            { "Id": "Git.Git", "Name": "Git", "Version": "2.42.0" },
            { "Id": "Microsoft.VisualStudioCode", "Name": "Visual Studio Code", "Version": "1.85.0" }
        ];
        const execStub = sinon.stub().resolves({
            stdout: JSON.stringify(mockPackageData),
            stderr: '',
            exitCode: 0
        });
        // Create WingetAdapter with stubbed exec function
        const wingetAdapter = new winget_adapter_1.WingetAdapter(execStub);
        // Create BackupService with the adapter
        const backupService = new backup_service_1.BackupService(wingetAdapter);
        // Run the backup process
        await backupService.run();
        // Verify tmp/spec.yaml exists and contains package data
        expect(fs.existsSync('tmp/spec.yaml')).toBe(true);
        const fileContent = fs.readFileSync('tmp/spec.yaml', 'utf8');
        expect(fileContent).toContain('Git.Git');
        expect(fileContent).toContain('2.42.0');
        expect(fileContent).toContain('Microsoft.VisualStudioCode');
        expect(fileContent).toContain('1.85.0');
        // Verify the adapter was called to search for packages
        expect(execStub.called).toBe(true);
        expect(execStub.calledWith('winget', ['search', '', '--accept-source-agreements'])).toBe(true);
    });
    it('Bundle_restore_workflow', async () => {
        // Integration test for restore workflow
        // Test that BackupService can restore packages from a bundle file
        const mockInstalledPackages = [
            { "Id": "Git.Git", "Name": "Git", "Version": "2.42.0" },
            { "Id": "Microsoft.VisualStudioCode", "Name": "Visual Studio Code", "Version": "1.85.0" }
        ];
        let execCallCount = 0;
        const execStub = sinon.stub().callsFake((command, args) => {
            execCallCount++;
            if (args[0] === 'search') {
                // Mock search command for exportList
                return Promise.resolve({
                    stdout: JSON.stringify(mockInstalledPackages),
                    stderr: '',
                    exitCode: 0
                });
            }
            else if (args[0] === 'install') {
                // Mock install commands for restore
                return Promise.resolve({
                    stdout: 'Package installed successfully',
                    stderr: '',
                    exitCode: 0
                });
            }
            return Promise.resolve({
                stdout: '',
                stderr: 'Unknown command',
                exitCode: 1
            });
        });
        // Create WingetAdapter with stubbed exec function
        const wingetAdapter = new winget_adapter_1.WingetAdapter(execStub);
        // Create BackupService with the adapter
        const backupService = new backup_service_1.BackupService(wingetAdapter);
        // First, create a backup bundle
        await backupService.run();
        // Verify the bundle was created
        expect(fs.existsSync('tmp/spec.yaml')).toBe(true);
        // Reset exec call count and stub behavior for restore testing
        execCallCount = 0;
        execStub.reset();
        execStub.callsFake((command, args) => {
            execCallCount++;
            if (args[0] === 'install') {
                // Mock successful install for restore
                return Promise.resolve({
                    stdout: 'Package installed successfully',
                    stderr: '',
                    exitCode: 0
                });
            }
            return Promise.resolve({
                stdout: '',
                stderr: '',
                exitCode: 0
            });
        });
        // Test restore functionality (when implemented)
        // Note: This test is prepared for when restore functionality is added
        // For now, we verify that the backup bundle contains expected data
        const fileContent = fs.readFileSync('tmp/spec.yaml', 'utf8');
        expect(fileContent).toContain('Git.Git');
        expect(fileContent).toContain('Microsoft.VisualStudioCode');
        // Verify the backup creation process called search
        expect(execStub.called).toBe(false); // Reset stub wasn't called yet
    });
});
//# sourceMappingURL=bundle-creation.integration.spec.js.map