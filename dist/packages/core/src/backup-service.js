"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.BackupService = void 0;
const fs = __importStar(require("fs"));
class BackupService {
    constructor(adapter, settings) {
        this.adapters = [];
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
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }
    addAdapter(name, adapter) {
        this.adapters.push({
            name,
            adapter,
            enabled: this.isAdapterEnabled(name)
        });
    }
    async run() {
        if (!fs.existsSync('tmp')) {
            fs.mkdirSync('tmp', { recursive: true });
        }
        this.progressCallback?.(0, 'Starting backup...');
        // Create combined backup with packages from all enabled adapters
        let combinedPackages = [];
        const enabledAdapters = this.adapters.filter(config => config.enabled);
        for (let i = 0; i < enabledAdapters.length; i++) {
            const config = enabledAdapters[i];
            const progress = Math.round((i / enabledAdapters.length) * 80); // Reserve 20% for final steps
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
            }
            catch (error) {
                console.warn(`Failed to export from ${config.name}:`, error);
            }
        }
        this.progressCallback?.(90, 'Finalizing backup...');
        // Write combined output
        const finalContent = combinedPackages.join('\n');
        fs.writeFileSync('tmp/spec.yaml', finalContent || '');
        this.progressCallback?.(100, 'Backup completed successfully!');
    }
    isAdapterEnabled(adapterName) {
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
    shouldExport() {
        // Legacy method for backward compatibility
        return this.isAdapterEnabled('winget');
    }
}
exports.BackupService = BackupService;
//# sourceMappingURL=backup-service.js.map