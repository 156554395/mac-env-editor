import { EnvironmentVariable, ShellInfo } from '../../types'
import { ConfigParser } from './configParser'

export class EnvManager {
  private static instance: EnvManager
  private envVars: EnvironmentVariable[] = []
  private shellInfo: ShellInfo | null = null

  static getInstance(): EnvManager {
    if (!EnvManager.instance) {
      EnvManager.instance = new EnvManager()
    }
    return EnvManager.instance
  }

  async loadEnvironmentVariables(): Promise<EnvironmentVariable[]> {
    try {
      const result = await window.electronAPI.getEnvVars()

      if (result.success && result.data) {
        const parsed = Object.entries(result.data).map(([key, value]) => ({
          key,
          value: value as string,
          isValid: this.validateEnvironmentVariable(key, value as string)
        }))

        this.envVars = parsed.sort((a, b) => a.key.localeCompare(b.key))
        return this.envVars
      } else {
        throw new Error(result.error || '加载环境变量失败')
      }
    } catch (error) {
      console.error('加载环境变量失败:', error)
      throw error
    }
  }

  async loadShellInfo(): Promise<ShellInfo> {
    try {
      const result = await window.electronAPI.getShellInfo()

      if (result.success && result.data) {
        this.shellInfo = result.data
        return this.shellInfo
      } else {
        throw new Error(result.error || '加载Shell信息失败')
      }
    } catch (error) {
      console.error('加载Shell信息失败:', error)
      throw error
    }
  }

  async saveEnvironmentVariables(
    envVars: EnvironmentVariable[]
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      const validVars = envVars.filter(
        env => env.isValid && env.key && env.value !== undefined
      )
      const envMap = validVars.reduce(
        (acc, env) => {
          acc[env.key] = env.value
          return acc
        },
        {} as { [key: string]: string }
      )

      const result = await window.electronAPI.saveEnvVars(envMap)

      if (result.success) {
        this.envVars = envVars
      }

      return result
    } catch (error) {
      console.error('保存环境变量失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  async backupConfig(
    configFile?: string
  ): Promise<{ success: boolean; backupPath?: string; error?: string }> {
    try {
      const result = await window.electronAPI.backupConfig(configFile)
      return result
    } catch (error) {
      console.error('备份配置失败:', error)
      return {
        success: false,
        error: error.message
      }
    }
  }

  addEnvironmentVariable(key: string, value: string): EnvironmentVariable {
    const newVar: EnvironmentVariable = {
      key: key.toUpperCase(),
      value,
      isValid: this.validateEnvironmentVariable(key, value)
    }

    this.envVars.push(newVar)
    this.envVars.sort((a, b) => a.key.localeCompare(b.key))

    return newVar
  }

  removeEnvironmentVariable(index: number): EnvironmentVariable | null {
    if (index >= 0 && index < this.envVars.length) {
      return this.envVars.splice(index, 1)[0]
    }
    return null
  }

  updateEnvironmentVariable(
    index: number,
    key?: string,
    value?: string
  ): EnvironmentVariable | null {
    if (index >= 0 && index < this.envVars.length) {
      const envVar = this.envVars[index]

      if (key !== undefined) {
        envVar.key = key.toUpperCase()
      }

      if (value !== undefined) {
        envVar.value = value
      }

      envVar.isValid = this.validateEnvironmentVariable(
        envVar.key,
        envVar.value
      )

      return envVar
    }
    return null
  }

  getEnvironmentVariables(): EnvironmentVariable[] {
    return [...this.envVars]
  }

  getShellInfo(): ShellInfo | null {
    return this.shellInfo
  }

  searchEnvironmentVariables(query: string): EnvironmentVariable[] {
    const lowerQuery = query.toLowerCase()
    return this.envVars.filter(
      env =>
        env.key.toLowerCase().includes(lowerQuery) ||
        env.value.toLowerCase().includes(lowerQuery)
    )
  }

  hasChanges(originalEnvVars: EnvironmentVariable[]): boolean {
    if (this.envVars.length !== originalEnvVars.length) {
      return true
    }

    return this.envVars.some((env, index) => {
      const original = originalEnvVars[index]
      return (
        !original ||
        env.key !== original.key ||
        env.value !== original.value ||
        env.isValid !== original.isValid
      )
    })
  }

  validateEnvironmentVariable(key: string, value: string): boolean {
    if (!key || typeof key !== 'string') {
      return false
    }

    const keyRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/
    if (!keyRegex.test(key)) {
      return false
    }

    if (value === undefined) {
      return false
    }

    return true
  }

  isVariableNameValid(name: string): boolean {
    return this.validateEnvironmentVariable(name, '')
  }

  validateBeforeSave(envVars: EnvironmentVariable[]): {
    isValid: boolean
    errors: string[]
  } {
    const errors: string[] = []

    const validVars = envVars.filter(
      env => env.isValid && env.key && env.value !== undefined
    )
    const keyMap = new Map<string, EnvironmentVariable[]>()

    for (const env of validVars) {
      if (!keyMap.has(env.key)) {
        keyMap.set(env.key, [])
      }
      keyMap.get(env.key)!.push(env)
    }

    for (const [key, vars] of keyMap) {
      if (vars.length > 1) {
        errors.push(`发现重复的变量名: ${key}`)
      }
    }

    const pathVars = validVars.filter(env => env.key === 'PATH')
    if (pathVars.length > 1) {
      errors.push('发现多个PATH变量定义')
    }

    for (const env of validVars) {
      if (env.key.includes(' ')) {
        errors.push(`变量名不能包含空格: ${env.key}`)
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  getEnvironmentVariableByCategory(): {
    [category: string]: EnvironmentVariable[]
  } {
    const categories = {
      system: [],
      path: [],
      shell: [],
      development: [],
      application: [],
      custom: []
    }

    for (const env of this.envVars) {
      const key = env.key.toUpperCase()

      if (key.includes('PATH')) {
        categories.path.push(env)
      } else if (
        key.includes('SHELL') ||
        key.includes('HOME') ||
        key.includes('USER') ||
        key.includes('TERM')
      ) {
        categories.system.push(env)
      } else if (key.includes('LANG') || key.includes('LC_')) {
        categories.shell.push(env)
      } else if (
        key.includes('NODE_') ||
        key.includes('NPM_') ||
        key.includes('PYTHON') ||
        key.includes('JAVA_') ||
        key.includes('GO')
      ) {
        categories.development.push(env)
      } else if (
        key.includes('HTTP_') ||
        key.includes('DATABASE_') ||
        key.includes('APP_')
      ) {
        categories.application.push(env)
      } else {
        categories.custom.push(env)
      }
    }

    return categories
  }

  exportToEnvFormat(envVars: EnvironmentVariable[]): string {
    return envVars
      .filter(env => env.isValid && env.key && env.value !== undefined)
      .map(env => `${env.key}="${env.value}"`)
      .join('\n')
  }

  exportToJsonFormat(envVars: EnvironmentVariable[]): string {
    const validVars = envVars.filter(
      env => env.isValid && env.key && env.value !== undefined
    )
    const obj = validVars.reduce(
      (acc, env) => {
        acc[env.key] = env.value
        return acc
      },
      {} as { [key: string]: string }
    )

    return JSON.stringify(obj, null, 2)
  }

  getStatistics(envVars: EnvironmentVariable[]): {
    total: number
    valid: number
    invalid: number
    categories: { [category: string]: number }
  } {
    const validVars = envVars.filter(
      env => env.isValid && env.key && env.value !== undefined
    )
    const categories = this.getEnvironmentVariableByCategory()

    const categoryCounts = Object.keys(categories).reduce(
      (acc, category) => {
        acc[category] = categories[category as keyof typeof categories].length
        return acc
      },
      {} as { [category: string]: number }
    )

    return {
      total: envVars.length,
      valid: validVars.length,
      invalid: envVars.length - validVars.length,
      categories: categoryCounts
    }
  }
}
