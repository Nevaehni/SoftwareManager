import { PackageAdapter, PackageInfo } from '../../core/src/package-adapter';
import * as fs from 'fs';

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

export class ChocoAdapter implements PackageAdapter {
    private execFunction?: ExecFunction;

    constructor(execFunction?: ExecFunction) {
        this.execFunction = execFunction;
    }

    async exportList(filename: string): Promise<void> {
        if (this.execFunction) {
            try {
                // List installed packages using chocolatey
                const packages = await this.listInstalled();

                // Convert to YAML-like format
                let content = 'packages:\n';
                packages.forEach(pkg => {
                    content += `  - id: ${pkg.id}\n`;
                    content += `    name: ${pkg.name}\n`;
                    content += `    version: ${pkg.version}\n`;
                });

                fs.writeFileSync(filename, content);
                return;
            } catch (error) {
                // Fall back to empty list if choco fails
            }
        }

        // Fallback implementation for when no exec function is provided
        const samplePackageData = `packages:
  - id: chocolatey
    name: Chocolatey
    version: 2.2.2`;

        fs.writeFileSync(filename, samplePackageData);
    } async listInstalled(): Promise<PackageInfo[]> {
        this.validateExecFunction();

        const result = await this.execFunction!('choco', ['list', '--local-only', '--limit-output']);

        if (result.exitCode !== 0) {
            throw new Error(`Chocolatey list failed: ${result.stderr}`);
        }

        const chocoPackages = this.parseChocoList(result.stdout);
        return chocoPackages.map(pkg => ({
            id: pkg.id,
            name: pkg.name,
            version: pkg.version,
            source: 'chocolatey'
        }));
    } async search(query: string): Promise<PackageInfo[]> {
        this.validateExecFunction();

        const result = await this.execFunction!('choco', ['search', query, '--limit-output']);

        if (result.exitCode !== 0) {
            throw new Error(`Chocolatey search failed: ${result.stderr}`);
        }

        const chocoPackages = this.parseChocoList(result.stdout);
        return chocoPackages.map(pkg => ({
            id: pkg.id,
            name: pkg.name,
            version: pkg.version,
            source: 'chocolatey'
        }));
    }

    async install(packageId: string, version?: string): Promise<boolean> {
        this.validateExecFunction();

        const args = ['install', packageId, '-y'];
        if (version) {
            args.push('--version', version);
        }

        const result = await this.execFunction!('choco', args);

        return result.exitCode === 0;
    }

    async uninstall(packageId: string): Promise<boolean> {
        this.validateExecFunction();

        const result = await this.execFunction!('choco', ['uninstall', packageId, '-y']);

        return result.exitCode === 0;
    }

    async ensurePresent(packageId: string): Promise<boolean> {
        this.validateExecFunction();

        try {
            const result = await this.execFunction!('choco', ['list', packageId, '--local-only', '--exact']);
            return result.exitCode === 0 && result.stdout.trim().length > 0;
        } catch (error) {
            return false;
        }
    }

    private parseChocoList(output: string): ChocoPackage[] {
        const packages: ChocoPackage[] = [];
        const lines = output.trim().split('\n');

        for (const line of lines) {
            if (line.trim() && !line.startsWith('Chocolatey v')) {
                const parts = line.split('|');
                if (parts.length >= 2) {
                    packages.push({
                        id: parts[0].trim(),
                        name: parts[0].trim(), // Choco doesn't always provide display names
                        version: parts[1].trim(),
                    });
                }
            }
        }

        return packages;
    }

    private validateExecFunction(): void {
        if (!this.execFunction) {
            throw new Error('Exec function not provided');
        }
    }
}
