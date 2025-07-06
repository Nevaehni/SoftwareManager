"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    backupPackages: () => electron_1.ipcRenderer.invoke('backup-packages'),
    restorePackages: (bundlePath) => electron_1.ipcRenderer.invoke('restore-packages', bundlePath),
    getSettings: () => electron_1.ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => electron_1.ipcRenderer.invoke('save-settings', settings),
    // File system operations
    selectFile: (options) => electron_1.ipcRenderer.invoke('select-file', options),
    selectDirectory: () => electron_1.ipcRenderer.invoke('select-directory'),
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