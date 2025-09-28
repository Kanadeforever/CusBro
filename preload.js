const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    getConfig: () => ipcRenderer.invoke('get-config'),
    saveConfig: (config) => ipcRenderer.invoke('save-config', config),
    getDefaultConfig: () => ipcRenderer.invoke('get-default-config'),
    windowControl: (action) => ipcRenderer.invoke('window-control', action),
    reloadConfig: () => ipcRenderer.invoke('reload-config'),
    restartApp: () => ipcRenderer.invoke('restart-app'),
    onSettingsSaved: (callback) => ipcRenderer.on('settings-saved', callback),
    showNotification: (message) => ipcRenderer.invoke('show-notification', message)
});
