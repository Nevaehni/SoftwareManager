#!/usr/bin/env node
import { Settings } from '../core/src/settings';
declare class SoftwareManagerCLI {
    private settings;
    constructor(options?: Partial<Settings>);
    createExecFunction(): Promise<(command: string, args: string[]) => Promise<{
        stdout: string;
        stderr: string;
        exitCode: number;
    }>>;
    backup(outputPath?: string): Promise<void>;
    restore(bundlePath: string): Promise<void>;
    listPackages(): Promise<void>;
    showVersion(): void;
    showHelp(): void;
    bootstrap(): Promise<void>;
}
export { SoftwareManagerCLI };
//# sourceMappingURL=software-manager.d.ts.map