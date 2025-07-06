const { app, BrowserWindow } = require('electron');
const path = require('path');

console.log('Testing main module execution...');
console.log('require.main:', require.main);
console.log('module:', module);
console.log('require.main === module:', require.main === module);

let mainWindow = null;

function createMainWindow() {
    console.log('Creating main window...');

    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
        },
    });

    console.log('Main window created, loading HTML...');

    // Load simple HTML
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Software Manager</title>
    </head>
    <body>
        <h1>Software Manager Test</h1>
        <p>This is a test version to check if the window appears.</p>
    </body>
    </html>`;

    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    console.log('HTML loaded');

    mainWindow.on('closed', () => {
        console.log('Main window closed');
        mainWindow = null;
    });

    console.log('Main window setup complete');
    return mainWindow;
}

async function handleAppReady() {
    console.log('App ready, waiting for Electron...');
    await app.whenReady();
    console.log('Electron ready, creating window...');
    createMainWindow();
    console.log('Window creation initiated');
}

function handleWindowsClosed() {
    app.on('window-all-closed', () => {
        if (process.platform !== 'darwin') {
            app.quit();
        }
    });

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createMainWindow();
        }
    });
}

// Always run (remove the require.main check)
console.log('Starting app initialization...');
handleAppReady();
handleWindowsClosed();
console.log('App initialization complete');
