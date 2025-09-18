import { contextBridge, ipcRenderer } from 'electron';
const api = {
    getEnvVars: () => ipcRenderer.invoke('get-env-vars'),
    saveEnvVars: (envVars) => ipcRenderer.invoke('save-env-vars', envVars),
    backupConfig: (configFile) => ipcRenderer.invoke('backup-config', configFile),
    getShellInfo: () => ipcRenderer.invoke('get-shell-info')
};
contextBridge.exposeInMainWorld('electronAPI', api);
