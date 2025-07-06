export interface PackageInfo {
    id: string;
    name: string;
    version: string;
    source: string;
}

export interface PackageAdapter {
    exportList(filename: string): Promise<void> | void;
    search(query: string): Promise<PackageInfo[]>;
    install(packageId: string, version?: string): Promise<boolean>;
    ensurePresent(packageId: string): Promise<boolean>;
}
