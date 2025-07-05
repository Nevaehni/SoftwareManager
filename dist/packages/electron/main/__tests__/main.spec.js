"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
// Mock Electron before any imports
jest.mock('electron', () => ({
    app: {
        whenReady: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
        quit: jest.fn(),
        getPath: jest.fn().mockReturnValue('/mock/user/data'),
    },
    BrowserWindow: jest.fn().mockImplementation(() => ({
        loadFile: jest.fn(),
        on: jest.fn(),
        webContents: {
            openDevTools: jest.fn(),
        },
        getAllWindows: jest.fn().mockReturnValue([]),
        isDestroyed: jest.fn().mockReturnValue(false),
        close: jest.fn(),
    })),
    ipcMain: {
        handle: jest.fn(),
    },
    dialog: {
        showOpenDialog: jest.fn(),
    },
}));
// Mock fs module
jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(false),
    readFileSync: jest.fn().mockReturnValue('{}'),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn(),
}));
// Mock child_process
jest.mock('child_process', () => ({
    exec: jest.fn(),
}));
// Mock util
jest.mock('util', () => ({
    promisify: jest.fn().mockReturnValue(jest.fn()),
}));
// Mock core modules
jest.mock('../../../core/src/backup-service', () => ({
    BackupService: jest.fn().mockImplementation(() => ({
        run: jest.fn().mockResolvedValue(undefined),
    })),
}));
jest.mock('../../../core/src/restore-service', () => ({
    RestoreService: jest.fn().mockImplementation(() => ({
        run: jest.fn().mockResolvedValue({ success: true, installed: [], failed: [] }),
    })),
}));
jest.mock('../../../adapters/windows/winget-adapter', () => ({
    WingetAdapter: jest.fn().mockImplementation(() => ({
        exportList: jest.fn(),
        install: jest.fn(),
    })),
}));
const electron_1 = require("electron");
describe('Electron Main Process', () => {
    let mainWindow = null;
    afterEach(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.close();
            mainWindow = null;
        }
        jest.resetModules();
    });
    test('Main_window_creates_successfully', () => {
        // Red phase: Test that main window can be created
        const { createMainWindow } = require('../main-simple');
        mainWindow = createMainWindow();
        expect(mainWindow).toBeDefined();
        expect(electron_1.BrowserWindow).toHaveBeenCalledWith({
            width: 1200,
            height: 800,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: expect.stringContaining('preload.js'),
            },
        });
    });
    test('App_handles_ready_event', async () => {
        // Red phase: Test that app.whenReady creates the main window
        const { handleAppReady } = require('../main-simple');
        await handleAppReady();
        expect(electron_1.app.whenReady).toHaveBeenCalled();
        expect(electron_1.BrowserWindow).toHaveBeenCalled(); // Window should be created after ready
    });
    test('App_handles_window_close', () => {
        // Red phase: Test that app handles all windows closed event
        const { handleWindowsClosed } = require('../main-simple');
        handleWindowsClosed();
        expect(electron_1.app.on).toHaveBeenCalledWith('window-all-closed', expect.any(Function));
        expect(electron_1.app.on).toHaveBeenCalledWith('activate', expect.any(Function));
    });
});
//# sourceMappingURL=main.spec.js.map