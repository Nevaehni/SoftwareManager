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
export declare class RestoreService {
    private adapter;
    private progressCallback?;
    constructor(adapter: PackageAdapter);
    setProgressCallback(callback: ProgressCallback): void;
    readBundle(filename: string): Promise<Package[]>;
    installPackages(packages: Package[]): Promise<InstallResult[]>;
    run(bundleFilename: string): Promise<RestoreResult>;
}
export {};
//# sourceMappingURL=restore-service.d.ts.map