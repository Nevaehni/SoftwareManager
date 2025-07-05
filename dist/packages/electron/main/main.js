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
exports.createMainWindow = createMainWindow;
exports.handleAppReady = handleAppReady;
exports.handleWindowsClosed = handleWindowsClosed;
const electron_1 = require("electron");
const path = __importStar(require("path"));
const backup_service_1 = require("../../core/src/backup-service");
const restore_service_1 = require("../../core/src/restore-service");
const winget_adapter_1 = require("../../adapters/windows/winget-adapter");
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let mainWindow = null;
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        },
    });
    // Load the index.html file
    mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
    // Open DevTools in development
    if (process.env.NODE_ENV === 'development') {
        mainWindow.webContents.openDevTools();
    }
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
    return mainWindow;
}
async function handleAppReady() {
    await electron_1.app.whenReady();
    createMainWindow();
}
function handleWindowsClosed() {
    electron_1.app.on('window-all-closed', () => {
        // On macOS, keep the app running even when all windows are closed
        if (process.platform !== 'darwin') {
            electron_1.app.quit();
        }
    });
    electron_1.app.on('activate', () => {
        // On macOS, re-create a window when the dock icon is clicked
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
}
// Main app initialization
if (require.main === module) {
    setupIpcHandlers();
    handleAppReady();
    handleWindowsClosed();
}
// IPC handlers for renderer communication
function setupIpcHandlers() {
    // Backup packages
    electron_1.ipcMain.handle('backup-packages', async () => {
        try {
            const execFunction = async (command, args) => {
                const result = await execAsync(`${command} ${args.join(' ')}`);
                return {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: 0
                };
            };
            const adapter = new winget_adapter_1.WingetAdapter(execFunction);
            const settings = await loadSettings();
            const backupService = new backup_service_1.BackupService(adapter, settings);
            await backupService.run();
            return { success: true };
        }
        catch (error) {
            console.error('Backup failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
    // Restore packages
    electron_1.ipcMain.handle('restore-packages', async (event, bundlePath) => {
        try {
            const execFunction = async (command, args) => {
                const result = await execAsync(`${command} ${args.join(' ')}`);
                return {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: 0
                };
            };
            const adapter = new winget_adapter_1.WingetAdapter(execFunction);
            const restoreService = new restore_service_1.RestoreService(adapter);
            const result = await restoreService.run(bundlePath);
            return { success: result.success, installed: result.installed, failed: result.failed };
        }
        catch (error) {
            console.error('Restore failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
    // Get settings
    electron_1.ipcMain.handle('get-settings', async () => {
        try {
            return await loadSettings();
        }
        catch (error) {
            console.error('Failed to load settings:', error);
            return { enableChoco: true }; // Default settings
        }
    });
    // Save settings
    electron_1.ipcMain.handle('save-settings', async (event, settings) => {
        try {
            await saveSettings(settings);
            return { success: true };
        }
        catch (error) {
            console.error('Failed to save settings:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
    // File selection
    electron_1.ipcMain.handle('select-file', async (event, options = {}) => {
        try {
            const result = await electron_1.dialog.showOpenDialog(mainWindow, {
                properties: ['openFile'],
                filters: [
                    { name: 'YAML files', extensions: ['yaml', 'yml'] },
                    { name: 'All files', extensions: ['*'] }
                ],
                ...options
            });
            if (!result.canceled && result.filePaths.length > 0) {
                return { filePath: result.filePaths[0] };
            }
            return { filePath: null };
        }
        catch (error) {
            console.error('File selection failed:', error);
            return { filePath: null, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
    // Directory selection
    electron_1.ipcMain.handle('select-directory', async () => {
        try {
            const result = await electron_1.dialog.showOpenDialog(mainWindow, {
                properties: ['openDirectory']
            });
            if (!result.canceled && result.filePaths.length > 0) {
                return { directoryPath: result.filePaths[0] };
            }
            return { directoryPath: null };
        }
        catch (error) {
            console.error('Directory selection failed:', error);
            return { directoryPath: null, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
}
// Settings management
async function loadSettings() {
    const settingsPath = path.join(electron_1.app.getPath('userData'), 'settings.json');
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            return JSON.parse(data);
        }
    }
    catch (error) {
        console.error('Failed to load settings:', error);
    }
    return { enableChoco: true }; // Default settings
}
async function saveSettings(settings) {
    const settingsPath = path.join(electron_1.app.getPath('userData'), 'settings.json');
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    }
    catch (error) {
        console.error('Failed to save settings:', error);
        throw error;
    }
}
//# sourceMappingURL=main.js.map