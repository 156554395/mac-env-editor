# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 常用命令

### 开发模式

```bash
pnpm run dev          # 同时启动主进程和渲染进程开发服务器
pnpm run dev:main     # 仅启动主进程开发
pnpm run dev:renderer # 仅启动渲染进程开发服务器 (端口 3000)
```

### 构建命令

```bash
pnpm run build        # 完整构建：类型检查 + 构建渲染进程 + 打包 Electron 应用
pnpm run build:main   # 仅构建主进程 TypeScript
pnpm run build:renderer # 仅构建渲染进程
```

### 依赖管理

```bash
pnpm install         # 安装所有依赖
```

## 项目架构

这是一个基于 Electron + Vue 3 的 Mac 环境变量编辑器应用，采用主进程-渲染进程架构。

### 核心架构

#### 主进程 (Electron Main)

- **入口文件**: `src/main/main.ts` - 包含 `EnvEditor` 类，负责文件操作和 IPC 通信
- **预加载脚本**: `src/main/preload.ts` - 暴露安全的 IPC 接口到渲染进程
- **主要职责**:
  - 环境配置文件读写 (.zshrc, .bash_profile, .bashrc, .profile)
  - 自动备份机制
  - Shell 信息检测和管理
  - IPC 消息处理
  - **源码编辑**: 完整配置文件内容的读取和保存

#### 渲染进程 (Vue 3)

- **入口**: `src/renderer/src/main.ts` - Vue 应用初始化
- **主组件**: `src/renderer/src/App.vue` - 主要的用户界面
- **工具模块**:
  - `src/renderer/utils/configParser.ts` - 配置文件解析和生成
  - `src/renderer/utils/envManager.ts` - 环境变量管理 (单例模式)
  - `src/renderer/utils/securityManager.ts` - 安全验证和备份管理

#### 类型定义

- **统一类型**: `src/types/index.ts` - 定义所有核心接口
- **渲染进程类型**: `src/renderer/src/types.ts` - 前端特定类型

### 关键设计模式

#### 1. 单例模式

- `EnvManager` 与 `SecurityManager` 使用单例模式确保全局唯一实例
- 提供统一的接口管理环境变量和安全操作

#### 2. 工厂模式

- `ConfigParser` 提供静态方法处理不同类型的配置文件解析
- 支持多种 Shell 配置格式 (zsh, bash, profile)

#### 3. IPC 通信架构

- 主进程提供 6 个核心 IPC 处理器:
  - `get-env-vars` - 读取环境变量
  - `save-env-vars` - 保存环境变量
  - `backup-config` - 创建备份
  - `get-shell-info` - 获取 Shell 信息
  - `get-config-file-content` - 读取完整配置文件内容（源码编辑）
  - `save-config-file-content` - 保存完整配置文件内容（源码编辑）

### 安全特性

#### 自动备份系统

- 每次修改前自动创建时间戳备份
- 备份存储在 `~/.env-editor-backups/` 目录
- 支持备份恢复和定期清理

#### 文件权限检查

- 检测文件所有权和权限设置
- 警告不安全的权限配置
- 防止恶意文件修改

#### 内容安全验证

- 检测危险的 shell 命令模式
- 验证环境变量语法格式
- 文件大小和内容长度限制

### 配置文件支持

应用支持以下配置文件，按优先级自动检测：

- `~/.zshrc` - Z Shell 配置文件
- `~/.bash_profile` - Bash 配置文件
- `~/.bashrc` - Bash 运行时配置文件
- `~/.profile` - 通用配置文件
- `/etc/paths` - 系统 PATH 配置文件

### TypeScript 配置

项目使用 TypeScript 严格模式，配置文件 `tsconfig.json`:

- 目标: ES2020
- 模块系统: ESNext
- 路径别名: `@/*` 指向 `src/*`
- 严格类型检查启用

### 构建系统

#### 开发环境配置

- **Vite** 管理渲染进程开发服务器 (端口 3000)
- **Electron Builder** 进行主进程开发构建
- **Concurrently** 同时运行多个开发进程

#### 构建流程

1. 类型检查 (`vue-tsc`)
2. 渲染进程构建 (`vite build`)
3. 主进程 TypeScript 编译
4. Electron 应用打包 (`electron-builder`)

### 开发注意事项

#### 文件操作安全

- 所有文件操作都需要错误处理和权限验证
- 修改配置文件前必须先创建备份
- 使用 `SecurityManager` 进行文件权限检查

#### 环境变量验证

- 变量名必须符合正则表达式: `/^[a-zA-Z_][a-zA-Z0-9_]*$/`
- 变量值需要适当的引号转义处理
- 支持 PATH 变量的特殊处理

#### IPC 通信规范

- 所有 IPC 调用返回统一格式: `{ success: boolean, data?: any, error?: string }`
- 使用 preload 脚本暴露安全的 IPC 接口
- 渲染进程通过 `window.electronAPI` 访问主进程功能

#### 其它说明

- src/下的js文件动态生成，修改时不用去修改，只修改src/下的ts文件即可
