import { PackageAdapter } from './package-adapter';
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
    constructor(adapter: PackageAdapter);
    readBundle(filename: string): Promise<Package[]>;
    installPackages(packages: Package[]): Promise<InstallResult[]>;
    run(bundleFilename: string): Promise<RestoreResult>;
}
export {};
//# sourceMappingURL=restore-service.d.ts.map