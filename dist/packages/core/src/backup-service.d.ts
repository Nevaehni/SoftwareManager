import { PackageAdapter } from './package-adapter';
import { Settings } from './settings';
interface ProgressCallback {
    (progress: number, message: string): void;
}
export declare class BackupService {
    private adapters;
    private settings?;
    private progressCallback?;
    constructor(adapter?: PackageAdapter, settings?: Settings);
    setProgressCallback(callback: ProgressCallback): void;
    addAdapter(name: string, adapter: PackageAdapter): void;
    run(): Promise<void>;
    private isAdapterEnabled;
    private shouldExport;
}
export {};
//# sourceMappingURL=backup-service.d.ts.map