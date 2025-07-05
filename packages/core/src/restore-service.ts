import { PackageAdapter } from './package-adapter';
import * as fs from 'fs';
import * as yaml from 'js-yaml';

// Progress reporting interface
interface ProgressCallback {
    (progress: number, message: string): void;
}

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
    private progressCallback?: ProgressCallback;

    constructor(adapter: PackageAdapter) {
        this.adapter = adapter;
    }

    setProgressCallback(callback: ProgressCallback): void {
        this.progressCallback = callback;
    }

    async readBundle(filename: string): Promise<Package[]> {
        const content = fs.readFileSync(filename, 'utf8');
        const parsed = yaml.load(content) as { packages: Package[] };
        return parsed.packages || [];
    } async installPackages(packages: Package[]): Promise<InstallResult[]> {
        const results: InstallResult[] = [];

        for (let i = 0; i < packages.length; i++) {
            const pkg = packages[i];
            const progress = Math.round((i / packages.length) * 100);

            this.progressCallback?.(progress, `Installing ${pkg.name}...`);

            try {
                // Use the adapter's install method (assuming it exists on WingetAdapter)
                const success = await (this.adapter as any).install(pkg.id, pkg.version);
                results.push({ id: pkg.id, success });
            } catch (error) {
                results.push({ id: pkg.id, success: false });
            }
        }

        return results;
    } async run(bundleFilename: string): Promise<RestoreResult> {
        try {
            this.progressCallback?.(0, 'Reading bundle file...');

            const packages = await this.readBundle(bundleFilename);

            this.progressCallback?.(10, `Found ${packages.length} packages to install...`);

            const installResults = await this.installPackages(packages);

            const installed = installResults.filter(r => r.success);
            const failed = installResults.filter(r => !r.success);

            this.progressCallback?.(100, `Restore completed! ${installed.length} installed, ${failed.length} failed`);

            return {
                success: failed.length === 0,
                installed,
                failed
            };
        } catch (error) {
            this.progressCallback?.(0, 'Restore failed');
            return {
                success: false,
                installed: [],
                failed: []
            };
        }
    }
}
