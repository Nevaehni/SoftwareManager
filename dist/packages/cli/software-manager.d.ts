#!/usr/bin/env node
import { Settings } from '../core/src/settings';
declare class SoftwareManagerCLI {
    private settings;
    private customInstallerService;
    private installersConfigPath;
    constructor(options?: Partial<Settings>);
    /**
     * Load custom installers list from persistent storage
     */
    private loadCustomInstallers;
    /**
     * Save custom installers list to persistent storage
     */
    private saveCustomInstallers;
    createExecFunction(): Promise<(command: string, args: string[]) => Promise<{
        stdout: string;
        stderr: any;
        exitCode: any;
    }>>;
    backup(outputPath?: string): Promise<void>;
    restore(bundlePath: string, preview?: boolean): Promise<void>;
    previewRestore(bundlePath: string): Promise<void>;
    listPackages(): Promise<void>;
    showVersion(): void;
    showHelp(): void;
    bootstrap(): Promise<void>;
    addCustomInstaller(installerPath: string, installerName?: string): Promise<void>;
    listCustomInstallers(): Promise<void>;
    removeCustomInstaller(installerName: string): Promise<void>;
}
export { SoftwareManagerCLI };
//# sourceMappingURL=software-manager.d.ts.map