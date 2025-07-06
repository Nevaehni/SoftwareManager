const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

// Import the main module to get access to the IPC handlers
const main = require('./dist/packages/electron/main/main.js');

async function testSettingsPersistence() {
    console.log('Testing settings persistence...');

    await app.whenReady();

    // Test 1: Load initial settings
    console.log('\n=== Test 1: Load initial settings ===');
    try {
        // Simulate the get-settings IPC call
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        console.log('Settings file path:', settingsPath);

        const fs = require('fs');
        if (fs.existsSync(settingsPath)) {
            const currentSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
            console.log('Current settings in file:', currentSettings);
        } else {
            console.log('No settings file exists yet');
        }
    } catch (error) {
        console.error('Error reading settings:', error);
    }

    // Test 2: Save new settings
    console.log('\n=== Test 2: Save new settings ===');
    const newSettings = {
        enableChoco: false,
        enableWinget: true
    };

    try {
        // Simulate the save-settings IPC call
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2));
        console.log('Saved settings:', newSettings);

        // Verify they were saved
        const savedSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        console.log('Verified saved settings:', savedSettings);

        if (JSON.stringify(savedSettings) === JSON.stringify(newSettings)) {
            console.log('✅ Settings saved correctly');
        } else {
            console.log('❌ Settings not saved correctly');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
    }

    // Test 3: Save different settings
    console.log('\n=== Test 3: Save different settings ===');
    const differentSettings = {
        enableChoco: true,
        enableWinget: false
    };

    try {
        const settingsPath = path.join(app.getPath('userData'), 'settings.json');
        fs.writeFileSync(settingsPath, JSON.stringify(differentSettings, null, 2));
        console.log('Saved different settings:', differentSettings);

        // Verify they were saved
        const savedSettings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
        console.log('Verified saved settings:', savedSettings);

        if (JSON.stringify(savedSettings) === JSON.stringify(differentSettings)) {
            console.log('✅ Different settings saved correctly');
        } else {
            console.log('❌ Different settings not saved correctly');
        }
    } catch (error) {
        console.error('Error saving different settings:', error);
    }

    console.log('\n=== Settings persistence test complete ===');
    app.quit();
}

app.whenReady().then(testSettingsPersistence);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});
