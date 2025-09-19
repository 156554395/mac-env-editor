import { contextBridge, ipcRenderer } from 'electron';
const api = {
    getEnvVars: () => ipcRenderer.invoke('get-env-vars'),
    saveEnvVars: envVars => ipcRenderer.invoke('save-env-vars', envVars),
    backupConfig: configFile => ipcRenderer.invoke('backup-config', configFile),
    getShellInfo: () => ipcRenderer.invoke('get-shell-info'),
    getConfigFileContent: configFile => ipcRenderer.invoke('get-config-file-content', configFile),
    saveConfigFileContent: data => ipcRenderer.invoke('save-config-file-content', data),
    openExternal: url => ipcRenderer.invoke('open-external', url)
};
contextBridge.exposeInMainWorld('electronAPI', api);
