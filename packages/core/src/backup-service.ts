import * as fs from 'fs';
import { PackageAdapter } from './package-adapter';
import { Settings } from './settings';

export class BackupService {
    private adapter?: PackageAdapter;
    private settings?: Settings;

    constructor(adapter?: PackageAdapter, settings?: Settings) {
        this.adapter = adapter;
        this.settings = settings;
    } async run(): Promise<void> {
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp');
        }
        fs.writeFileSync('tmp/spec.yaml', '');

        if (this.adapter && this.shouldExport()) {
            await this.adapter.exportList('tmp/spec.yaml');
        }
    }

    private shouldExport(): boolean {
        // If no settings, allow export by default
        if (!this.settings) {
            return true;
        }

        // If choco is explicitly disabled, skip export
        if (this.settings.enableChoco === false) {
            return false;
        }

        return true;
    }
}
