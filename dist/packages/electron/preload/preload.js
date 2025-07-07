"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    backupPackages: () => electron_1.ipcRenderer.invoke('backup-packages'),
    restorePackages: (bundlePath) => electron_1.ipcRenderer.invoke('restore-packages', bundlePath),
    getSettings: () => electron_1.ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => electron_1.ipcRenderer.invoke('save-settings', settings), // File system operations
    selectFile: (options) => electron_1.ipcRenderer.invoke('select-file', options),
    selectDirectory: () => electron_1.ipcRenderer.invoke('select-directory'),
    selectCustomInstaller: () => electron_1.ipcRenderer.invoke('select-custom-installer'),
    downloadCustomInstaller: (url) => electron_1.ipcRenderer.invoke('download-custom-installer', url), // Package management
    searchPackages: (query) => electron_1.ipcRenderer.invoke('search-packages', query),
    installPackage: (packageId, source, version) => electron_1.ipcRenderer.invoke('install-package', packageId, source, version),
    uninstallPackage: (packageId, source) => electron_1.ipcRenderer.invoke('uninstall-package', packageId, source),
    listInstalledPackages: () => electron_1.ipcRenderer.invoke('list-installed-packages'),
    // Editor functionality
    loadSpecFile: () => electron_1.ipcRenderer.invoke('load-spec-file'),
    saveSpecFile: (content, language) => electron_1.ipcRenderer.invoke('save-spec-file', content, language),
    validateSpec: (content, language) => electron_1.ipcRenderer.invoke('validate-spec', content, language),
    // Window controls
    minimizeWindow: () => electron_1.ipcRenderer.invoke('minimize-window'),
    maximizeWindow: () => electron_1.ipcRenderer.invoke('maximize-window'),
    closeWindow: () => electron_1.ipcRenderer.invoke('close-window'),
    // Event listeners
    onBackupProgress: (callback) => electron_1.ipcRenderer.on('backup-progress', callback),
    onRestoreProgress: (callback) => electron_1.ipcRenderer.on('restore-progress', callback),
    // Cleanup
    removeAllListeners: (channel) => electron_1.ipcRenderer.removeAllListeners(channel),
});
//# sourceMappingURL=preload.js.map