import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { BackupService } from '../../core/src/backup-service';
import { RestoreService } from '../../core/src/restore-service';
import { WingetAdapter } from '../../adapters/windows/winget-adapter';
import { ChocoAdapter } from '../../adapters/windows/choco-adapter';
import { Settings } from '../../core/src/settings';
import * as fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        frame: false,
        titleBarStyle: 'hidden',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, '..', 'preload', 'preload.js'),
        },
    });// Load the index.html file
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

export async function handleAppReady(): Promise<void> {
    await app.whenReady();
    createMainWindow();
}

export function handleWindowsClosed(): void {
    app.on('window-all-closed', () => {
        // On macOS, keep the app running even when all windows are closed
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        // On macOS, re-create a window when the dock icon is clicked
        if (BrowserWindow.getAllWindows().length === 0) {
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
function setupIpcHandlers(): void {    // Backup packages
    ipcMain.handle('backup-packages', async () => {
        try {
            const execFunction = async (command: string, args: string[]) => {
                const result = await execAsync(`${command} ${args.join(' ')}`);
                return {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: 0
                };
            };

            const settings = await loadSettings();
            const backupService = new BackupService(undefined, settings);

            // Set up progress reporting
            backupService.setProgressCallback((progress: number, message: string) => {
                if (mainWindow) {
                    mainWindow.webContents.send('backup-progress', { progress, message });
                }
            });

            // Add Winget adapter if enabled
            if (settings.enableWinget !== false) {
                const wingetAdapter = new WingetAdapter(execFunction);
                backupService.addAdapter('winget', wingetAdapter);
            }

            // Add Chocolatey adapter if enabled
            if (settings.enableChoco !== false) {
                const chocoAdapter = new ChocoAdapter(execFunction);
                backupService.addAdapter('choco', chocoAdapter);
            }

            await backupService.run();
            return { success: true };
        } catch (error) {
            console.error('Backup failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });    // Restore packages
    ipcMain.handle('restore-packages', async (event, bundlePath: string) => {
        try {
            const execFunction = async (command: string, args: string[]) => {
                const result = await execAsync(`${command} ${args.join(' ')}`);
                return {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: 0
                };
            };

            const adapter = new WingetAdapter(execFunction);
            const restoreService = new RestoreService(adapter);

            // Set up progress reporting
            restoreService.setProgressCallback((progress: number, message: string) => {
                if (mainWindow) {
                    mainWindow.webContents.send('restore-progress', { progress, message });
                }
            });

            const result = await restoreService.run(bundlePath);
            return { success: result.success, installed: result.installed, failed: result.failed };
        } catch (error) {
            console.error('Restore failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    // Get settings
    ipcMain.handle('get-settings', async () => {
        try {
            return await loadSettings();
        } catch (error) {
            console.error('Failed to load settings:', error);
            return { enableChoco: true, enableWinget: true }; // Default settings
        }
    });

    // Save settings
    ipcMain.handle('save-settings', async (event, settings: Settings) => {
        try {
            await saveSettings(settings);
            return { success: true };
        } catch (error) {
            console.error('Failed to save settings:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    // File selection
    ipcMain.handle('select-file', async (event, options = {}) => {
        try {
            const result = await dialog.showOpenDialog(mainWindow!, {
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
        } catch (error) {
            console.error('File selection failed:', error);
            return { filePath: null, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });    // Directory selection
    ipcMain.handle('select-directory', async () => {
        try {
            const result = await dialog.showOpenDialog(mainWindow!, {
                properties: ['openDirectory']
            });

            if (!result.canceled && result.filePaths.length > 0) {
                return { directoryPath: result.filePaths[0] };
            }
            return { directoryPath: null };
        } catch (error) {
            console.error('Directory selection failed:', error);
            return { directoryPath: null, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    // Window controls
    ipcMain.handle('minimize-window', () => {
        if (mainWindow) {
            mainWindow.minimize();
        }
    });

    ipcMain.handle('maximize-window', () => {
        if (mainWindow) {
            if (mainWindow.isMaximized()) {
                mainWindow.unmaximize();
            } else {
                mainWindow.maximize();
            }
        }
    });

    ipcMain.handle('close-window', () => {
        if (mainWindow) {
            mainWindow.close();
        }
    });
}

// Settings management
async function loadSettings(): Promise<Settings> {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
    return { enableChoco: true, enableWinget: true }; // Default settings
}

async function saveSettings(settings: Settings): Promise<void> {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    } catch (error) {
        console.error('Failed to save settings:', error);
        throw error;
    }
}
