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
exports.WingetAdapter = void 0;
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
// Default exec function that uses real child_process
const defaultExecFunction = (command, args) => {
    return new Promise((resolve) => {
        const child = (0, child_process_1.spawn)(command, args, {
            stdio: ['ignore', 'pipe', 'pipe'],
            shell: true
        });
        let stdout = '';
        let stderr = '';
        child.stdout?.on('data', (data) => {
            stdout += data.toString();
        });
        child.stderr?.on('data', (data) => {
            stderr += data.toString();
        });
        child.on('close', (code) => {
            resolve({
                stdout,
                stderr,
                exitCode: code || 0
            });
        });
        child.on('error', (error) => {
            resolve({
                stdout,
                stderr: error.message,
                exitCode: 1
            });
        });
    });
};
class WingetAdapter {
    constructor(execFunction) {
        this.execFunction = execFunction || defaultExecFunction;
    }
    async exportList(filename) {
        this.validateExecFunction();
        try {
            // Call winget list to get installed packages
            const result = await this.execFunction('winget', ['list', '--accept-source-agreements']);
            if (result.exitCode === 0) {
                // Parse the table output to get packages
                const packages = this.parseWingetSearchOutput(result.stdout);
                // Convert to YAML-like format
                let content = 'packages:\n';
                packages.forEach(pkg => {
                    content += `  - id: ${pkg.id}\n`;
                    content += `    name: ${pkg.name}\n`;
                    content += `    version: ${pkg.version}\n`;
                });
                fs.writeFileSync(filename, content);
                return;
            }
        }
        catch (error) {
            console.error('Failed to export package list:', error);
            throw new Error(`Failed to export package list: ${error}`);
        }
        throw new Error('Failed to export package list - winget command failed');
    }
    async search(query) {
        this.validateExecFunction(); // Remove --source restriction to search all sources
        const result = await this.execFunction('winget', ['search', query, '--accept-source-agreements']);
        if (result.exitCode !== 0) {
            throw new Error(`Winget search failed: ${result.stderr}`);
        }
        try {
            // Parse the table output instead of expecting JSON
            const packages = this.parseWingetSearchOutput(result.stdout);
            return packages;
        }
        catch (error) {
            console.error('Failed to parse winget search output:', error);
            throw new Error(`Failed to parse winget search output: ${error}`);
        }
    }
    parseWingetSearchOutput(output) {
        const lines = output.split('\n');
        const packages = [];
        // Find the header line (look for "Name" and "Id" keywords)
        let headerLineIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('Name') && line.includes('Id') && line.includes('Version')) {
                headerLineIndex = i;
                break;
            }
        }
        if (headerLineIndex === -1) {
            return packages; // No packages found
        }
        // Find the separator line (starts with dashes, usually right after header)
        let separatorLineIndex = -1;
        for (let i = headerLineIndex + 1; i < lines.length; i++) {
            if (lines[i].includes('----')) {
                separatorLineIndex = i;
                break;
            }
        }
        if (separatorLineIndex === -1) {
            return packages;
        }
        // Parse package lines after the separator
        for (let i = separatorLineIndex + 1; i < lines.length; i++) {
            const line = lines[i];
            if (line && line.trim() && !line.startsWith(' ')) {
                try {
                    // Parse using regex to handle variable spacing
                    // Format: Name    Id    Version    [Match]    [Source]
                    const parts = line.trim().split(/\s{2,}/); // Split on 2+ spaces
                    if (parts.length >= 3) {
                        const name = parts[0].trim();
                        const id = parts[1].trim();
                        const version = parts[2].trim();
                        if (name && id && version && name !== 'Name') {
                            packages.push({
                                id,
                                name,
                                version,
                                source: 'winget'
                            });
                        }
                    }
                }
                catch (error) {
                    // Skip malformed lines
                }
            }
        }
        return packages;
    }
    async install(packageId, version) {
        this.validateExecFunction();
        const args = ['install', packageId];
        if (version) {
            args.push('--version', version);
        }
        args.push('--accept-source-agreements');
        const result = await this.execFunction('winget', args);
        return result.exitCode === 0;
    }
    async uninstall(packageId) {
        this.validateExecFunction();
        const result = await this.execFunction('winget', ['uninstall', packageId, '--accept-source-agreements']);
        return result.exitCode === 0;
    }
    async ensurePresent(packageId) {
        this.validateExecFunction();
        try {
            const result = await this.execFunction('winget', ['list', packageId, '--accept-source-agreements']);
            return result.exitCode === 0;
        }
        catch (error) {
            return false;
        }
    }
    async listInstalled() {
        this.validateExecFunction();
        const result = await this.execFunction('winget', ['list', '--accept-source-agreements']);
        if (result.exitCode !== 0) {
            throw new Error(`Winget list failed: ${result.stderr}`);
        }
        try {
            // Parse the table output instead of expecting JSON
            const packages = this.parseWingetSearchOutput(result.stdout);
            return packages;
        }
        catch (error) {
            console.error('Failed to parse winget list output:', error);
            throw new Error(`Failed to parse winget list output: ${error}`);
        }
    }
    validateExecFunction() {
        // No validation needed since execFunction is always set in constructor
    }
}
exports.WingetAdapter = WingetAdapter;
//# sourceMappingURL=winget-adapter.js.map