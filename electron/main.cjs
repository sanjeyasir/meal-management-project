const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');
const { fork } = require('child_process');

let mainWindow = null;
let middlewareProcess = null;

// Start embedded middleware server on port 5000 if not already active
function ensureMiddlewareRunning() {
  const req = http.get('http://localhost:5000/status', (res) => {
    console.log('[Electron Main] Middleware server is already active on port 5000.');
  });

  req.on('error', () => {
    console.log('[Electron Main] Launching embedded Middleware Server on port 5000...');
    try {
      const serverScript = path.join(__dirname, '../server/middlewareServer.js');
      middlewareProcess = fork(serverScript, [], {
        env: { ...process.env, PORT: '5000' },
        silent: false
      });
      console.log('[Electron Main] Embedded Middleware Server launched successfully.');
    } catch (e) {
      console.error('[Electron Main] Failed to spawn embedded middleware:', e);
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 650,
    title: "Hayleys Eco Solutions - Meal Management System",
    icon: path.join(__dirname, '../public/diet.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      webSecurity: false
    },
    autoHideMenuBar: true,
    show: false
  });

  const startUrl = process.env.ELECTRON_START_URL || `file://${path.join(__dirname, '../dist/index.html')}`;

  mainWindow.loadURL(startUrl);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  ensureMiddlewareRunning();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (middlewareProcess) {
    middlewareProcess.kill();
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
