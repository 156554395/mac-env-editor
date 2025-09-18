# 贡献指南

感谢您对 Mac 环境变量编辑器项目的关注！我们欢迎所有形式的贡献，包括但不限于：

- 🐛 错误报告
- 💡 功能建议
- 📖 文档改进
- 🔧 代码贡献
- 🎨 界面优化

## 开发环境搭建

### 前置要求

- macOS 10.14 或更高版本
- Node.js 18+
- pnpm (推荐) 或 npm

### 安装步骤

1. **Fork 仓库**
   ```bash
   # 点击 GitHub 页面右上角的 Fork 按钮
   ```

2. **克隆你的 fork**
   ```bash
   git clone https://github.com/156554395/mac-env-editor.git
   cd mac-env-editor
   ```

3. **安装依赖**
   ```bash
   pnpm install
   ```

4. **启动开发服务器**
   ```bash
   pnpm run dev
   ```

## 开发工作流程

### 分支策略

- `main` - 主分支，包含稳定的代码
- `develop` - 开发分支，新功能的集成分支
- `feature/*` - 功能分支，开发新功能
- `bugfix/*` - 修复分支，修复已知问题
- `hotfix/*` - 热修复分支，紧急修复

### 提交流程

1. **创建功能分支**
   ```bash
   git checkout -b feature/你的功能名称
   ```

2. **进行开发**
   - 遵循代码规范
   - 编写清晰的提交信息
   - 保持提交粒度适中

3. **提交代码**
   ```bash
   git add .
   git commit -m "feat: 添加新功能描述"
   ```

4. **推送分支**
   ```bash
   git push origin feature/你的功能名称
   ```

5. **创建 Pull Request**
   - 在 GitHub 上创建 PR
   - 填写详细的 PR 描述
   - 等待代码审查

## 代码规范

### TypeScript 规范

- 使用严格模式
- 为所有函数和变量提供类型注解
- 优先使用 interface 而不是 type
- 避免使用 `any` 类型

### Vue 3 规范

- 使用 Composition API
- 组件名使用 PascalCase
- Props 和 Events 需要明确定义类型
- 使用 `<script setup>` 语法

### 代码风格

- 使用 ES 模块语法 (import/export)
- 优先使用解构赋值
- 使用 2 空格缩进
- 行尾不留空格
- 文件末尾保留一个空行

### 提交信息规范

使用 [Conventional Commits](https://www.conventionalcommits.org/) 规范：

```
<类型>[可选的作用域]: <描述>

[可选的正文]

[可选的脚注]
```

**类型包括：**
- `feat`: 新功能
- `fix`: 修复问题
- `docs`: 文档更新
- `style`: 代码格式调整
- `refactor`: 重构代码
- `test`: 测试相关
- `chore`: 构建工具或辅助工具的变动

**示例：**
```
feat: 添加环境变量批量导入功能

- 支持从 JSON 文件导入环境变量
- 添加导入预览界面
- 增加格式验证功能

Closes #123
```

## 项目架构

### 目录结构

```
mac-env-editor/
├── src/
│   ├── main/           # Electron 主进程
│   │   ├── main.ts     # 主进程入口
│   │   └── preload.ts  # 预加载脚本
│   ├── renderer/       # Vue.js 渲染进程
│   │   ├── src/        # Vue 应用源码
│   │   └── utils/      # 工具模块
│   └── types/          # TypeScript 类型定义
├── dist/               # 构建输出
└── docs/               # 项目文档
```

### 核心模块

- **主进程 (main.ts)**: 文件操作、IPC 通信、安全管理
- **渲染进程 (App.vue)**: 用户界面、状态管理、用户交互
- **类型定义 (types/)**: 统一的 TypeScript 接口

## 测试指南

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行单个测试文件
pnpm test -- 文件名

# 测试覆盖率
pnpm test:coverage
```

### 测试规范

- 为新功能编写相应的测试
- 测试文件命名为 `*.test.ts` 或 `*.spec.ts`
- 保持测试的独立性和可重复性
- 优先编写关键功能的集成测试

## 安全注意事项

### 文件操作安全

- 所有文件操作需要权限检查
- 修改配置文件前必须创建备份
- 验证用户输入防止路径遍历攻击

### 环境变量安全

- 验证变量名格式：`/^[a-zA-Z_][a-zA-Z0-9_]*$/`
- 检测危险的 shell 命令模式
- 限制文件大小和内容长度

## 报告问题

### Bug 报告

请使用 [Issue 模板](https://github.com/156554395/mac-env-editor/issues/new?template=bug_report.md) 报告问题，包括：

- **环境信息**: macOS 版本、Node.js 版本、应用版本
- **重现步骤**: 详细的操作步骤
- **期望行为**: 你期望发生什么
- **实际行为**: 实际发生了什么
- **截图**: 如果适用，请提供截图

### 功能请求

使用 [功能请求模板](https://github.com/156554395/mac-env-editor/issues/new?template=feature_request.md)，包括：

- **功能描述**: 详细描述所需功能
- **使用场景**: 解释为什么需要这个功能
- **替代方案**: 是否考虑过其他解决方案

## 发布流程

### 版本号规范

遵循 [语义化版本](https://semver.org/lang/zh-CN/) 规范：
- `MAJOR.MINOR.PATCH`
- 主版本号：不兼容的 API 修改
- 次版本号：向下兼容的功能性新增
- 修订号：向下兼容的问题修正

### 发布步骤

1. 更新版本号和变更日志
2. 创建发布分支
3. 运行完整测试套件
4. 构建生产版本
5. 创建 Git 标签
6. 发布到 GitHub Releases

## 社区准则

### 行为守则

我们承诺为每个人提供友善、安全和欢迎的环境，无论：
- 性别、性别认同和表达
- 性取向
- 残疾
- 身体外观
- 种族
- 年龄
- 宗教或政治观点

### 交流方式

- 使用友善和包容的语言
- 尊重不同的观点和经验
- 优雅地接受建设性批评
- 关注什么对社区最有利
- 对其他社区成员表示同理心

## 获得帮助

- 📖 查看 [项目文档](README.md)
- 💬 提交 [GitHub Issues](https://github.com/156554395/mac-env-editor/issues)
- 📧 发送邮件到维护者

## 致谢

感谢所有为这个项目做出贡献的开发者！你们的参与让这个项目变得更好。

---

再次感谢您的贡献！🎉