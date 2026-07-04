const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const Database = require('./db.js');

let mainWindow;
let db;

function findStartFile() {
  const appDir = path.join(__dirname, 'app');
  const preferred = ['index.html', 'Index.html', 'home.html', 'main.html'];
  for (const name of preferred) {
    if (fs.existsSync(path.join(appDir, name))) return path.join(appDir, name);
  }
  const files = fs.readdirSync(appDir).filter((f) => f.toLowerCase().endsWith('.html'));
  if (files.length > 0) return path.join(appDir, files[0]);
  throw new Error('No .html file found inside app/ folder');
}

async function createWindow() {
  const dbPath = path.join(app.getPath('userData'), 'data.sqlite');
  db = new Database(dbPath);
  await db.init();

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.loadFile(findStartFile());
}

ipcMain.handle('db:query', (_event, sql, params) => db.query(sql, params));
ipcMain.handle('db:run', (_event, sql, params) => db.run(sql, params));

app.whenReady().then(createWindow).catch((err) => {
  const logPath = path.join(app.getPath('userData'), 'crash.log');
  try {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, String(err && err.stack || err));
  } catch {}
  dialog.showErrorBox('Startup error', String(err && err.stack || err));
  app.quit();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  if (db) db.close();
});
