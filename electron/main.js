const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron')
const { spawn } = require('child_process')
const path = require('path')

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit()
}

const isDev = process.env.NODE_ENV === 'development'

let mainWindow

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    height: 800,
    width: 1200,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    titleBarStyle: 'default',
    minWidth: 800,
    minHeight: 600,
  })

  // and load the index.html of the app.
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'dist/index.html'))
  }

  // Open external links in the default browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC handlers for PowerShell operations
ipcMain.handle('execute-powershell', async (event, script, args = []) => {
  return new Promise((resolve, reject) => {
    const powershellPath = isDev 
      ? path.join(__dirname, '../_old/SoftwareManager.ps1')
      : path.join(app.getAppPath(), 'powershell/SoftwareManager.ps1')
    const psArgs = ['-ExecutionPolicy', 'Bypass', '-File', powershellPath, ...args]
    
    const ps = spawn('powershell.exe', psArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: true
    })

    let stdout = ''
    let stderr = ''

    ps.stdout.on('data', (data) => {
      stdout += data.toString()
      // Send progress updates to renderer
      event.sender.send('powershell-output', data.toString())
    })

    ps.stderr.on('data', (data) => {
      stderr += data.toString()
      event.sender.send('powershell-error', data.toString())
    })

    ps.on('close', (code) => {
      resolve({
        success: code === 0 || code === 1, // 0 = success, 1 = success with warnings
        stdout,
        stderr,
        exitCode: code
      })
    })

    ps.on('error', (error) => {
      reject(error)
    })
  })
})

ipcMain.handle('select-file', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, options)
  return result
})

ipcMain.handle('select-folder', async (event, options) => {
  const result = await dialog.showOpenDialog(mainWindow, {
    ...options,
    properties: ['openDirectory']
  })
  return result
})

ipcMain.handle('show-save-dialog', async (event, options) => {
  const result = await dialog.showSaveDialog(mainWindow, options)
  return result
})

// Handle file operations
ipcMain.handle('get-app-path', () => {
  return app.getAppPath()
})

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData')
})

// Check if file exists
const fs = require('fs')
ipcMain.handle('file-exists', async (event, filePath) => {
  try {
    await fs.promises.access(filePath)
    return true
  } catch {
    return false
  }
})

// Read file content
ipcMain.handle('read-file', async (event, filePath) => {
  try {
    const content = await fs.promises.readFile(filePath, 'utf8')
    return { success: true, content }
  } catch (error) {
    return { success: false, error: error.message }
  }
})

// Write file content
ipcMain.handle('write-file', async (event, filePath, content) => {
  try {
    await fs.promises.writeFile(filePath, content, 'utf8')
    return { success: true }
  } catch (error) {
    return { success: false, error: error.message }
  }
})
