import { PackageAdapter } from '../../core/src/package-adapter';
interface ChocoPackage {
    id: string;
    name: string;
    version: string;
}
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
    listInstalled(): Promise<ChocoPackage[]>;
    search(query: string): Promise<ChocoPackage[]>;
    install(packageId: string, version?: string): Promise<boolean>;
    ensurePresent(packageId: string): Promise<boolean>;
    private parseChocoList;
    private validateExecFunction;
}
export {};
//# sourceMappingURL=choco-adapter.d.ts.map