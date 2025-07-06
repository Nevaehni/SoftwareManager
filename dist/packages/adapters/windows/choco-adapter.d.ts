import { PackageAdapter, PackageInfo } from '../../core/src/package-adapter';
interface ExecResult {
    stdout: string;
    stderr: string;
    exitCode: number;
}
type ExecFunction = (command: string, args: string[]) => Promise<ExecResult>;
export declare class ChocoAdapter implements PackageAdapter {
    private execFunction?;
    constructor(execFunction?: ExecFunction);
    exportList(filename: string): Promise<void>;
    listInstalled(): Promise<PackageInfo[]>;
    search(query: string): Promise<PackageInfo[]>;
    install(packageId: string, version?: string): Promise<boolean>;
    uninstall(packageId: string): Promise<boolean>;
    ensurePresent(packageId: string): Promise<boolean>;
    private parseChocoList;
    private validateExecFunction;
}
export {};
//# sourceMappingURL=choco-adapter.d.ts.map