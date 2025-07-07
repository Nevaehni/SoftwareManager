import { PackageAdapter } from './package-adapter';
interface ProgressCallback {
    (progress: number, message: string): void;
}
interface Package {
    id: string;
    name: string;
    version: string;
}
interface InstallResult {
    id: string;
    success: boolean;
}
interface RestoreResult {
    success: boolean;
    installed: InstallResult[];
    failed: InstallResult[];
}
interface PreviewPackage {
    id: string;
    name: string;
    bundleVersion: string;
    installedVersion?: string;
    action: 'install' | 'upgrade' | 'downgrade' | 'reinstall' | 'skip';
    reason?: string;
}
interface RestorePreview {
    totalPackages: number;
    newInstalls: PreviewPackage[];
    upgrades: PreviewPackage[];
    downgrades: PreviewPackage[];
    reinstalls: PreviewPackage[];
    skipped: PreviewPackage[];
    summary: {
        willInstall: number;
        willUpgrade: number;
        willDowngrade: number;
        willReinstall: number;
        willSkip: number;
    };
}
export declare class RestoreService {
    private adapter;
    private progressCallback?;
    constructor(adapter: PackageAdapter);
    setProgressCallback(callback: ProgressCallback): void;
    readBundle(filename: string): Promise<Package[]>;
    /**
     * Compare version strings to determine version relationship
     * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
     */
    private compareVersions;
    /**
     * Preview what would happen during a restore operation
     */
    previewRestore(bundleFilename: string): Promise<RestorePreview>;
    installPackages(packages: Package[]): Promise<InstallResult[]>;
    run(bundleFilename: string): Promise<RestoreResult>;
}
export {};
//# sourceMappingURL=restore-service.d.ts.map