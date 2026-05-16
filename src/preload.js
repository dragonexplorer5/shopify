const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  searchLinks: (query) => ipcRenderer.invoke('search-links', query)
});
