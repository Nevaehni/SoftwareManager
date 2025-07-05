import { app, BrowserWindow } from 'electron';
import * as path from 'path';

let mainWindow: BrowserWindow | null = null;

export function createMainWindow(): BrowserWindow {
    mainWindow = new BrowserWindow({
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
if (require.main === module) {
    handleAppReady();
    handleWindowsClosed();
}
