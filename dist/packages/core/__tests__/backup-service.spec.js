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
const backup_service_1 = require("../src/backup-service");
const fs = __importStar(require("fs"));
const sinon = __importStar(require("sinon"));
describe('BackupService', () => {
    it('BackupService_createsDirs', async () => {
        const backupService = new backup_service_1.BackupService();
        await backupService.run();
        expect(fs.existsSync('tmp/spec.yaml')).toBe(true);
    });
    it('BackupService_callsExport', async () => {
        // Red phase: test for delegating to PackageAdapter.exportList
        const mockAdapter = {
            exportList: sinon.spy(),
            search: sinon.stub().resolves([]),
            install: sinon.stub().resolves(true),
            uninstall: sinon.stub().resolves(true),
            ensurePresent: sinon.stub().resolves(true)
        };
        const backupService = new backup_service_1.BackupService(mockAdapter);
        await backupService.run();
        expect(mockAdapter.exportList.calledOnce).toBe(true);
        expect(mockAdapter.exportList.calledWith('tmp/winget-packages.yaml')).toBe(true);
    });
    it('BackupService_respectsSettings', async () => {
        // Red phase: test for respecting settings that disable managers
        const mockAdapter = {
            exportList: sinon.spy(),
            search: sinon.stub().resolves([]),
            install: sinon.stub().resolves(true),
            uninstall: sinon.stub().resolves(true),
            ensurePresent: sinon.stub().resolves(true)
        };
        const settings = { enableChoco: false };
        const backupService = new backup_service_1.BackupService(mockAdapter, settings);
        await backupService.run();
        expect(mockAdapter.exportList.called).toBe(true); // Winget should still be called since only choco is disabled
    });
    it('BackupService_multipleAdapters', async () => {
        // Test for handling multiple adapters
        const mockWingetAdapter = {
            exportList: sinon.stub().resolves(),
            search: sinon.stub().resolves([]),
            install: sinon.stub().resolves(true),
            uninstall: sinon.stub().resolves(true),
            ensurePresent: sinon.stub().resolves(true)
        };
        const mockChocoAdapter = {
            exportList: sinon.stub().resolves(),
            search: sinon.stub().resolves([]),
            install: sinon.stub().resolves(true),
            uninstall: sinon.stub().resolves(true),
            ensurePresent: sinon.stub().resolves(true)
        };
        const backupService = new backup_service_1.BackupService();
        backupService.addAdapter('winget', mockWingetAdapter);
        backupService.addAdapter('choco', mockChocoAdapter);
        await backupService.run();
        expect(mockWingetAdapter.exportList.calledOnce).toBe(true);
        expect(mockChocoAdapter.exportList.calledOnce).toBe(true);
    });
    it('BackupService_disabledAdapter', async () => {
        // Test that disabled adapters are not called
        const mockWingetAdapter = {
            exportList: sinon.stub().resolves(),
            search: sinon.stub().resolves([]),
            install: sinon.stub().resolves(true),
            uninstall: sinon.stub().resolves(true),
            ensurePresent: sinon.stub().resolves(true)
        };
        const mockChocoAdapter = {
            exportList: sinon.stub().resolves(),
            search: sinon.stub().resolves([]),
            install: sinon.stub().resolves(true),
            uninstall: sinon.stub().resolves(true),
            ensurePresent: sinon.stub().resolves(true)
        };
        const settings = { enableChoco: false };
        const backupService = new backup_service_1.BackupService(undefined, settings);
        backupService.addAdapter('winget', mockWingetAdapter);
        backupService.addAdapter('choco', mockChocoAdapter);
        await backupService.run();
        expect(mockWingetAdapter.exportList.calledOnce).toBe(true);
        expect(mockChocoAdapter.exportList.called).toBe(false);
    });
});
//# sourceMappingURL=backup-service.spec.js.map