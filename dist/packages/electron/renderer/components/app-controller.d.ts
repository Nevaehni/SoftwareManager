declare global {
    interface Window {
        electronAPI: {
            backupPackages: () => Promise<{
                success: boolean;
            }>;
            restorePackages: (bundlePath: string) => Promise<{
                success: boolean;
            }>;
            getSettings: () => Promise<{
                enableChoco?: boolean;
                enableWinget?: boolean;
            }>;
            saveSettings: (settings: any) => Promise<{
                success: boolean;
            }>;
            selectFile: (options?: any) => Promise<{
                filePath?: string;
            }>;
            selectDirectory: () => Promise<{
                directoryPath?: string;
            }>;
            searchPackages: (query: string) => Promise<{
                success: boolean;
                packages?: any[];
                error?: string;
            }>;
            installPackage: (packageId: string, source: string, version?: string) => Promise<{
                success: boolean;
                message?: string;
                error?: string;
            }>;
            onBackupProgress: (callback: Function) => void;
            onRestoreProgress: (callback: Function) => void;
            removeAllListeners: (channel: string) => void;
        };
        consoleLogger?: any;
    }
}
export declare class AppController {
    private selectedBundlePath;
    private consoleLogger;
    initialize(): void;
    private initializeConsoleLogger;
    private setupConsoleLogger;
    private setupEventListeners;
    private handleBackup;
    private handleSelectBundle;
    private handleRestore;
    private loadSettings;
    private handleSaveSettings;
    private setupProgressListeners;
    private updateProgress;
}
//# sourceMappingURL=app-controller.d.ts.map