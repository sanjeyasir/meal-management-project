const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  onFingerprint: (callback) => ipcRenderer.on('fingerprint-scan', callback),
  platform: process.platform,
  isElectron: true
});
