const { contextBridge, ipcRenderer } = require('electron')

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // PowerShell operations
  executePowerShell: (script, args) => 
    ipcRenderer.invoke('execute-powershell', script, args),
  
  // File operations
  selectFile: (options) => 
    ipcRenderer.invoke('select-file', options),
  
  selectFolder: (options) => 
    ipcRenderer.invoke('select-folder', options),
  
  showSaveDialog: (options) => 
    ipcRenderer.invoke('show-save-dialog', options),
  
  // App paths
  getAppPath: () => ipcRenderer.invoke('get-app-path'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  
  // File system
  fileExists: (filePath) => ipcRenderer.invoke('file-exists', filePath),
  readFile: (filePath) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  
  // Event listeners
  onPowerShellOutput: (callback) => {
    ipcRenderer.on('powershell-output', (_, data) => callback(data))
  },
  
  onPowerShellError: (callback) => {
    ipcRenderer.on('powershell-error', (_, data) => callback(data))
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel)
  }
})
