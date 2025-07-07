import { PackageAdapter, PackageInfo } from '../../core/src/package-adapter';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { promisify } from 'util';

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

// Default exec function that uses real child_process
const defaultExecFunction: ExecFunction = (command: string, args: string[]): Promise<ExecResult> => {
    return new Promise((resolve) => {
        const child = spawn(command, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true
        });

        let stdout = '';
        let stderr = '';

        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });

        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });

        child.on('close', (code) => {
            resolve({
                stdout,
                stderr,
                exitCode: code || 0
            });
        });

        child.on('error', (error) => {
            resolve({
                stdout,
                stderr: error.message,
                exitCode: 1
            });
        });
    });
};

export class WingetAdapter implements PackageAdapter {
    private execFunction: ExecFunction;

    constructor(execFunction?: ExecFunction) {
        this.execFunction = execFunction || defaultExecFunction;
    } async exportList(filename: string): Promise<void> {
        this.validateExecFunction();

        try {
            // Call winget list to get installed packages
            const result = await this.execFunction('winget', ['list', '--accept-source-agreements']);

            if (result.exitCode === 0) {
                // Parse the table output to get packages
                const packages = this.parseWingetSearchOutput(result.stdout);

                // Convert to YAML-like format
                let content = 'packages:\n';
                packages.forEach(pkg => {
                    content += `  - id: ${pkg.id}\n`;
                    content += `    name: ${pkg.name}\n`;
                    content += `    version: ${pkg.version}\n`;
                });

                fs.writeFileSync(filename, content);
                return;
            }
        } catch (error) {
            console.error('Failed to export package list:', error);
            throw new Error(`Failed to export package list: ${error}`);
        }

        throw new Error('Failed to export package list - winget command failed');
    } async search(query: string): Promise<PackageInfo[]> {
        this.validateExecFunction();        // Remove --source restriction to search all sources
        const result = await this.execFunction!('winget', ['search', query, '--accept-source-agreements']);

        if (result.exitCode !== 0) {
            throw new Error(`Winget search failed: ${result.stderr}`);
        }

        try {
            // Parse the table output instead of expecting JSON
            const packages = this.parseWingetSearchOutput(result.stdout);
            return packages;
        } catch (error) {
            console.error('Failed to parse winget search output:', error);
            throw new Error(`Failed to parse winget search output: ${error}`);
        }
    } private parseWingetSearchOutput(output: string): PackageInfo[] {
        const lines = output.split('\n');
        const packages: PackageInfo[] = [];

        // Find the header line (look for "Name" and "Id" keywords)
        let headerLineIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('Name') && line.includes('Id') && line.includes('Version')) {
                headerLineIndex = i;
                break;
            }
        }

        if (headerLineIndex === -1) {
            return packages; // No packages found
        }

        // Find the separator line (starts with dashes, usually right after header)
        let separatorLineIndex = -1;
        for (let i = headerLineIndex + 1; i < lines.length; i++) {
            if (lines[i].includes('----')) {
                separatorLineIndex = i;
                break;
            }
        }

        if (separatorLineIndex === -1) {
            return packages;
        }

        // Parse package lines after the separator
        for (let i = separatorLineIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line && line.trim() && !line.startsWith(' ')) {
                try {
                    // Parse using regex to handle variable spacing
                    // Format: Name    Id    Version    [Match]    [Source]
                    const parts = line.trim().split(/\s{2,}/); // Split on 2+ spaces

                    if (parts.length >= 3) {
                        const name = parts[0].trim();
                        const id = parts[1].trim();
                        const version = parts[2].trim();

                        if (name && id && version && name !== 'Name') {
                            packages.push({
                                id,
                                name,
                                version,
                                source: 'winget'
                            });
                        }
                    }
                } catch (error) {
                    // Skip malformed lines
                }
            }
        }

        return packages;
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

    async uninstall(packageId: string): Promise<boolean> {
        this.validateExecFunction();

        const result = await this.execFunction!('winget', ['uninstall', packageId, '--accept-source-agreements']);

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

    async listInstalled(): Promise<PackageInfo[]> {
        this.validateExecFunction();

        const result = await this.execFunction!('winget', ['list', '--accept-source-agreements']);

        if (result.exitCode !== 0) {
            throw new Error(`Winget list failed: ${result.stderr}`);
        }

        try {
            // Parse the table output instead of expecting JSON
            const packages = this.parseWingetSearchOutput(result.stdout);
            return packages;
        } catch (error) {
            console.error('Failed to parse winget list output:', error);
            throw new Error(`Failed to parse winget list output: ${error}`);
        }
    } private validateExecFunction(): void {
        // No validation needed since execFunction is always set in constructor
    }
}
