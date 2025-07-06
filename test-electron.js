const { app, BrowserWindow } = require('electron');
const path = require('path');

console.log('Starting minimal Electron app...');

function createWindow() {
    console.log('Creating window...');
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    // Create a simple HTML content
    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test Electron App</title>
    </head>
    <body>
        <h1>Hello Electron!</h1>
        <p>If you can see this, Electron is working.</p>
    </body>
    </html>`;

    win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);
    console.log('Window created and HTML loaded');
}

app.whenReady().then(() => {
    console.log('App ready');
    createWindow();
});

app.on('window-all-closed', () => {
    console.log('All windows closed');
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

console.log('Test script loaded');
