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

// New interfaces for restore preview
interface PreviewPackage {
    id: string;
    name: string;
    bundleVersion: string;
    installedVersion?: string;
    action: 'install' | 'upgrade' | 'downgrade' | 'reinstall' | 'skip';
    reason?: string;
}

interface RestorePreview {
    totalPackages: number;
    newInstalls: PreviewPackage[];
    upgrades: PreviewPackage[];
    downgrades: PreviewPackage[];
    reinstalls: PreviewPackage[];
    skipped: PreviewPackage[];
    summary: {
        willInstall: number;
        willUpgrade: number;
        willDowngrade: number;
        willReinstall: number;
        willSkip: number;
    };
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
    }

    /**
     * Compare version strings to determine version relationship
     * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
     */
    private compareVersions(v1: string, v2: string): number {
        // Simple version comparison - can be enhanced later
        const cleanV1 = v1.replace(/[^\d.]/g, '');
        const cleanV2 = v2.replace(/[^\d.]/g, '');

        const parts1 = cleanV1.split('.').map(n => parseInt(n) || 0);
        const parts2 = cleanV2.split('.').map(n => parseInt(n) || 0);

        const maxLength = Math.max(parts1.length, parts2.length);

        for (let i = 0; i < maxLength; i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;

            if (p1 > p2) return 1;
            if (p1 < p2) return -1;
        }

        return 0;
    }

    /**
     * Preview what would happen during a restore operation
     */
    async previewRestore(bundleFilename: string): Promise<RestorePreview> {
        this.progressCallback?.(0, 'Reading bundle file...');

        const bundlePackages = await this.readBundle(bundleFilename);

        this.progressCallback?.(20, 'Getting currently installed packages...');

        // Get currently installed packages
        let installedPackages: any[] = [];
        try {
            if (this.adapter.listInstalled) {
                installedPackages = await this.adapter.listInstalled();
            }
        } catch (error) {
            console.warn('Failed to list installed packages:', error);
        }

        this.progressCallback?.(60, 'Analyzing package differences...');

        // Create lookup map for installed packages
        const installedMap = new Map<string, any>();
        installedPackages.forEach(pkg => {
            installedMap.set(pkg.id, pkg);
        });

        const newInstalls: PreviewPackage[] = [];
        const upgrades: PreviewPackage[] = [];
        const downgrades: PreviewPackage[] = [];
        const reinstalls: PreviewPackage[] = [];
        const skipped: PreviewPackage[] = [];

        // Analyze each package in the bundle
        for (const bundlePkg of bundlePackages) {
            const installed = installedMap.get(bundlePkg.id);

            if (!installed) {
                // Package not installed - will be new install
                newInstalls.push({
                    id: bundlePkg.id,
                    name: bundlePkg.name,
                    bundleVersion: bundlePkg.version,
                    action: 'install',
                    reason: 'Package not currently installed'
                });
            } else {
                // Package is installed - compare versions
                const comparison = this.compareVersions(bundlePkg.version, installed.version);

                if (comparison > 0) {
                    // Bundle version is newer - upgrade
                    upgrades.push({
                        id: bundlePkg.id,
                        name: bundlePkg.name,
                        bundleVersion: bundlePkg.version,
                        installedVersion: installed.version,
                        action: 'upgrade',
                        reason: `Upgrade from ${installed.version} to ${bundlePkg.version}`
                    });
                } else if (comparison < 0) {
                    // Bundle version is older - downgrade
                    downgrades.push({
                        id: bundlePkg.id,
                        name: bundlePkg.name,
                        bundleVersion: bundlePkg.version,
                        installedVersion: installed.version,
                        action: 'downgrade',
                        reason: `Downgrade from ${installed.version} to ${bundlePkg.version}`
                    });
                } else {
                    // Same version - reinstall
                    reinstalls.push({
                        id: bundlePkg.id,
                        name: bundlePkg.name,
                        bundleVersion: bundlePkg.version,
                        installedVersion: installed.version,
                        action: 'reinstall',
                        reason: `Same version (${installed.version}) - will reinstall`
                    });
                }
            }
        }

        this.progressCallback?.(100, 'Preview analysis complete');

        const preview: RestorePreview = {
            totalPackages: bundlePackages.length,
            newInstalls,
            upgrades,
            downgrades,
            reinstalls,
            skipped,
            summary: {
                willInstall: newInstalls.length,
                willUpgrade: upgrades.length,
                willDowngrade: downgrades.length,
                willReinstall: reinstalls.length,
                willSkip: skipped.length
            }
        };

        return preview;
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
