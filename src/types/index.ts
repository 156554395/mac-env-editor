export interface EnvironmentVariable {
  key: string
  value: string
  description?: string
  isValid: boolean
  source?: string
  type: 'env' | 'alias'
  category?: string
}

export interface ShellInfo {
  defaultShell: string
  shellName: string
  configPath: string
  activeConfig: string
}

export interface ConfigFile {
  path: string
  exists: boolean
  content: string
  lastModified: Date
}

export interface BackupResult {
  success: boolean
  backupPath?: string
  message?: string
  error?: string
}

export interface EnvData {
  env: { [key: string]: string }
  aliases: { [key: string]: string }
}

export type ConfigFileType = '.zshrc' | '.bash_profile' | '.bashrc' | '.profile' | '/etc/paths'