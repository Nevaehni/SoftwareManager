import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    backupPackages: () => ipcRenderer.invoke('backup-packages'),
    restorePackages: (bundlePath: string) => ipcRenderer.invoke('restore-packages', bundlePath),
    getSettings: () => ipcRenderer.invoke('get-settings'),
    saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),

    // File system operations
    selectFile: (options: any) => ipcRenderer.invoke('select-file', options),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),    // Package management
    searchPackages: (query: string) => ipcRenderer.invoke('search-packages', query),
    installPackage: (packageId: string, source: string, version?: string) => ipcRenderer.invoke('install-package', packageId, source, version),
    uninstallPackage: (packageId: string, source: string) => ipcRenderer.invoke('uninstall-package', packageId, source),
    listInstalledPackages: () => ipcRenderer.invoke('list-installed-packages'),

    // Window controls
    minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
    maximizeWindow: () => ipcRenderer.invoke('maximize-window'),
    closeWindow: () => ipcRenderer.invoke('close-window'),

    // Event listeners
    onBackupProgress: (callback: (event: any, ...args: any[]) => void) => ipcRenderer.on('backup-progress', callback),
    onRestoreProgress: (callback: (event: any, ...args: any[]) => void) => ipcRenderer.on('restore-progress', callback),

    // Cleanup
    removeAllListeners: (channel: string) => ipcRenderer.removeAllListeners(channel),
});
