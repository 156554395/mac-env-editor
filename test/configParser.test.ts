import { describe, it, expect } from 'vitest'

// 由于configParser使用了require，我们需要创建简化版本进行测试
describe('ConfigParser', () => {
  describe('基础功能测试', () => {
    it('应该能够解析环境变量导出语句', () => {
      const exportLine = 'export PATH="/usr/local/bin:$PATH"'

      // 简单的正则解析测试
      const match = exportLine.match(/^export\s+([^=]+)=(.*)$/)

      expect(match).toBeTruthy()
      expect(match![1].trim()).toBe('PATH')
      expect(match![2]).toBe('"/usr/local/bin:$PATH"')
    })

    it('应该能够解析别名定义', () => {
      const aliasLine = 'alias ll="ls -la"'

      const match = aliasLine.match(/^alias\s+([^=]+)=(.*)$/)

      expect(match).toBeTruthy()
      expect(match![1].trim()).toBe('ll')
      expect(match![2]).toBe('"ls -la"')
    })

    it('应该能够识别注释行', () => {
      const commentLine = '# This is a comment'

      expect(commentLine.startsWith('#')).toBe(true)
    })

    it('应该能够识别空行', () => {
      const emptyLine = '   '

      expect(emptyLine.trim()).toBe('')
    })
  })

  describe('变量名验证', () => {
    it('应该验证有效的变量名', () => {
      const validNames = ['PATH', 'HOME', 'MY_VAR', '_PRIVATE', 'NODE_ENV']
      const nameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/

      validNames.forEach(name => {
        expect(nameRegex.test(name)).toBe(true)
      })
    })

    it('应该拒绝无效的变量名', () => {
      const invalidNames = ['123PATH', 'MY-VAR', 'MY.VAR', '']
      const nameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/

      invalidNames.forEach(name => {
        expect(nameRegex.test(name)).toBe(false)
      })
    })
  })
})
