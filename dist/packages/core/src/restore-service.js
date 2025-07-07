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
exports.RestoreService = void 0;
const fs = __importStar(require("fs"));
const yaml = __importStar(require("js-yaml"));
class RestoreService {
    constructor(adapter) {
        this.adapter = adapter;
    }
    setProgressCallback(callback) {
        this.progressCallback = callback;
    }
    async readBundle(filename) {
        const content = fs.readFileSync(filename, 'utf8');
        const parsed = yaml.load(content);
        return parsed.packages || [];
    }
    /**
     * Compare version strings to determine version relationship
     * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
     */
    compareVersions(v1, v2) {
        // Simple version comparison - can be enhanced later
        const cleanV1 = v1.replace(/[^\d.]/g, '');
        const cleanV2 = v2.replace(/[^\d.]/g, '');
        const parts1 = cleanV1.split('.').map(n => parseInt(n) || 0);
        const parts2 = cleanV2.split('.').map(n => parseInt(n) || 0);
        const maxLength = Math.max(parts1.length, parts2.length);
        for (let i = 0; i < maxLength; i++) {
            const p1 = parts1[i] || 0;
            const p2 = parts2[i] || 0;
            if (p1 > p2)
                return 1;
            if (p1 < p2)
                return -1;
        }
        return 0;
    }
    /**
     * Preview what would happen during a restore operation
     */
    async previewRestore(bundleFilename) {
        this.progressCallback?.(0, 'Reading bundle file...');
        const bundlePackages = await this.readBundle(bundleFilename);
        this.progressCallback?.(20, 'Getting currently installed packages...');
        // Get currently installed packages
        let installedPackages = [];
        try {
            if (this.adapter.listInstalled) {
                installedPackages = await this.adapter.listInstalled();
            }
        }
        catch (error) {
            console.warn('Failed to list installed packages:', error);
        }
        this.progressCallback?.(60, 'Analyzing package differences...');
        // Create lookup map for installed packages
        const installedMap = new Map();
        installedPackages.forEach(pkg => {
            installedMap.set(pkg.id, pkg);
        });
        const newInstalls = [];
        const upgrades = [];
        const downgrades = [];
        const reinstalls = [];
        const skipped = [];
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
            }
            else {
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
                }
                else if (comparison < 0) {
                    // Bundle version is older - downgrade
                    downgrades.push({
                        id: bundlePkg.id,
                        name: bundlePkg.name,
                        bundleVersion: bundlePkg.version,
                        installedVersion: installed.version,
                        action: 'downgrade',
                        reason: `Downgrade from ${installed.version} to ${bundlePkg.version}`
                    });
                }
                else {
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
        const preview = {
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
    }
    async installPackages(packages) {
        const results = [];
        for (let i = 0; i < packages.length; i++) {
            const pkg = packages[i];
            const progress = Math.round((i / packages.length) * 100);
            this.progressCallback?.(progress, `Installing ${pkg.name}...`);
            try {
                // Use the adapter's install method (assuming it exists on WingetAdapter)
                const success = await this.adapter.install(pkg.id, pkg.version);
                results.push({ id: pkg.id, success });
            }
            catch (error) {
                results.push({ id: pkg.id, success: false });
            }
        }
        return results;
    }
    async run(bundleFilename) {
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
        }
        catch (error) {
            this.progressCallback?.(0, 'Restore failed');
            return {
                success: false,
                installed: [],
                failed: []
            };
        }
    }
}
exports.RestoreService = RestoreService;
//# sourceMappingURL=restore-service.js.map