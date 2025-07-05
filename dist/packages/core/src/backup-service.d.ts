import { PackageAdapter } from './package-adapter';
import { Settings } from './settings';
export declare class BackupService {
    private adapter?;
    private settings?;
    constructor(adapter?: PackageAdapter, settings?: Settings);
    run(): Promise<void>;
    private shouldExport;
}
//# sourceMappingURL=backup-service.d.ts.map