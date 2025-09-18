import * as path from 'path'
import * as fs from 'fs'
import { promisify } from 'util'

const fsAccess = promisify(fs.access)
const fsCopyFile = promisify(fs.copyFile)
const fsReadFile = promisify(fs.readFile)
const fsWriteFile = promisify(fs.writeFile)
const fsUnlink = promisify(fs.unlink)

export interface SecurityResult {
  success: boolean
  message?: string
  error?: string
  data?: any
}

export class SecurityManager {
  private static instance: SecurityManager
  private backupDir: string
  private logFile: string

  constructor() {
    this.backupDir = path.join(process.env.HOME || '', '.env-editor-backups')
    this.logFile = path.join(this.backupDir, 'operations.log')
    this.ensureBackupDir()
  }

  static getInstance(): SecurityManager {
    if (!SecurityManager.instance) {
      SecurityManager.instance = new SecurityManager()
    }
    return SecurityManager.instance
  }

  private async ensureBackupDir(): Promise<void> {
    try {
      await fsAccess(this.backupDir)
    } catch {
      await fs.promises.mkdir(this.backupDir, { recursive: true })
    }
  }

  async createBackup(configPath: string, content: string): Promise<SecurityResult> {
    try {
      await this.ensureBackupDir()

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
      const configName = path.basename(configPath)
      const backupPath = path.join(this.backupDir, `${configName}.${timestamp}.backup`)

      await fsWriteFile(backupPath, content, 'utf-8')

      await this.logOperation('backup', 'success', `创建备份: ${configPath} -> ${backupPath}`)

      return {
        success: true,
        message: '备份创建成功',
        data: { backupPath, timestamp }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      await this.logOperation('backup', 'failed', `备份失败: ${configPath} - ${errorMessage}`)

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async restoreFromBackup(backupPath: string, configPath: string): Promise<SecurityResult> {
    try {
      if (!await this.fileExists(backupPath)) {
        return {
          success: false,
          error: '备份文件不存在'
        }
      }

      if (await this.fileExists(configPath)) {
        await this.createBackup(configPath, await fsReadFile(configPath, 'utf-8'))
      }

      await fsCopyFile(backupPath, configPath)

      await this.logOperation('restore', 'success', `从备份恢复: ${backupPath} -> ${configPath}`)

      return {
        success: true,
        message: '从备份恢复成功'
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      await this.logOperation('restore', 'failed', `恢复失败: ${backupPath} -> ${configPath} - ${errorMessage}`)

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async listBackups(): Promise<SecurityResult> {
    try {
      await this.ensureBackupDir()

      const files = await fs.promises.readdir(this.backupDir)
      const backups = files
        .filter(file => file.endsWith('.backup'))
        .map(file => {
          const filePath = path.join(this.backupDir, file)
          const stats = fs.statSync(filePath)
          return {
            filename: file,
            path: filePath,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          }
        })
        .sort((a, b) => b.created.getTime() - a.created.getTime())

      return {
        success: true,
        data: backups
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async deleteBackup(backupPath: string): Promise<SecurityResult> {
    try {
      if (!await this.fileExists(backupPath)) {
        return {
          success: false,
          error: '备份文件不存在'
        }
      }

      await fsUnlink(backupPath)

      await this.logOperation('delete_backup', 'success', `删除备份: ${backupPath}`)

      return {
        success: true,
        message: '备份文件删除成功'
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      await this.logOperation('delete_backup', 'failed', `删除备份失败: ${backupPath} - ${errorMessage}`)

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async cleanupOldBackups(daysToKeep: number = 30): Promise<SecurityResult> {
    try {
      await this.ensureBackupDir()

      const cutoffDate = new Date()
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep)

      const files = await fs.promises.readdir(this.backupDir)
      const backupFiles = files.filter(file => file.endsWith('.backup'))

      let deletedCount = 0

      for (const file of backupFiles) {
        const filePath = path.join(this.backupDir, file)
        const stats = fs.statSync(filePath)

        if (stats.mtime < cutoffDate) {
          await fsUnlink(filePath)
          deletedCount++
        }
      }

      await this.logOperation('cleanup', 'success', `清理旧备份: 删除了 ${deletedCount} 个文件`)

      return {
        success: true,
        message: `清理完成，删除了 ${deletedCount} 个旧备份文件`
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      await this.logOperation('cleanup', 'failed', `清理失败: ${errorMessage}`)

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async validateConfigFile(configPath: string, content: string): Promise<SecurityResult> {
    try {
      const issues: string[] = []

      if (content.length > 1024 * 1024) {
        issues.push('配置文件过大 (>1MB)')
      }

      const lines = content.split('\n')
      let exportCount = 0

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim()

        if (line.startsWith('export ')) {
          exportCount++

          const match = line.match(/^export\s+([^=]+)=(.*)$/)
          if (match) {
            const key = match[1].trim()
            const value = match[2].trim()

            if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
              issues.push(`第 ${i + 1} 行: 无效的变量名 '${key}'`)
            }

            if (value.includes('\n')) {
              issues.push(`第 ${i + 1} 行: 变量值包含换行符`)
            }
          }
        }
      }

      if (exportCount > 100) {
        issues.push('环境变量数量过多 (>100)')
      }

      const dangerousPatterns = [
        /rm\s+-rf/,
        /sudo\s+/,
        /sh\s+-c/,
        /eval\s+/,
        /exec\s+/,
        /system\(/,
        /`.*`/,
        /\$\{.*\}/
      ]

      for (const pattern of dangerousPatterns) {
        if (pattern.test(content)) {
          issues.push(`检测到危险的shell命令模式: ${pattern}`)
        }
      }

      const result: SecurityResult = {
        success: issues.length === 0,
        data: {
          issues,
          exportCount,
          totalLines: lines.length,
          fileSize: content.length
        }
      }

      if (issues.length > 0) {
        result.error = `发现 ${issues.length} 个安全或语法问题`
      }

      await this.logOperation('validate', issues.length === 0 ? 'success' : 'warning',
        `验证配置文件: ${configPath} - ${issues.length} 个问题`)

      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      await this.logOperation('validate', 'failed', `验证失败: ${configPath} - ${errorMessage}`)

      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async getOperationLogs(limit: number = 100): Promise<SecurityResult> {
    try {
      await this.ensureBackupDir()

      if (!await this.fileExists(this.logFile)) {
        return {
          success: true,
          data: []
        }
      }

      const content = await fsReadFile(this.logFile, 'utf-8')
      const lines = content.split('\n').filter(line => line.trim())
      const logs = lines.slice(-limit).map(line => {
        try {
          return JSON.parse(line)
        } catch {
          return {
            timestamp: new Date().toISOString(),
            operation: 'unknown',
            status: 'error',
            message: 'Invalid log entry'
          }
        }
      })

      return {
        success: true,
        data: logs.reverse()
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fsAccess(filePath)
      return true
    } catch {
      return false
    }
  }

  private async logOperation(operation: string, status: string, message: string): Promise<void> {
    try {
      await this.ensureBackupDir()

      const logEntry = {
        timestamp: new Date().toISOString(),
        operation,
        status,
        message
      }

      const logLine = JSON.stringify(logEntry) + '\n'

      await fs.promises.appendFile(this.logFile, logLine, 'utf-8')
    } catch (error) {
      console.error('记录操作日志失败:', error)
    }
  }

  async checkFilePermissions(configPath: string): Promise<SecurityResult> {
    try {
      if (!await this.fileExists(configPath)) {
        return {
          success: true,
          message: '文件不存在，将创建新文件'
        }
      }

      const stats = fs.statSync(configPath)
      const issues: string[] = []

      if (stats.mode & 0o002) {
        issues.push('文件对其他用户可写，存在安全风险')
      }

      if (stats.mode & 0o020) {
        issues.push('文件对所属组可写，建议检查权限设置')
      }

      if (stats.uid !== process.getuid?.() ?? 0) {
        issues.push('文件所有者不是当前用户')
      }

      return {
        success: issues.length === 0,
        data: {
          issues,
          mode: stats.mode.toString(8),
          uid: stats.uid,
          gid: stats.gid
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      return {
        success: false,
        error: errorMessage
      }
    }
  }

  async getSecurityReport(): Promise<SecurityResult> {
    try {
      const [backupsResult, logsResult] = await Promise.all([
        this.listBackups(),
        this.getOperationLogs(50)
      ])

      const report = {
        backupsCount: backupsResult.success ? backupsResult.data?.length || 0 : 0,
        recentOperations: logsResult.success ? logsResult.data || [] : [],
        systemInfo: {
          user: process.env.USER,
          home: process.env.HOME,
          shell: process.env.SHELL,
          platform: process.platform
        }
      }

      return {
        success: true,
        data: report
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误'
      return {
        success: false,
        error: errorMessage
      }
    }
  }
}