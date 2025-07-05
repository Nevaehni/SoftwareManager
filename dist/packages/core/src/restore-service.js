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