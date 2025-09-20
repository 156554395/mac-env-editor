# 分发说明

## 用户安装指南

当用户在其他 Mac 电脑上安装应用时，可能会遇到"应用已损坏，无法打开"的错误。这是 macOS Gatekeeper 安全机制的正常行为。

### 解决方案

#### 方法一：右键打开（推荐）
1. 按住 `Control` 键，点击应用图标
2. 选择"打开"
3. 在弹出的对话框中点击"打开"
4. 应用将被标记为安全，后续可正常启动

#### 方法二：系统设置
1. 打开"系统设置" > "隐私与安全性"
2. 在"安全性"部分找到应用相关提示
3. 点击"仍要打开"

#### 方法三：终端命令
```bash
# 移除应用的隔离属性
sudo xattr -rd com.apple.quarantine "/Applications/Env Editor.app"
```

## 开发者构建说明

### 构建分发版本
```bash
pnpm run build:dist
```

### 配置说明
- 已启用 `hardenedRuntime` 增强安全性
- 设置 `identity: null` 使用 ad-hoc 签名
- 配置了必要的 entitlements 权限
- Gatekeeper 评估已禁用以减少警告

### 未来改进
要彻底解决安装警告，需要：
1. 获得 Apple Developer ID 证书
2. 配置代码签名
3. 可选：配置公证（notarization）

这需要 Apple Developer 账户（年费 $99 USD）。