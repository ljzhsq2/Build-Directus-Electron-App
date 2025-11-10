const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  onSplashEnded: () => ipcRenderer.invoke('onSplashEnded'),
});
