import { EnvironmentVariable, ConfigFile } from '../../types'

export class ConfigParser {
  private readonly ENV_VAR_REGEX = /^export\s+([^=]+)=(.*)$/
  private readonly COMMENT_REGEX = /^\s*#/

  static parseFileContent(content: string): EnvironmentVariable[] {
    const envVars: EnvironmentVariable[] = []
    const lines = content.split('\n')

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^export\s+([^=]+)=(.*)$/)
        if (match) {
          envVars.push({
            key: match[1].trim(),
            value: this.unquoteValue(match[2].trim()),
            isValid: this.validateEnvironmentVariable(
              match[1].trim(),
              match[2].trim()
            )
          })
        }
      }
    }

    return envVars
  }

  static generateFileContent(envVars: EnvironmentVariable[]): string {
    return envVars
      .filter(env => env.isValid && env.key && env.value !== undefined)
      .map(env => `export ${env.key}="${this.escapeValue(env.value)}"`)
      .join('\n')
  }

  static updateFileContent(
    originalContent: string,
    envVars: EnvironmentVariable[]
  ): string {
    const lines = originalContent.split('\n')
    const processedKeys = new Set<string>()
    const validEnvVars = envVars.filter(
      env => env.isValid && env.key && env.value !== undefined
    )

    const result = lines.map(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const match = trimmed.match(/^export\s+([^=]+)=(.*)$/)
        if (match) {
          const key = match[1].trim()
          const existingVar = validEnvVars.find(env => env.key === key)
          if (existingVar) {
            processedKeys.add(key)
            return `export ${key}="${this.escapeValue(existingVar.value)}"`
          }
        }
      }
      return line
    })

    validEnvVars.forEach(env => {
      if (!processedKeys.has(env.key)) {
        result.push(`export ${env.key}="${this.escapeValue(env.value)}"`)
      }
    })

    return result.join('\n')
  }

  private static unquoteValue(value: string): string {
    return value.replace(/^["']|["']$/g, '')
  }

  private static escapeValue(value: string): string {
    return value.replace(/"/g, '\\"')
  }

  private static validateEnvironmentVariable(
    key: string,
    value: string
  ): boolean {
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

  static detectConfigFiles(): string[] {
    const homedir = require('os').homedir()
    return [
      require('path').join(homedir, '.zshrc'),
      require('path').join(homedir, '.bash_profile'),
      require('path').join(homedir, '.bashrc'),
      require('path').join(homedir, '.profile'),
      '/etc/paths'
    ]
  }

  static async getConfigFileInfo(filePath: string): Promise<ConfigFile> {
    const fs = require('fs').promises
    const path = require('path')

    try {
      const stats = await fs.stat(filePath)
      const content = await fs.readFile(filePath, 'utf-8')
      return {
        path: filePath,
        exists: true,
        content,
        lastModified: stats.mtime
      }
    } catch (error) {
      return {
        path: filePath,
        exists: false,
        content: '',
        lastModified: new Date(0)
      }
    }
  }

  static async getAllConfigFilesInfo(): Promise<ConfigFile[]> {
    const files = this.detectConfigFiles()
    const promises = files.map(file => this.getConfigFileInfo(file))
    return Promise.all(promises)
  }

  static determinePrimaryConfigFile(): string {
    const shell = process.env.SHELL || '/bin/zsh'
    const path = require('path')
    const homedir = require('os').homedir()
    const shellName = path.basename(shell)

    return path.join(homedir, `.${shellName}rc`)
  }
}
