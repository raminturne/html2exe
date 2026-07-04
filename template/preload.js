const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('db', {
  query: (sql, params = []) => ipcRenderer.invoke('db:query', sql, params),
  run: (sql, params = []) => ipcRenderer.invoke('db:run', sql, params),
});
