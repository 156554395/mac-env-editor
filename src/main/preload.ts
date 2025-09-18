import { contextBridge, ipcRenderer } from 'electron'

export interface IPCRenderer {
  getEnvVars: () => Promise<{ success: boolean; data?: any; error?: string }>
  saveEnvVars: (envVars: { [key: string]: string }) => Promise<{ success: boolean; message?: string; error?: string }>
  backupConfig: (configFile?: string) => Promise<{ success: boolean; backupPath?: string; error?: string }>
  getShellInfo: () => Promise<{ success: boolean; data?: any; error?: string }>
}

const api: IPCRenderer = {
  getEnvVars: () => ipcRenderer.invoke('get-env-vars'),
  saveEnvVars: (envVars) => ipcRenderer.invoke('save-env-vars', envVars),
  backupConfig: (configFile) => ipcRenderer.invoke('backup-config', configFile),
  getShellInfo: () => ipcRenderer.invoke('get-shell-info')
}

contextBridge.exposeInMainWorld('electronAPI', api)