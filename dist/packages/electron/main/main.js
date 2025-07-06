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
const choco_adapter_1 = require("../../adapters/windows/choco-adapter");
const fs = __importStar(require("fs"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
let mainWindow = null;
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        },
    }); // Load the index.html file
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
// In Electron, require.main is undefined, so we check if we're the main module differently
if (!module.parent || require.main === module) {
    setupIpcHandlers();
    handleAppReady();
    handleWindowsClosed();
}
// IPC handlers for renderer communication
function setupIpcHandlers() {
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
            const settings = await loadSettings();
            const backupService = new backup_service_1.BackupService(undefined, settings);
            // Set up progress reporting
            backupService.setProgressCallback((progress, message) => {
                if (mainWindow) {
                    mainWindow.webContents.send('backup-progress', { progress, message });
                }
            });
            // Add Winget adapter if enabled
            if (settings.enableWinget !== false) {
                const wingetAdapter = new winget_adapter_1.WingetAdapter(execFunction);
                backupService.addAdapter('winget', wingetAdapter);
            }
            // Add Chocolatey adapter if enabled
            if (settings.enableChoco !== false) {
                const chocoAdapter = new choco_adapter_1.ChocoAdapter(execFunction);
                backupService.addAdapter('choco', chocoAdapter);
            }
            await backupService.run();
            return { success: true };
        }
        catch (error) {
            console.error('Backup failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }); // Restore packages
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
            // Set up progress reporting
            restoreService.setProgressCallback((progress, message) => {
                if (mainWindow) {
                    mainWindow.webContents.send('restore-progress', { progress, message });
                }
            });
            const result = await restoreService.run(bundlePath);
            return { success: result.success, installed: result.installed, failed: result.failed };
        }
        catch (error) {
            console.error('Restore failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    }); // Get settings
    electron_1.ipcMain.handle('get-settings', async () => {
        try {
            console.log('IPC: Received get-settings request');
            const settings = await loadSettings();
            console.log('IPC: Returning settings:', settings);
            return settings;
        }
        catch (error) {
            console.error('IPC: Failed to load settings:', error);
            return { enableChoco: true, enableWinget: true }; // Default settings
        }
    }); // Save settings
    electron_1.ipcMain.handle('save-settings', async (event, settings) => {
        try {
            console.log('IPC: Received save-settings request with:', settings);
            await saveSettings(settings);
            console.log('IPC: Settings saved successfully');
            return { success: true };
        }
        catch (error) {
            console.error('IPC: Failed to save settings:', error);
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
    }); // Directory selection
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
    // Package search
    electron_1.ipcMain.handle('search-packages', async (event, query) => {
        try {
            console.log('IPC: Received search-packages request for:', query);
            const execFunction = async (command, args) => {
                const result = await execAsync(`${command} ${args.join(' ')}`);
                return {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: 0
                };
            };
            const settings = await loadSettings();
            const allResults = [];
            // Search with Winget if enabled
            if (settings.enableWinget !== false) {
                try {
                    const wingetAdapter = new winget_adapter_1.WingetAdapter(execFunction);
                    const wingetResults = await wingetAdapter.search(query);
                    allResults.push(...wingetResults.map(pkg => ({ ...pkg, source: 'winget' })));
                }
                catch (error) {
                    console.warn('Winget search failed:', error);
                }
            }
            // Search with Chocolatey if enabled
            if (settings.enableChoco !== false) {
                try {
                    const chocoAdapter = new choco_adapter_1.ChocoAdapter(execFunction);
                    const chocoResults = await chocoAdapter.search(query);
                    allResults.push(...chocoResults.map(pkg => ({ ...pkg, source: 'chocolatey' })));
                }
                catch (error) {
                    console.warn('Chocolatey search failed:', error);
                }
            }
            console.log(`IPC: Returning ${allResults.length} search results`);
            return { success: true, packages: allResults };
        }
        catch (error) {
            console.error('Package search failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
    // Package installation
    electron_1.ipcMain.handle('install-package', async (event, packageId, source, version) => {
        try {
            console.log(`IPC: Received install-package request for ${packageId} from ${source}`);
            const execFunction = async (command, args) => {
                const result = await execAsync(`${command} ${args.join(' ')}`);
                return {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: 0
                };
            };
            let adapter;
            if (source === 'winget') {
                adapter = new winget_adapter_1.WingetAdapter(execFunction);
            }
            else if (source === 'chocolatey') {
                adapter = new choco_adapter_1.ChocoAdapter(execFunction);
            }
            else {
                throw new Error(`Unknown package source: ${source}`);
            }
            const result = await adapter.install(packageId, version);
            if (result) {
                console.log(`IPC: Successfully installed ${packageId}`);
                return { success: true, message: `${packageId} installed successfully` };
            }
            else {
                console.log(`IPC: Failed to install ${packageId}`);
                return { success: false, error: `Failed to install ${packageId}` };
            }
        }
        catch (error) {
            console.error('Package installation failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });
    // Window controls
    electron_1.ipcMain.handle('minimize-window', () => {
        if (mainWindow) {
            mainWindow.minimize();
        }
    });
    electron_1.ipcMain.handle('maximize-window', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            }
            else {
                mainWindow.maximize();
            }
        }
    });
    electron_1.ipcMain.handle('close-window', () => {
        if (mainWindow) {
            mainWindow.close();
        }
    });
}
// Settings management
async function loadSettings() {
    const settingsPath = path.join(electron_1.app.getPath('userData'), 'settings.json');
    console.log('Loading settings from:', settingsPath);
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            const settings = JSON.parse(data);
            console.log('Loaded settings:', settings);
            return settings;
        }
        else {
            console.log('Settings file does not exist, using defaults');
        }
    }
    catch (error) {
        console.error('Failed to load settings:', error);
    }
    const defaults = { enableChoco: true, enableWinget: true };
    console.log('Using default settings:', defaults);
    return defaults; // Default settings
}
async function saveSettings(settings) {
    const settingsPath = path.join(electron_1.app.getPath('userData'), 'settings.json');
    console.log('Saving settings to:', settingsPath);
    console.log('Settings to save:', settings);
    try {
        // Ensure the directory exists
        const userDataPath = electron_1.app.getPath('userData');
        if (!fs.existsSync(userDataPath)) {
            console.log('Creating user data directory:', userDataPath);
            fs.mkdirSync(userDataPath, { recursive: true });
        }
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        console.log('Settings saved successfully');
        // Verify the file was written correctly
        if (fs.existsSync(settingsPath)) {
            const savedData = fs.readFileSync(settingsPath, 'utf8');
            console.log('Verified saved settings:', JSON.parse(savedData));
        }
    }
    catch (error) {
        console.error('Failed to save settings:', error);
        throw error;
    }
}
//# sourceMappingURL=main.js.map