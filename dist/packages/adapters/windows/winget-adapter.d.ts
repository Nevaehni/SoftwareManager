import { PackageAdapter } from '../../core/src/package-adapter';
interface WingetPackage {
    Id: string;
    Name: string;
    Version: string;
}
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
    search(query: string): Promise<WingetPackage[]>;
    install(packageId: string, version?: string): Promise<boolean>;
    ensurePresent(packageId: string): Promise<boolean>;
    private validateExecFunction;
}
export {};
//# sourceMappingURL=winget-adapter.d.ts.map