import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import * as path from 'path';
import { BackupService } from '../../core/src/backup-service';
import { RestoreService } from '../../core/src/restore-service';
import { WingetAdapter } from '../../adapters/windows/winget-adapter';
import { ChocoAdapter } from '../../adapters/windows/choco-adapter';
import { Settings } from '../../core/src/settings';
import { CustomInstallerService } from '../../core/src/custom-installer-service';
import * as fs from 'fs';
import * as os from 'os';
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
    });    // Load the index.html file
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
    });    // Get settings
    ipcMain.handle('get-settings', async () => {
        try {
            console.log('IPC: Received get-settings request');
            const settings = await loadSettings();
            console.log('IPC: Returning settings:', settings);
            return settings;
        } catch (error) {
            console.error('IPC: Failed to load settings:', error);
            return { enableChoco: true, enableWinget: true }; // Default settings
        }
    });// Save settings
    ipcMain.handle('save-settings', async (event, settings: Settings) => {
        try {
            console.log('IPC: Received save-settings request with:', settings);
            await saveSettings(settings);
            console.log('IPC: Settings saved successfully');
            return { success: true };
        } catch (error) {
            console.error('IPC: Failed to save settings:', error);
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
    });

    // Custom installer file selection
    ipcMain.handle('select-custom-installer', async () => {
        try {
            const result = await dialog.showOpenDialog(mainWindow!, {
                properties: ['openFile'],
                filters: [
                    { name: 'Installer files', extensions: ['msi', 'exe'] },
                    { name: 'MSI files', extensions: ['msi'] },
                    { name: 'EXE files', extensions: ['exe'] },
                    { name: 'All files', extensions: ['*'] }
                ]
            });

            if (!result.canceled && result.filePaths.length > 0) {
                const filePath = result.filePaths[0];

                // Validate file extension
                const ext = path.extname(filePath).toLowerCase();
                if (!['.msi', '.exe'].includes(ext)) {
                    return {
                        success: false,
                        error: 'Only MSI and EXE files are supported'
                    };
                }

                // Check file size (500MB limit)
                const stats = fs.statSync(filePath);
                const maxSize = 500 * 1024 * 1024; // 500MB
                if (stats.size > maxSize) {
                    return {
                        success: false,
                        error: 'File size exceeds maximum limit of 500MB'
                    };
                }

                return { success: true, filePath };
            }

            return { success: true, cancelled: true };
        } catch (error) {
            console.error('Custom installer selection failed:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    });

    // Directory selection
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

    // Package search
    ipcMain.handle('search-packages', async (event, query: string) => {
        try {
            console.log('IPC: Received search-packages request for:', query);
            const execFunction = async (command: string, args: string[]) => {
                const result = await execAsync(`${command} ${args.join(' ')}`);
                return {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: 0
                };
            };

            const settings = await loadSettings();
            const allResults: any[] = [];

            // Search with Winget if enabled
            if (settings.enableWinget !== false) {
                try {
                    const wingetAdapter = new WingetAdapter(execFunction);
                    const wingetResults = await wingetAdapter.search(query);
                    allResults.push(...wingetResults.map(pkg => ({ ...pkg, source: 'winget' })));
                } catch (error) {
                    console.warn('Winget search failed:', error);
                }
            }

            // Search with Chocolatey if enabled
            if (settings.enableChoco !== false) {
                try {
                    const chocoAdapter = new ChocoAdapter(execFunction);
                    const chocoResults = await chocoAdapter.search(query);
                    allResults.push(...chocoResults.map(pkg => ({ ...pkg, source: 'chocolatey' })));
                } catch (error) {
                    console.warn('Chocolatey search failed:', error);
                }
            }

            console.log(`IPC: Returning ${allResults.length} search results`);
            return { success: true, packages: allResults };
        } catch (error) {
            console.error('Package search failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });

    // Package installation
    ipcMain.handle('install-package', async (event, packageId: string, source: string, version?: string) => {
        try {
            console.log(`IPC: Received install-package request for ${packageId} from ${source}`);
            const execFunction = async (command: string, args: string[]) => {
                const result = await execAsync(`${command} ${args.join(' ')}`);
                return {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: 0
                };
            };

            let adapter;
            if (source === 'winget') {
                adapter = new WingetAdapter(execFunction);
            } else if (source === 'chocolatey') {
                adapter = new ChocoAdapter(execFunction);
            } else {
                throw new Error(`Unknown package source: ${source}`);
            }

            const result = await adapter.install(packageId, version);

            if (result) {
                console.log(`IPC: Successfully installed ${packageId}`);
                return { success: true, message: `${packageId} installed successfully` };
            } else {
                console.log(`IPC: Failed to install ${packageId}`);
                return { success: false, error: `Failed to install ${packageId}` };
            }
        } catch (error) {
            console.error('Package installation failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });    // Package uninstallation
    ipcMain.handle('uninstall-package', async (event, packageId: string, source: string) => {
        try {
            console.log(`IPC: Received uninstall-package request for ${packageId} from ${source}`);
            const execFunction = async (command: string, args: string[]) => {
                const result = await execAsync(`${command} ${args.join(' ')}`);
                return {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: 0
                };
            };

            let adapter;
            if (source === 'winget') {
                adapter = new WingetAdapter(execFunction);
            } else if (source === 'chocolatey') {
                adapter = new ChocoAdapter(execFunction);
            } else {
                throw new Error(`Unknown package source: ${source}`);
            }

            const result = await adapter.uninstall(packageId);

            if (result) {
                console.log(`IPC: Successfully uninstalled ${packageId}`);
                return { success: true, message: `${packageId} uninstalled successfully` };
            } else {
                console.log(`IPC: Failed to uninstall ${packageId}`);
                return { success: false, error: `Failed to uninstall ${packageId}` };
            }
        } catch (error) {
            console.error('Package uninstallation failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
        }
    });    // List installed packages
    ipcMain.handle('list-installed-packages', async () => {
        try {
            console.log('IPC: Received list-installed-packages request');
            const execFunction = async (command: string, args: string[]) => {
                const result = await execAsync(`${command} ${args.join(' ')}`);
                return {
                    stdout: result.stdout,
                    stderr: result.stderr,
                    exitCode: 0
                };
            };

            const settings = await loadSettings();
            const allResults: any[] = [];

            // List packages from Winget if enabled
            if (settings.enableWinget !== false) {
                try {
                    const wingetAdapter = new WingetAdapter(execFunction);
                    const wingetResults = await wingetAdapter.listInstalled();
                    allResults.push(...wingetResults.map(pkg => ({ ...pkg, source: 'winget' })));
                } catch (error) {
                    console.warn('Winget list failed:', error);
                }
            }

            // List packages from Chocolatey if enabled
            if (settings.enableChoco !== false) {
                try {
                    const chocoAdapter = new ChocoAdapter(execFunction);
                    const chocoResults = await chocoAdapter.listInstalled();
                    allResults.push(...chocoResults.map(pkg => ({ ...pkg, source: 'chocolatey' })));
                } catch (error) {
                    console.warn('Chocolatey list failed:', error);
                }
            }

            console.log(`IPC: Returning ${allResults.length} installed packages`);
            return { success: true, packages: allResults };
        } catch (error) {
            console.error('List installed packages failed:', error);
            return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
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

    // Custom installer URL download
    ipcMain.handle('download-custom-installer', async (event, url: string) => {
        try {
            console.log('Downloading custom installer from URL:', url);

            // Create a temporary directory for downloads
            const tempDir = path.join(os.tmpdir(), 'software-manager', 'downloads');
            await fs.promises.mkdir(tempDir, { recursive: true });

            // Use the custom installer service to download
            const customInstallerService = new CustomInstallerService();
            const result = await customInstallerService.downloadInstaller(url, tempDir);

            if (result.success) {
                return { success: true, filePath: result.installerPath };
            } else {
                return { success: false, error: result.error };
            }
        } catch (error) {
            console.error('Error downloading custom installer:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    });
}

// Settings management
async function loadSettings(): Promise<Settings> {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    console.log('Loading settings from:', settingsPath);
    try {
        if (fs.existsSync(settingsPath)) {
            const data = fs.readFileSync(settingsPath, 'utf8');
            const settings = JSON.parse(data);
            console.log('Loaded settings:', settings);
            return settings;
        } else {
            console.log('Settings file does not exist, using defaults');
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
    const defaults = { enableChoco: true, enableWinget: true };
    console.log('Using default settings:', defaults);
    return defaults; // Default settings
}

async function saveSettings(settings: Settings): Promise<void> {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    console.log('Saving settings to:', settingsPath);
    console.log('Settings to save:', settings);
    try {
        // Ensure the directory exists
        const userDataPath = app.getPath('userData');
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
    } catch (error) {
        console.error('Failed to save settings:', error);
        throw error;
    }
}
