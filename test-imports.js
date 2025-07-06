console.log('Testing imports...');

try {
    console.log('Importing electron...');
    const { app, BrowserWindow } = require('electron');
    console.log('Electron imported successfully');

    console.log('Importing path...');
    const path = require('path');
    console.log('Path imported successfully');

    console.log('Importing backup service...');
    const { BackupService } = require('./dist/packages/core/src/backup-service');
    console.log('BackupService imported successfully');

    console.log('Importing winget adapter...');
    const { WingetAdapter } = require('./dist/packages/adapters/windows/winget-adapter');
    console.log('WingetAdapter imported successfully');

    console.log('All imports successful!');

} catch (error) {
    console.error('Import error:', error);
    console.error('Stack:', error.stack);
}
