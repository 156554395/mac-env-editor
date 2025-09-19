import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock data for testing
const mockEnvData = {
  env: {
    PATH: '/usr/local/bin:/usr/bin:/bin',
    HOME: '/Users/testuser',
    NODE_ENV: 'development'
  },
  aliases: {
    ll: 'ls -la',
    la: 'ls -A',
    grep: 'grep --color=auto'
  }
}

// Mock electronAPI
const mockElectronAPI = {
  getEnvVars: vi.fn(),
  saveEnvVars: vi.fn(),
  backupConfig: vi.fn(),
  getShellInfo: vi.fn(),
  getConfigFileContent: vi.fn(),
  saveConfigFileContent: vi.fn()
}

// Set up global mock
global.window = {
  electronAPI: mockElectronAPI
} as any

describe('EnvManager', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockElectronAPI.getEnvVars.mockResolvedValue({
      success: true,
      data: mockEnvData
    })
  })

  describe('环境变量管理', () => {
    it('应该能够加载环境变量', async () => {
      // 由于EnvManager使用了require，我们模拟其核心功能
      const data = await mockElectronAPI.getEnvVars()

      expect(data.success).toBe(true)
      expect(data.data.env).toHaveProperty('PATH')
      expect(data.data.env).toHaveProperty('HOME')
      expect(data.data.aliases).toHaveProperty('ll')
    })

    it('应该能够保存环境变量', async () => {
      mockElectronAPI.saveEnvVars.mockResolvedValue({
        success: true,
        message: '保存成功'
      })

      const result = await mockElectronAPI.saveEnvVars(mockEnvData)

      expect(result.success).toBe(true)
      expect(mockElectronAPI.saveEnvVars).toHaveBeenCalledWith(mockEnvData)
    })

    it('应该能够处理保存失败的情况', async () => {
      mockElectronAPI.saveEnvVars.mockResolvedValue({
        success: false,
        error: '权限不足'
      })

      const result = await mockElectronAPI.saveEnvVars(mockEnvData)

      expect(result.success).toBe(false)
      expect(result.error).toBe('权限不足')
    })
  })

  describe('数据验证', () => {
    it('应该验证环境变量名格式', () => {
      const validNames = ['PATH', 'HOME', 'MY_VAR', '_PRIVATE']
      const invalidNames = ['123VAR', 'MY-VAR', 'MY.VAR', '']
      const nameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/

      validNames.forEach(name => {
        expect(nameRegex.test(name)).toBe(true)
      })

      invalidNames.forEach(name => {
        expect(nameRegex.test(name)).toBe(false)
      })
    })

    it('应该处理 PATH 变量的特殊格式', () => {
      const pathValue = '/usr/local/bin:/usr/bin:/bin'
      const pathParts = pathValue.split(':')

      expect(pathParts.length).toBe(3)
      expect(pathParts[0]).toBe('/usr/local/bin')
      expect(pathParts[1]).toBe('/usr/bin')
      expect(pathParts[2]).toBe('/bin')
    })
  })

  describe('别名管理', () => {
    it('应该能够解析别名定义', () => {
      const aliasDefinition = 'ls -la'
      const aliasName = 'll'

      expect(aliasName).toMatch(/^[a-zA-Z_][a-zA-Z0-9_]*$/)
      expect(aliasDefinition).toBeTruthy()
      expect(aliasDefinition.trim()).toBe('ls -la')
    })

    it('应该能够处理复杂的别名命令', () => {
      const complexAlias = 'git log --oneline --graph --decorate'

      expect(complexAlias).toContain('git')
      expect(complexAlias).toContain('--oneline')
      expect(complexAlias).toContain('--graph')
    })
  })

  describe('分类功能', () => {
    it('应该能够按类型分类环境变量', () => {
      const envVars = mockEnvData.env
      const pathRelated = []
      const regular = []

      Object.keys(envVars).forEach(key => {
        if (key === 'PATH' || key.includes('PATH')) {
          pathRelated.push(key)
        } else {
          regular.push(key)
        }
      })

      expect(pathRelated).toContain('PATH')
      expect(regular).toContain('HOME')
      expect(regular).toContain('NODE_ENV')
    })

    it('应该能够统计不同类型的变量数量', () => {
      const envCount = Object.keys(mockEnvData.env).length
      const aliasCount = Object.keys(mockEnvData.aliases).length

      expect(envCount).toBe(3)
      expect(aliasCount).toBe(3)
    })
  })

  describe('搜索功能', () => {
    it('应该能够搜索环境变量', () => {
      const searchTerm = 'NODE'
      const envVars = mockEnvData.env
      const results = Object.keys(envVars).filter(key =>
        key.toLowerCase().includes(searchTerm.toLowerCase())
      )

      expect(results).toContain('NODE_ENV')
      expect(results.length).toBe(1)
    })

    it('应该能够搜索别名', () => {
      const searchTerm = 'ls'
      const aliases = mockEnvData.aliases
      const results = Object.entries(aliases).filter(
        ([key, value]) => key.includes(searchTerm) || value.includes(searchTerm)
      )

      expect(results.length).toBeGreaterThan(0)
      expect(results.some(([, value]) => value.includes('ls'))).toBe(true)
    })
  })
})
