import * as fs from 'fs';
import { PackageAdapter } from './package-adapter';
import { Settings } from './settings';

interface AdapterConfig {
    name: string;
    adapter: PackageAdapter;
    enabled: boolean;
}

// Progress reporting interface
interface ProgressCallback {
    (progress: number, message: string): void;
}

export class BackupService {
    private adapters: AdapterConfig[] = [];
    private settings?: Settings;
    private progressCallback?: ProgressCallback;

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
    }

    setProgressCallback(callback: ProgressCallback): void {
        this.progressCallback = callback;
    }

    addAdapter(name: string, adapter: PackageAdapter): void {
        this.adapters.push({
            name,
            adapter,
            enabled: this.isAdapterEnabled(name)
        });
    } async run(): Promise<void> {
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }

        this.progressCallback?.(0, 'Starting backup...');        // Create combined backup with packages from all enabled adapters
        let combinedPackages: string[] = [];
        const enabledAdapters = this.adapters.filter(config => config.enabled);

        // Sort adapters by priority order if specified in settings
        const prioritizedAdapters = this.sortAdaptersByPriority(enabledAdapters); for (let i = 0; i < prioritizedAdapters.length; i++) {
            const config = prioritizedAdapters[i];
            const progress = Math.round((i / prioritizedAdapters.length) * 80); // Reserve 20% for final steps

            this.progressCallback?.(progress, `Exporting ${config.name} packages...`);

            const tempFile = `tmp/${config.name}-packages.yaml`;
            try {
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
            } catch (error) {
                console.warn(`Failed to export from ${config.name}:`, error);
            }
        }

        this.progressCallback?.(90, 'Finalizing backup...');        // Write combined output
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
