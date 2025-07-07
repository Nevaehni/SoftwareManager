import * as fs from 'fs';
import { PackageAdapter } from './package-adapter';
import { Settings } from './settings';
import { CustomInstallerService } from './custom-installer-service';

interface AdapterConfig {
    name: string;
    adapter: PackageAdapter;
    enabled: boolean;
}

// Progress reporting interface
interface ProgressCallback {
    (progress: number, message: string): void;
}

// Version pinning interface
interface VersionPins {
    [packageId: string]: string;
}

export class BackupService {
    private adapters: AdapterConfig[] = [];
    private settings?: Settings;
    private progressCallback?: ProgressCallback;
    private customInstallerService: CustomInstallerService;
    private customInstallers: string[] = [];
    private versionPins: VersionPins = {};

    constructor(adapter?: PackageAdapter, settings?: Settings) {
        // Maintain backward compatibility
        if (adapter) {
            this.adapters.push({
                name: 'winget',
                adapter,
                enabled: true
            });
        }
        this.settings = settings;
        this.customInstallerService = new CustomInstallerService();
    }

    setProgressCallback(callback: ProgressCallback): void {
        this.progressCallback = callback;
    }

    /**
     * Set version pinning for specific packages
     */
    setVersionPinning(versionPins: VersionPins): void {
        // Validate version format
        for (const [packageId, version] of Object.entries(versionPins)) {
            if (!version || version.trim() === '') {
                throw new Error(`Invalid version format for package ${packageId}: version cannot be empty`);
            }
            // Basic version format validation (allows semantic versioning patterns)
            if (!/^[\d]+[\d\w\.\-]*$/i.test(version.trim())) {
                throw new Error(`Invalid version format for package ${packageId}: ${version}`);
            }
        }

        this.versionPins = { ...versionPins };
    } addAdapter(name: string, adapter: PackageAdapter): void {
        this.adapters.push({
            name,
            adapter,
            enabled: this.isAdapterEnabled(name)
        });
    }

    /**
     * Add a custom MSI/EXE installer to be included in the backup
     */
    addCustomInstaller(installerPath: string): void {
        this.customInstallers.push(installerPath);
    }

    /**
     * Get list of custom installers to be included in backup
     */
    getCustomInstallers(): string[] {
        return [...this.customInstallers];
    } async run(): Promise<void> {
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }

        this.progressCallback?.(0, 'Starting backup...');

        // Create combined backup with packages from all enabled adapters
        let combinedPackages: string[] = [];
        const enabledAdapters = this.adapters.filter(config => config.enabled);

        // Sort adapters by priority order if specified in settings
        const prioritizedAdapters = this.sortAdaptersByPriority(enabledAdapters);

        // Track version pin metadata
        const versionPinMetadata: string[] = [];

        for (let i = 0; i < prioritizedAdapters.length; i++) {
            const config = prioritizedAdapters[i];
            const progress = Math.round((i / prioritizedAdapters.length) * 80); // Reserve 20% for final steps

            this.progressCallback?.(progress, `Exporting ${config.name} packages...`);

            try {
                // Use listInstalled if available to get package information for version pinning
                if (config.adapter.listInstalled && Object.keys(this.versionPins).length > 0) {
                    const installedPackages = await config.adapter.listInstalled();

                    combinedPackages.push(`# ${config.name.toUpperCase()} packages`);
                    combinedPackages.push('packages:');

                    for (const pkg of installedPackages) {
                        const pinnedVersion = this.versionPins[pkg.id];
                        const versionToUse = pinnedVersion || pkg.version;

                        // Track version pin metadata
                        if (pinnedVersion && pinnedVersion !== pkg.version) {
                            versionPinMetadata.push(`# ${pkg.id}: ${pinnedVersion} (pinned from ${pkg.version})`);
                        }

                        combinedPackages.push(`  - id: ${pkg.id}`);
                        combinedPackages.push(`    name: ${pkg.name}`);
                        combinedPackages.push(`    version: ${versionToUse}`);
                    }
                    combinedPackages.push(''); // Add empty line between sections
                } else {
                    // Fallback to original exportList method when no version pinning or listInstalled not available
                    const tempFile = `tmp/${config.name}-packages.yaml`;
                    await config.adapter.exportList(tempFile);

                    // Read the generated file and extract packages
                    if (fs.existsSync(tempFile)) {
                        const content = fs.readFileSync(tempFile, 'utf8');
                        combinedPackages.push(`# ${config.name.toUpperCase()} packages`);
                        combinedPackages.push(content);
                        combinedPackages.push(''); // Add empty line between sections

                        // Clean up temp file
                        fs.unlinkSync(tempFile);
                    }
                }
            } catch (error) {
                console.warn(`Failed to export from ${config.name}:`, error);
            }
        } this.progressCallback?.(90, 'Adding custom installers...');

        // Add custom installers to backup if any were specified
        if (this.customInstallers.length > 0) {
            const customInstallersDir = 'tmp/custom-installers';

            for (const installerPath of this.customInstallers) {
                try {
                    const result = await this.customInstallerService.addInstallerToBundle(
                        installerPath,
                        customInstallersDir
                    );
                    if (!result.success) {
                        console.warn(`Failed to add custom installer ${installerPath}:`, result.error);
                    }
                } catch (error) {
                    console.warn(`Failed to add custom installer ${installerPath}:`, error);
                }
            }

            // Add reference to custom installers in the spec file
            if (fs.existsSync(`${customInstallersDir}/custom-installers.json`)) {
                combinedPackages.push('# CUSTOM INSTALLERS');
                combinedPackages.push('# See custom-installers/ directory for MSI/EXE files');
                combinedPackages.push('');
            }
        }

        // Add version pinning metadata if any pins were applied
        if (versionPinMetadata.length > 0) {
            combinedPackages.push('# VERSION PINNING');
            combinedPackages.push('# The following packages have been pinned to specific versions:');
            combinedPackages.push(...versionPinMetadata);
            combinedPackages.push('');
        }

        this.progressCallback?.(95, 'Finalizing backup...');

        // Write combined output
        const finalContent = combinedPackages.join('\n');

        // Ensure tmp directory exists
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }

        fs.writeFileSync('tmp/spec.yaml', finalContent || '');

        this.progressCallback?.(100, 'Backup completed successfully!');
    }

    private isAdapterEnabled(adapterName: string): boolean {
        if (!this.settings) {
            return true; // Default to enabled if no settings
        }

        switch (adapterName.toLowerCase()) {
            case 'choco':
            case 'chocolatey':
                return this.settings.enableChoco !== false;
            case 'winget':
                return this.settings.enableWinget !== false;
            default:
                return true; // Unknown adapters default to enabled
        }
    }

    private shouldExport(): boolean {
        // Legacy method for backward compatibility
        return this.isAdapterEnabled('winget');
    }

    private sortAdaptersByPriority(adapters: AdapterConfig[]): AdapterConfig[] {
        if (!this.settings?.packagePriority || this.settings.packagePriority.length === 0) {
            // No priority specified, return adapters in original order
            return adapters;
        }

        const priorityOrder = this.settings.packagePriority;

        // Sort adapters according to priority order
        return adapters.sort((a, b) => {
            const aIndex = priorityOrder.indexOf(a.name);
            const bIndex = priorityOrder.indexOf(b.name);

            // If adapter not in priority list, put it at the end
            const aPosition = aIndex === -1 ? Number.MAX_SAFE_INTEGER : aIndex;
            const bPosition = bIndex === -1 ? Number.MAX_SAFE_INTEGER : bIndex;

            return aPosition - bPosition;
        });
    }
}
