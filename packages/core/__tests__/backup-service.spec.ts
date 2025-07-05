import { BackupService } from '../src/backup-service';
import * as fs from 'fs';
import * as sinon from 'sinon';

describe('BackupService', () => {
    it('BackupService_createsDirs', () => {
        const backupService = new BackupService();
        backupService.run();
        expect(fs.existsSync('tmp/spec.yaml')).toBe(true);
    });

    it('BackupService_callsExport', () => {
        // Red phase: test for delegating to PackageAdapter.exportList
        const mockAdapter = {
            exportList: sinon.spy()
        };
        const backupService = new BackupService(mockAdapter);
        backupService.run();
        expect(mockAdapter.exportList.calledOnce).toBe(true);
        expect(mockAdapter.exportList.calledWith('tmp/spec.yaml')).toBe(true);
    });

    it('BackupService_respectsSettings', () => {
        // Red phase: test for respecting settings that disable managers
        const mockAdapter = {
            exportList: sinon.spy()
        };
        const settings = { enableChoco: false };
        const backupService = new BackupService(mockAdapter, settings);
        backupService.run();
        expect(mockAdapter.exportList.called).toBe(false);
    });
});
