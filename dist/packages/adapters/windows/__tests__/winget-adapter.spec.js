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
const winget_adapter_1 = require("../winget-adapter");
const sinon = __importStar(require("sinon"));
describe('WingetAdapter Unit Tests', () => {
    it('Winget_search_parses', async () => {
        // Red phase: Test that search() parses JSON output from winget search
        const mockJson = JSON.stringify([
            { "Id": "Git.Git", "Name": "Git", "Version": "2.42.0" },
            { "Id": "Microsoft.VisualStudioCode", "Name": "Visual Studio Code", "Version": "1.85.0" }
        ]);
        const execStub = sinon.stub().resolves({
            stdout: mockJson,
            stderr: '',
            exitCode: 0
        });
        const adapter = new winget_adapter_1.WingetAdapter(execStub);
        const results = await adapter.search('git');
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeGreaterThan(0);
        expect(results[0]).toHaveProperty('Id');
        expect(results[0]).toHaveProperty('Name');
        expect(results[0]).toHaveProperty('Version');
        expect(execStub.calledOnce).toBe(true);
        expect(execStub.calledWith('winget', ['search', 'git', '--accept-source-agreements'])).toBe(true);
    });
    it('Winget_install_version', async () => {
        // Red phase: Test that install(version) pins version in command
        const execStub = sinon.stub().resolves({
            stdout: '',
            stderr: '',
            exitCode: 0
        });
        const adapter = new winget_adapter_1.WingetAdapter(execStub);
        await adapter.install('Git.Git', '2.35.0');
        expect(execStub.calledOnce).toBe(true);
        expect(execStub.calledWith('winget', ['install', 'Git.Git', '--version', '2.35.0', '--accept-source-agreements'])).toBe(true);
    });
    it('Winget_ensure_absent', async () => {
        // Red phase: Test that ensurePresent() returns false when exit code ≠ 0
        const execStub = sinon.stub().resolves({
            stdout: '',
            stderr: 'Package not found',
            exitCode: 1
        });
        const adapter = new winget_adapter_1.WingetAdapter(execStub);
        const result = await adapter.ensurePresent('Git.Git');
        expect(result).toBe(false);
        expect(execStub.calledOnce).toBe(true);
    });
});
//# sourceMappingURL=winget-adapter.spec.js.map