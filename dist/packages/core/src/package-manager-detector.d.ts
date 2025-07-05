export interface PackageManagerInfo {
    name: string;
    available: boolean;
    version?: string;
    error?: string;
}
export declare class PackageManagerDetector {
    detectAll(): Promise<PackageManagerInfo[]>;
    detectWinget(): Promise<PackageManagerInfo>;
    detectChocolatey(): Promise<PackageManagerInfo>;
    isWingetAvailable(): Promise<boolean>;
    isChocolateyAvailable(): Promise<boolean>;
    getRecommendations(): Promise<string[]>;
}
//# sourceMappingURL=package-manager-detector.d.ts.map