const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    backupPackages: (versionPins) => ipcRenderer.invoke('backup-packages', versionPins),
    restorePackages: (bundlePath) => ipcRenderer.invoke('restore-packages', bundlePath),
    previewRestore: (bundlePath) => ipcRenderer.invoke('preview-restore', bundlePath),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // File system operations
    selectFile: (options) => ipcRenderer.invoke('select-file', options),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),

    // Package management
    searchPackages: (query) => ipcRenderer.invoke('search-packages', query),
    installPackage: (packageId, source, version) => ipcRenderer.invoke('install-package', packageId, source, version),
    listInstalledPackages: () => ipcRenderer.invoke('list-installed-packages'),

    // Event listeners
    onBackupProgress: (callback) => ipcRenderer.on('backup-progress', callback),
    onRestoreProgress: (callback) => ipcRenderer.on('restore-progress', callback),
    onPreviewProgress: (callback) => ipcRenderer.on('preview-progress', callback),

    // Cleanup
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
