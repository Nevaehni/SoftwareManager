import { PackageAdapter } from '../../core/src/package-adapter';
import * as fs from 'fs';

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

export class WingetAdapter implements PackageAdapter {
    private execFunction?: ExecFunction;

    constructor(execFunction?: ExecFunction) {
        this.execFunction = execFunction;
    }

    exportList(filename: string): void {
        // Minimal implementation to satisfy the contract test
        // Just create an empty file for now
        fs.writeFileSync(filename, '');
    }

    async search(query: string): Promise<WingetPackage[]> {
        this.validateExecFunction();

        const result = await this.execFunction!('winget', ['search', query, '--accept-source-agreements']);

        if (result.exitCode !== 0) {
            throw new Error(`Winget search failed: ${result.stderr}`);
        }

        try {
            return JSON.parse(result.stdout);
        } catch (error) {
            throw new Error(`Failed to parse winget search output: ${error}`);
        }
    } async install(packageId: string, version?: string): Promise<boolean> {
        this.validateExecFunction();

        const args = ['install', packageId];
        if (version) {
            args.push('--version', version);
        }
        args.push('--accept-source-agreements');

        const result = await this.execFunction!('winget', args);

        return result.exitCode === 0;
    }

    async ensurePresent(packageId: string): Promise<boolean> {
        this.validateExecFunction();

        try {
            const result = await this.execFunction!('winget', ['list', packageId, '--accept-source-agreements']);
            return result.exitCode === 0;
        } catch (error) {
            return false;
        }
    }

    private validateExecFunction(): void {
        if (!this.execFunction) {
            throw new Error('Exec function not provided');
        }
    }
}
