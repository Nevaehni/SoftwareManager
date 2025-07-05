export interface PackageAdapter {
    exportList(filename: string): Promise<void> | void;
}
