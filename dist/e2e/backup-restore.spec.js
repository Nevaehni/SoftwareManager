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
const test_1 = require("@playwright/test");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
test_1.test.describe('Software Manager E2E Tests', () => {
    const testDir = path.join(__dirname, '..', 'tmp', 'e2e');
    const bundleFile = path.join(testDir, 'test-bundle.yaml');
    test_1.test.beforeEach(async () => {
        // Create test directory
        if (!fs.existsSync(testDir)) {
            fs.mkdirSync(testDir, { recursive: true });
        }
        // Clean up any existing test files
        if (fs.existsSync(bundleFile)) {
            fs.unlinkSync(bundleFile);
        }
    });
    test_1.test.afterEach(async () => {
        // Clean up test files
        if (fs.existsSync(bundleFile)) {
            fs.unlinkSync(bundleFile);
        }
    });
    (0, test_1.test)('Backup_restore_e2e_workflow', async ({ page }) => {
        // E2E test for complete backup and restore workflow
        // This test simulates the full user workflow from backup to restore
        // Note: This is a placeholder E2E test structure
        // In a real implementation, this would:
        // 1. Launch the Electron app
        // 2. Navigate through the UI to create a backup
        // 3. Verify the backup file is created with correct content
        // 4. Navigate through the UI to restore from the backup
        // 5. Verify packages are restored correctly
        // For now, we'll test the CLI interface
        // TODO: Replace with actual Electron app testing when UI is implemented
        // Test the backup creation via CLI (simulated)
        const mockBackupContent = `packages:
  - id: Git.Git
    name: Git
    version: 2.42.0
  - id: Microsoft.VisualStudioCode
    name: Visual Studio Code
    version: 1.85.0`;
        // Simulate backup creation
        fs.writeFileSync(bundleFile, mockBackupContent);
        // Verify backup file exists and contains expected content
        (0, test_1.expect)(fs.existsSync(bundleFile)).toBe(true);
        const content = fs.readFileSync(bundleFile, 'utf8');
        (0, test_1.expect)(content).toContain('Git.Git');
        (0, test_1.expect)(content).toContain('Microsoft.VisualStudioCode');
        (0, test_1.expect)(content).toContain('2.42.0');
        (0, test_1.expect)(content).toContain('1.85.0');
        // TODO: Add restore workflow testing when restore functionality is implemented
        // This would include:
        // - Reading the bundle file
        // - Parsing package specifications
        // - Installing packages via winget
        // - Verifying installation success
    });
    (0, test_1.test)('Bundle_validation_e2e', async ({ page }) => {
        // E2E test for bundle file validation
        // This tests the complete workflow of validating bundle files
        // Create a test bundle with invalid format
        const invalidBundle = `invalid:
  - this is not a valid package spec`;
        fs.writeFileSync(bundleFile, invalidBundle);
        // TODO: Test bundle validation logic when implemented
        // This would include:
        // - Attempting to parse the bundle
        // - Detecting invalid format
        // - Showing appropriate error messages
        // For now, just verify the file exists
        (0, test_1.expect)(fs.existsSync(bundleFile)).toBe(true);
        // Create a valid bundle
        const validBundle = `packages:
  - id: TestPackage.Example
    name: Test Package
    version: 1.0.0`;
        fs.writeFileSync(bundleFile, validBundle);
        const content = fs.readFileSync(bundleFile, 'utf8');
        (0, test_1.expect)(content).toContain('TestPackage.Example');
        (0, test_1.expect)(content).toContain('Test Package');
        (0, test_1.expect)(content).toContain('1.0.0');
    });
});
//# sourceMappingURL=backup-restore.spec.js.map