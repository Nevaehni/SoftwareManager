const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    backupPackages: () => ipcRenderer.invoke('backup-packages'),
    restorePackages: (bundlePath) => ipcRenderer.invoke('restore-packages', bundlePath),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

    // File system operations
    selectFile: (options) => ipcRenderer.invoke('select-file', options),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),

    // Event listeners
    onBackupProgress: (callback) => ipcRenderer.on('backup-progress', callback),
    onRestoreProgress: (callback) => ipcRenderer.on('restore-progress', callback),

    // Cleanup
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
