const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('html2exe', {
  pickInputFolder: () => ipcRenderer.invoke('dialog:pick-folder'),
  pickIcon: () => ipcRenderer.invoke('dialog:pick-icon'),
  pickOutputFolder: () => ipcRenderer.invoke('dialog:pick-output-folder'),
  getDefaultOutput: () => ipcRenderer.invoke('app:get-default-output'),
  startBuild: (params) => ipcRenderer.invoke('build:start', params),
  onLog: (cb) => ipcRenderer.on('build:log', (_event, chunk) => cb(chunk)),
  onDone: (cb) => ipcRenderer.on('build:done', (_event, payload) => cb(payload)),
  onError: (cb) => ipcRenderer.on('build:error', (_event, payload) => cb(payload)),
  openPath: (targetPath) => ipcRenderer.invoke('shell:open-path', targetPath),
  minimizeWindow: () => ipcRenderer.send('window:minimize'),
  closeWindow: () => ipcRenderer.send('window:close'),
});
