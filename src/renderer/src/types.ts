export interface EnvironmentVariable {
  key: string
  value: string
  isValid: boolean
  type: 'env' | 'alias'
  category?: string
}

export interface ShellInfo {
  defaultShell: string
  shellName: string
  configPath: string
  activeConfig: string
}

export interface Category {
  name: string
  prefix: string
  description?: string
  color?: string
}

export interface EnvData {
  env: { [key: string]: string }
  aliases: { [key: string]: string }
}

export type ViewType = 'env' | 'alias' | 'all'
