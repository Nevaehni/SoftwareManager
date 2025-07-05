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
const restore_service_1 = require("../src/restore-service");
const winget_adapter_1 = require("../../adapters/windows/winget-adapter");
const fs = __importStar(require("fs"));
const sinon = __importStar(require("sinon"));
describe('RestoreService Unit Tests', () => {
    beforeEach(() => {
        // Clean up any existing test files
        if (fs.existsSync('tmp/test-bundle.yaml')) {
            fs.unlinkSync('tmp/test-bundle.yaml');
        }
        if (fs.existsSync('tmp')) {
            fs.rmSync('tmp', { recursive: true, force: true });
        }
    });
    afterEach(() => {
        // Clean up after tests
        if (fs.existsSync('tmp/test-bundle.yaml')) {
            fs.unlinkSync('tmp/test-bundle.yaml');
        }
        if (fs.existsSync('tmp')) {
            fs.rmSync('tmp', { recursive: true, force: true });
        }
    });
    it('RestoreService_readsBundle', async () => {
        // Red phase: Test that RestoreService can read and parse bundle files
        const bundleContent = 'packages:\n  - id: Git.Git\n    name: Git\n    version: 2.42.0\n  - id: Microsoft.VisualStudioCode\n    name: Visual Studio Code\n    version: 1.85.0';
        // Create test bundle file
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }
        fs.writeFileSync('tmp/test-bundle.yaml', bundleContent);
        const execStub = sinon.stub().resolves({
            stdout: '',
            stderr: '',
            exitCode: 0
        });
        const wingetAdapter = new winget_adapter_1.WingetAdapter(execStub);
        const restoreService = new restore_service_1.RestoreService(wingetAdapter);
        const packages = await restoreService.readBundle('tmp/test-bundle.yaml');
        expect(Array.isArray(packages)).toBe(true);
        expect(packages.length).toBe(2);
        expect(packages[0]).toEqual({
            id: 'Git.Git',
            name: 'Git',
            version: '2.42.0'
        });
        expect(packages[1]).toEqual({
            id: 'Microsoft.VisualStudioCode',
            name: 'Visual Studio Code',
            version: '1.85.0'
        });
    });
    it('RestoreService_installsPackages', async () => {
        // Red phase: Test that RestoreService installs packages via adapters
        const packages = [
            { id: 'Git.Git', name: 'Git', version: '2.42.0' },
            { id: 'Microsoft.VisualStudioCode', name: 'Visual Studio Code', version: '1.85.0' }
        ];
        const execStub = sinon.stub().resolves({
            stdout: 'Successfully installed',
            stderr: '',
            exitCode: 0
        });
        const wingetAdapter = new winget_adapter_1.WingetAdapter(execStub);
        const restoreService = new restore_service_1.RestoreService(wingetAdapter);
        const results = await restoreService.installPackages(packages);
        expect(results).toEqual([
            { id: 'Git.Git', success: true },
            { id: 'Microsoft.VisualStudioCode', success: true }
        ]);
        // Verify adapter was called for each package
        expect(execStub.callCount).toBe(2);
        expect(execStub.getCall(0).calledWith('winget', ['install', 'Git.Git', '--version', '2.42.0', '--accept-source-agreements'])).toBe(true);
        expect(execStub.getCall(1).calledWith('winget', ['install', 'Microsoft.VisualStudioCode', '--version', '1.85.0', '--accept-source-agreements'])).toBe(true);
    });
    it('RestoreService_run_endToEnd', async () => {
        // Red phase: Test complete restore workflow from bundle file to installed packages
        const bundleContent = 'packages:\n  - id: Git.Git\n    name: Git\n    version: 2.42.0';
        // Create test bundle file
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }
        fs.writeFileSync('tmp/test-bundle.yaml', bundleContent);
        const execStub = sinon.stub().resolves({
            stdout: 'Successfully installed',
            stderr: '',
            exitCode: 0
        });
        const wingetAdapter = new winget_adapter_1.WingetAdapter(execStub);
        const restoreService = new restore_service_1.RestoreService(wingetAdapter);
        const result = await restoreService.run('tmp/test-bundle.yaml');
        expect(result.success).toBe(true);
        expect(result.installed.length).toBe(1);
        expect(result.installed[0]).toEqual({
            id: 'Git.Git',
            success: true
        });
        expect(result.failed.length).toBe(0);
        // Verify the install was called
        expect(execStub.calledOnce).toBe(true);
        expect(execStub.calledWith('winget', ['install', 'Git.Git', '--version', '2.42.0', '--accept-source-agreements'])).toBe(true);
    });
});
//# sourceMappingURL=restore-service.spec.js.map