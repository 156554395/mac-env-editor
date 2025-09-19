import { vi } from 'vitest'

// Mock Electron APIs
const mockElectronAPI = {
  getEnvVars: vi.fn(),
  saveEnvVars: vi.fn(),
  backupConfig: vi.fn(),
  getShellInfo: vi.fn(),
  getConfigFileContent: vi.fn(),
  saveConfigFileContent: vi.fn()
}

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: mockElectronAPI,
  writable: true
})

// Mock console methods for tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn()
}