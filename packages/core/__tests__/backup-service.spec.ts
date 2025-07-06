import { BackupService } from '../src/backup-service';
import * as fs from 'fs';
import * as sinon from 'sinon';

describe('BackupService', () => {
    it('BackupService_createsDirs', async () => {
        const backupService = new BackupService();
        await backupService.run();
        expect(fs.existsSync('tmp/spec.yaml')).toBe(true);
    }); it('BackupService_callsExport', async () => {
        // Red phase: test for delegating to PackageAdapter.exportList
        const mockAdapter = {
            exportList: sinon.spy(),
            search: sinon.stub().resolves([]),
            install: sinon.stub().resolves(true),
            ensurePresent: sinon.stub().resolves(true)
        };
        const backupService = new BackupService(mockAdapter);
        await backupService.run();
        expect(mockAdapter.exportList.calledOnce).toBe(true);
        expect(mockAdapter.exportList.calledWith('tmp/winget-packages.yaml')).toBe(true);
    }); it('BackupService_respectsSettings', async () => {
        // Red phase: test for respecting settings that disable managers
        const mockAdapter = {
            exportList: sinon.spy(),
            search: sinon.stub().resolves([]),
            install: sinon.stub().resolves(true),
            ensurePresent: sinon.stub().resolves(true)
        };
        const settings = { enableChoco: false };
        const backupService = new BackupService(mockAdapter, settings);
        await backupService.run();
        expect(mockAdapter.exportList.called).toBe(true); // Winget should still be called since only choco is disabled
    }); it('BackupService_multipleAdapters', async () => {
        // Test for handling multiple adapters
        const mockWingetAdapter = {
            exportList: sinon.stub().resolves(),
            search: sinon.stub().resolves([]),
            install: sinon.stub().resolves(true),
            ensurePresent: sinon.stub().resolves(true)
        };
        const mockChocoAdapter = {
            exportList: sinon.stub().resolves(),
            search: sinon.stub().resolves([]),
            install: sinon.stub().resolves(true),
            ensurePresent: sinon.stub().resolves(true)
        };

        const backupService = new BackupService();
        backupService.addAdapter('winget', mockWingetAdapter);
        backupService.addAdapter('choco', mockChocoAdapter);

        await backupService.run();

        expect(mockWingetAdapter.exportList.calledOnce).toBe(true);
        expect(mockChocoAdapter.exportList.calledOnce).toBe(true);
    }); it('BackupService_disabledAdapter', async () => {
        // Test that disabled adapters are not called
        const mockWingetAdapter = {
            exportList: sinon.stub().resolves(),
            search: sinon.stub().resolves([]),
            install: sinon.stub().resolves(true),
            ensurePresent: sinon.stub().resolves(true)
        };
        const mockChocoAdapter = {
            exportList: sinon.stub().resolves(),
            search: sinon.stub().resolves([]),
            install: sinon.stub().resolves(true),
            ensurePresent: sinon.stub().resolves(true)
        };

        const settings = { enableChoco: false };
        const backupService = new BackupService(undefined, settings);
        backupService.addAdapter('winget', mockWingetAdapter);
        backupService.addAdapter('choco', mockChocoAdapter);

        await backupService.run();

        expect(mockWingetAdapter.exportList.calledOnce).toBe(true);
        expect(mockChocoAdapter.exportList.called).toBe(false);
    });
});
