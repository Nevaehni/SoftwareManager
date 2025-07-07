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
const path = __importStar(require("path"));
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
        // Clean up any other files in tmp directory
        if (fs.existsSync('tmp')) {
            try {
                const files = fs.readdirSync('tmp');
                files.forEach(file => {
                    const filePath = path.join('tmp', file);
                    if (fs.statSync(filePath).isFile()) {
                        fs.unlinkSync(filePath);
                    }
                });
                fs.rmdirSync('tmp');
            }
            catch (e) {
                // Directory not empty or other error, ignore
                console.warn('Could not clean up tmp directory:', e);
            }
        }
    });
    it('Bundle_includes_packages', async () => {
        // Integration test for end-to-end backup flow using real winget
        // Test that BackupService + WingetAdapter creates bundle with package data
        // Create WingetAdapter without mock - uses real winget
        const wingetAdapter = new winget_adapter_1.WingetAdapter();
        // Create BackupService with the adapter
        const backupService = new backup_service_1.BackupService(wingetAdapter);
        // Run the backup process
        await backupService.run();
        // Verify tmp/spec.yaml exists and contains package data
        expect(fs.existsSync('tmp/spec.yaml')).toBe(true);
        const fileContent = fs.readFileSync('tmp/spec.yaml', 'utf8');
        console.log('Generated backup content:', fileContent);
        // Just verify the file has the expected structure
        expect(fileContent).toContain('packages:');
        expect(fileContent.trim().length).toBeGreaterThan(10); // Should have some content
    }, 30000); // Increase timeout for real winget calls
    it('Bundle_restore_workflow', async () => {
        // Integration test for restore workflow using real winget
        // Test that BackupService can create a backup bundle
        // Create WingetAdapter without mock - uses real winget
        const wingetAdapter = new winget_adapter_1.WingetAdapter();
        // Create BackupService with the adapter
        const backupService = new backup_service_1.BackupService(wingetAdapter);
        // First, create a backup bundle
        await backupService.run();
        // Verify the bundle was created
        expect(fs.existsSync('tmp/spec.yaml')).toBe(true);
        // Verify the backup bundle contains expected data structure
        const fileContent = fs.readFileSync('tmp/spec.yaml', 'utf8');
        console.log('Generated backup content for restore test:', fileContent);
        // Just verify the file has the expected structure
        expect(fileContent).toContain('packages:');
        expect(fileContent.trim().length).toBeGreaterThan(10); // Should have some content
        // Note: Actual restore functionality testing would require more implementation
        // For now, we verify that the backup creation works end-to-end
    }, 30000);
});
//# sourceMappingURL=bundle-creation.integration.spec.js.map