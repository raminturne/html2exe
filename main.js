const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let mainWindow;
let activeChild = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1040,
    height: 720,
    minWidth: 820,
    minHeight: 560,
    frame: false,
    backgroundColor: '#111114',
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

ipcMain.on('window:minimize', () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on('window:close', () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle('dialog:pick-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('dialog:pick-icon', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [{ name: 'Icon', extensions: ['ico'] }],
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('dialog:pick-output-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    defaultPath: path.join(__dirname, 'output'),
  });
  if (result.canceled || result.filePaths.length === 0) return null;
  return result.filePaths[0];
});

ipcMain.handle('app:get-default-output', () => path.join(__dirname, 'output'));

ipcMain.handle('build:start', (_event, params) => {
  if (activeChild) {
    return { ok: false, error: 'A build is already running.' };
  }

  const { input, name, icon, output } = params || {};
  if (!input || !fs.existsSync(input)) {
    return { ok: false, error: 'Please choose a valid input folder.' };
  }

  const args = [path.join(__dirname, 'build.js'), '--input', input];
  if (name) args.push('--name', name);
  if (icon) args.push('--icon', icon);
  if (output) args.push('--output', output);

  const child = spawn('node', args, { cwd: __dirname });
  activeChild = child;

  const forward = (data) => {
    if (mainWindow) mainWindow.webContents.send('build:log', data.toString());
  };
  child.stdout.on('data', forward);
  child.stderr.on('data', forward);

  child.on('close', (code) => {
    activeChild = null;
    if (!mainWindow) return;
    if (code === 0) {
      mainWindow.webContents.send('build:done', {});
    } else {
      mainWindow.webContents.send('build:error', { code });
    }
  });

  child.on('error', (err) => {
    activeChild = null;
    if (mainWindow) mainWindow.webContents.send('build:error', { message: String(err && err.message || err) });
  });

  return { ok: true };
});

ipcMain.handle('shell:open-path', async (_event, targetPath) => {
  if (!targetPath) return;
  const stat = fs.existsSync(targetPath) ? fs.statSync(targetPath) : null;
  if (stat && stat.isFile()) {
    shell.showItemInFolder(targetPath);
  } else {
    await shell.openPath(targetPath);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
