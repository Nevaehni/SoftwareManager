declare global {
    interface Window {
        electronAPI: {
            backupPackages: (versionPins?: { [packageId: string]: string }) => Promise<{ success: boolean; error?: string }>;
            restorePackages: (bundlePath: string) => Promise<{ success: boolean; installed?: string[]; failed?: string[]; error?: string }>;
            previewRestore: (bundlePath: string) => Promise<{ success: boolean; preview?: any; error?: string }>;
            getSettings: () => Promise<any>;
            saveSettings: (settings: any) => Promise<{ success: boolean }>; selectFile: (options: any) => Promise<{ filePath?: string | null; error?: string }>;
            selectDirectory: () => Promise<{ directoryPath?: string | null; error?: string }>;
            selectCustomInstaller: () => Promise<{ filePath?: string | null; error?: string }>;
            downloadCustomInstaller: (url: string) => Promise<{ success: boolean; filePath?: string; error?: string }>;
            searchPackages: (query: string) => Promise<any>;
            installPackage: (packageId: string, source: string, version?: string) => Promise<{ success: boolean; error?: string }>;
            uninstallPackage: (packageId: string, source: string) => Promise<{ success: boolean }>;
            listInstalledPackages: () => Promise<{ success: boolean; packages?: Array<{ id: string, name: string, version: string, source: string }>; error?: string }>;
            loadSpecFile: () => Promise<any>;
            saveSpecFile: (content: string, language: string) => Promise<any>;
            validateSpec: (content: string, language: string) => Promise<any>;
            minimizeWindow: () => Promise<void>;
            maximizeWindow: () => Promise<void>;
            closeWindow: () => Promise<void>;
            onBackupProgress: (callback: (event: any, data: { progress: number; message: string }) => void) => void;
            onRestoreProgress: (callback: (event: any, data: { progress: number; message: string }) => void) => void;
            onPreviewProgress: (callback: (event: any, data: { progress: number; message: string }) => void) => void;
            removeAllListeners: (channel: string) => void;
        };
        consoleLogger?: any;
    }
}

export { };
