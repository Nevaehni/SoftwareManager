export interface InstallResult {
    success: boolean;
    message: string;
}
export declare class PackageManagerInstaller {
    private detector;
    constructor();
    detectMissingManagers(): Promise<string[]>;
    installWinget(): Promise<InstallResult>;
    installChocolatey(): Promise<InstallResult>;
}
//# sourceMappingURL=package-manager-installer.d.ts.map