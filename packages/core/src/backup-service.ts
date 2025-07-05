import * as fs from 'fs';
import { PackageAdapter } from './package-adapter';

export class BackupService {
    private adapter?: PackageAdapter;

    constructor(adapter?: PackageAdapter) {
        this.adapter = adapter;
    }

    run() {
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp');
        }
        fs.writeFileSync('tmp/spec.yaml', '');
        
        if (this.adapter) {
            this.adapter.exportList('tmp/spec.yaml');
        }
    }
}
