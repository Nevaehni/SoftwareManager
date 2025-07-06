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
const child_process_1 = require("child_process");
const util_1 = require("util");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
describe('End-to-End Integration Tests', () => {
    const cliPath = path.join(__dirname, '..', '..', '..', 'dist', 'packages', 'cli', 'software-manager.js');
    const testOutputFile = path.join(__dirname, '..', '..', '..', 'tmp', 'e2e-test-backup.yaml');
    beforeEach(() => {
        // Clean up any previous test files
        if (fs.existsSync(testOutputFile)) {
            fs.unlinkSync(testOutputFile);
        }
    });
    afterEach(() => {
        // Clean up test files
        if (fs.existsSync(testOutputFile)) {
            fs.unlinkSync(testOutputFile);
        }
    });
    describe('CLI End-to-End Functionality', () => {
        test('CLI help command works', async () => {
            console.log('Testing CLI help command...');
            console.log('CLI path:', cliPath);
            console.log('CLI exists:', fs.existsSync(cliPath));
            if (!fs.existsSync(cliPath)) {
                console.log('⚠️ CLI not found, skipping CLI test');
                return;
            }
            try {
                // Test that the CLI can show help
                const { stdout, stderr } = await execAsync(`node "${cliPath}" help`);
                expect(stdout).toContain('Software Manager CLI');
                expect(stdout).toContain('backup');
                expect(stdout).toContain('restore');
                expect(stderr).toBe('');
                console.log('✅ CLI help command test passed');
            }
            catch (error) {
                console.error('❌ CLI help test error:', error);
                throw error;
            }
        });
        test('CLI version command works', async () => {
            console.log('Testing CLI version command...');
            if (!fs.existsSync(cliPath)) {
                console.log('⚠️ CLI not found, skipping version test');
                return;
            }
            try {
                const { stdout } = await execAsync(`node "${cliPath}" version`);
                expect(stdout).toContain('Software Manager CLI');
                console.log('✅ CLI version command test passed');
            }
            catch (error) {
                console.error('❌ CLI version test error:', error);
                throw error;
            }
        });
    });
    describe('File System Operations', () => {
        test('Basic file operations work', () => {
            console.log('Testing basic file operations...');
            // Test that we can create and read files in tmp directory
            const tmpDir = path.join(__dirname, '..', '..', '..', 'tmp');
            if (!fs.existsSync(tmpDir)) {
                fs.mkdirSync(tmpDir, { recursive: true });
            }
            const testFile = path.join(tmpDir, 'e2e-test.txt');
            const testContent = 'E2E test content';
            // Write test content
            fs.writeFileSync(testFile, testContent);
            // Read and verify
            const readContent = fs.readFileSync(testFile, 'utf8');
            expect(readContent).toBe(testContent);
            // Clean up
            fs.unlinkSync(testFile);
            console.log('✅ Basic file operations test passed');
        });
    });
});
//# sourceMappingURL=e2e-workflow.integration.spec.js.map