import { PackageAdapter } from './package-adapter';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

interface Package {
    id: string;
    name: string;
    version: string;
}

interface InstallResult {
    id: string;
    success: boolean;
}

interface RestoreResult {
    success: boolean;
    installed: InstallResult[];
    failed: InstallResult[];
}

export class RestoreService {
    private adapter: PackageAdapter;

    constructor(adapter: PackageAdapter) {
        this.adapter = adapter;
    }

    async readBundle(filename: string): Promise<Package[]> {
        const content = fs.readFileSync(filename, 'utf8');
        const parsed = yaml.load(content) as { packages: Package[] };
        return parsed.packages || [];
    }

    async installPackages(packages: Package[]): Promise<InstallResult[]> {
        const results: InstallResult[] = [];

        for (const pkg of packages) {
            try {
                // Use the adapter's install method (assuming it exists on WingetAdapter)
                const success = await (this.adapter as any).install(pkg.id, pkg.version);
                results.push({ id: pkg.id, success });
            } catch (error) {
                results.push({ id: pkg.id, success: false });
            }
        }

        return results;
    }

    async run(bundleFilename: string): Promise<RestoreResult> {
        try {
            const packages = await this.readBundle(bundleFilename);
            const installResults = await this.installPackages(packages);

            const installed = installResults.filter(r => r.success);
            const failed = installResults.filter(r => !r.success);

            return {
                success: failed.length === 0,
                installed,
                failed
            };
        } catch (error) {
            return {
                success: false,
                installed: [],
                failed: []
            };
        }
    }
}
