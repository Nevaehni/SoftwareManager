import { PackageAdapter, PackageInfo } from '../../core/src/package-adapter';
interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
type ExecFunction = (command: string, args: string[]) => Promise<ExecResult>;
export declare class WingetAdapter implements PackageAdapter {
    private execFunction?;
    constructor(execFunction?: ExecFunction);
    exportList(filename: string): Promise<void>;
    search(query: string): Promise<PackageInfo[]>;
    private parseWingetSearchOutput;
    install(packageId: string, version?: string): Promise<boolean>;
    uninstall(packageId: string): Promise<boolean>;
    ensurePresent(packageId: string): Promise<boolean>;
    listInstalled(): Promise<PackageInfo[]>;
    private validateExecFunction;
}
export {};
//# sourceMappingURL=winget-adapter.d.ts.map