import { PackageAdapter } from './package-adapter';
import { Settings } from './settings';
interface ProgressCallback {
    (progress: number, message: string): void;
}
export declare class BackupService {
    private adapters;
    private settings?;
    private progressCallback?;
    private customInstallerService;
    private customInstallers;
    constructor(adapter?: PackageAdapter, settings?: Settings);
    setProgressCallback(callback: ProgressCallback): void;
    addAdapter(name: string, adapter: PackageAdapter): void;
    /**
     * Add a custom MSI/EXE installer to be included in the backup
     */
    addCustomInstaller(installerPath: string): void;
    /**
     * Get list of custom installers to be included in backup
     */
    getCustomInstallers(): string[];
    run(): Promise<void>;
    private isAdapterEnabled;
    private shouldExport;
    private sortAdaptersByPriority;
}
export {};
//# sourceMappingURL=backup-service.d.ts.map