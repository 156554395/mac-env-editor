import { contextBridge, ipcRenderer } from 'electron'

export interface IPCRenderer {
  getEnvVars: () => Promise<{ success: boolean; data?: any; error?: string }>
  saveEnvVars: (envVars: {
    [key: string]: string
  }) => Promise<{ success: boolean; message?: string; error?: string }>
  backupConfig: (
    configFile?: string
  ) => Promise<{ success: boolean; backupPath?: string; error?: string }>
  getShellInfo: () => Promise<{ success: boolean; data?: any; error?: string }>
  getConfigFileContent: (configFile?: string) => Promise<{
    success: boolean
    data?: { content: string; filePath: string; fileName: string }
    error?: string
  }>
  saveConfigFileContent: (data: {
    content: string
    filePath?: string
  }) => Promise<{
    success: boolean
    message?: string
    filePath?: string
    error?: string
  }>
  openExternal: (url: string) => Promise<void>
}

const api: IPCRenderer = {
  getEnvVars: () => ipcRenderer.invoke('get-env-vars'),
  saveEnvVars: envVars => ipcRenderer.invoke('save-env-vars', envVars),
  backupConfig: configFile => ipcRenderer.invoke('backup-config', configFile),
  getShellInfo: () => ipcRenderer.invoke('get-shell-info'),
  getConfigFileContent: configFile =>
    ipcRenderer.invoke('get-config-file-content', configFile),
  saveConfigFileContent: data =>
    ipcRenderer.invoke('save-config-file-content', data),
  openExternal: url => ipcRenderer.invoke('open-external', url)
}

contextBridge.exposeInMainWorld('electronAPI', api)
