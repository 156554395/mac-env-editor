import { app, BrowserWindow, ipcMain, shell, Tray, Menu } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
class EnvEditor {
    constructor() {
        this.mainWindow = null;
        this.ipcSetup = false; // 标记IPC是否已经设置
        this.tray = null;
        this.isQuitting = false; // 标记应用是否正在退出
        this.init();
        this.setupIPC(); // 在构造函数中设置IPC，只执行一次
    }
    init() {
        app.whenReady().then(() => {
            this.createTray();
            this.createWindow();
            app.on('activate', () => {
                if (BrowserWindow.getAllWindows().length === 0) {
                    this.createWindow();
                }
                else {
                    this.mainWindow?.show();
                    // 显示程序坞图标
                    if (app.dock) {
                        app.dock.show();
                    }
                }
            });
        });
        app.on('window-all-closed', () => {
            // 在非macOS平台下，关闭所有窗口时退出应用
            // 在macOS下，即使窗口关闭，应用也继续运行在托盘中
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });
        // 添加before-quit事件处理，确保用户可以完全退出应用
        app.on('before-quit', () => {
            // 设置标记，表示应用正在退出，防止窗口关闭事件阻止退出
            this.isQuitting = true;
        });
    }
    createTray() {
        const { nativeImage } = require('electron');
        // 使用提供的图标文件
        let trayIcon;
        console.log('托盘图标路径查找:');
        // 根据环境确定路径查找策略
        const isPackaged = app.isPackaged;
        console.log(`应用是否已打包: ${isPackaged}`);
        let iconPaths = [];
        if (isPackaged) {
            // 生产环境：electron-builder 自动复制图标到 Resources 目录
            iconPaths = [
                // 优先使用 PNG 格式图标（更好的兼容性）
                path.join(process.resourcesPath, 'icon.png'),
                // 备用 ICNS 格式图标
                path.join(process.resourcesPath, 'icon.icns')
            ];
        }
        else {
            // 开发环境
            iconPaths = [
                path.join(process.cwd(), 'src/assets/icon.png'),
                path.join(__dirname, '../src/assets/icon.png'),
                path.join(__dirname, '../../src/assets/icon.png'),
                path.join(process.cwd(), 'build/Icon.icns'),
                path.join(__dirname, '../build/Icon.icns'),
                path.join(__dirname, '../../build/Icon.icns')
            ];
        }
        // 无论开发还是生产环境，都记录所有尝试的路径
        console.log(`准备尝试 ${iconPaths.length} 个图标路径`);
        console.log(`图标路径列表: ${JSON.stringify(iconPaths, null, 2)}`);
        for (const iconPath of iconPaths) {
            console.log(`尝试路径: ${iconPath}`);
            try {
                if (fs.existsSync(iconPath)) {
                    console.log(`✓ 找到图标文件: ${iconPath}`);
                    trayIcon = nativeImage.createFromPath(iconPath);
                    console.log(`图标对象创建状态: isEmpty=${trayIcon.isEmpty()}, size=${JSON.stringify(trayIcon.getSize())}`);
                    if (!trayIcon.isEmpty()) {
                        // 调整图标大小并设置为模板图像
                        trayIcon = trayIcon.resize({ width: 18, height: 18 });
                        trayIcon.setTemplateImage(true); // 设置为模板图像，适配系统主题
                        console.log('✓ 成功创建并调整托盘图标');
                        break;
                    }
                    else {
                        console.log('✗ 图标对象为空，继续尝试下一个路径');
                    }
                }
                else {
                    console.log(`✗ 文件不存在: ${iconPath}`);
                }
            }
            catch (error) {
                console.log(`✗ 加载失败: ${iconPath} - ${error}`);
                continue;
            }
        }
        // 如果找不到图标文件，使用系统默认图标
        if (!trayIcon || trayIcon.isEmpty()) {
            // 使用系统内置的图标，而不是自绘图标
            trayIcon = nativeImage.createEmpty();
            console.warn('应用图标未找到，将使用系统默认图标');
        }
        else {
            console.log('✓ 成功加载托盘图标');
        }
        this.tray = new Tray(trayIcon);
        // 设置托盘菜单
        const contextMenu = Menu.buildFromTemplate([
            {
                label: '显示应用',
                click: () => {
                    this.showWindow();
                }
            },
            {
                label: '隐藏应用',
                click: () => {
                    this.hideWindow();
                }
            },
            { type: 'separator' },
            {
                label: '退出',
                click: () => {
                    app.quit();
                }
            }
        ]);
        this.tray.setContextMenu(contextMenu);
        this.tray.setToolTip('Mac 环境变量编辑器');
        // 点击托盘图标显示窗口
        this.tray.on('click', () => {
            console.log(`Tray click - Window exists: ${!!this.mainWindow}, isDestroyed: ${this.mainWindow?.isDestroyed()}, isVisible: ${this.mainWindow?.isVisible()}`);
            this.showWindow();
        });
    }
    showWindow() {
        if (this.mainWindow) {
            this.mainWindow.show();
            this.mainWindow.focus();
            // 显示程序坞图标
            if (app.dock) {
                app.dock.show();
            }
        }
        else {
            this.createWindow();
        }
    }
    hideWindow() {
        if (this.mainWindow) {
            this.mainWindow.hide();
        }
    }
    createWindow() {
        // 设置应用图标
        const { nativeImage } = require('electron');
        let appIcon = null;
        // 尝试加载现有图标文件，开发环境和生产环境
        const iconPaths = [
            // 开发环境路径 - 优先使用PNG格式
            path.join(process.cwd(), 'src/assets/icon.png'),
            path.join(__dirname, '../src/assets/icon.png'),
            path.join(__dirname, '../../src/assets/icon.png'),
            // 开发环境 - ICNS格式
            path.join(process.cwd(), 'build/Icon.icns'),
            path.join(__dirname, '../build/Icon.icns'),
            path.join(__dirname, '../../build/Icon.icns'),
            // 生产环境路径
            path.join(process.resourcesPath, 'build/Icon.icns'),
            path.join(app.getAppPath(), 'build/Icon.icns')
        ];
        console.log('主窗口图标路径查找:');
        for (const iconPath of iconPaths) {
            console.log(`尝试路径: ${iconPath}`);
            try {
                if (fs.existsSync(iconPath)) {
                    console.log(`✓ 找到图标文件: ${iconPath}`);
                    appIcon = nativeImage.createFromPath(iconPath);
                    console.log(`主窗口图标对象创建状态: isEmpty=${appIcon.isEmpty()}, size=${appIcon.getSize()}`);
                    if (!appIcon.isEmpty()) {
                        console.log('✓ 成功创建主窗口图标');
                        break;
                    }
                    else {
                        console.log('✗ 主窗口图标对象为空，继续尝试下一个路径');
                    }
                }
                else {
                    console.log(`✗ 文件不存在: ${iconPath}`);
                }
            }
            catch (error) {
                console.log(`✗ 加载失败: ${iconPath} - ${error}`);
                continue;
            }
        }
        const windowOptions = {
            width: 1200,
            height: 800,
            minWidth: 1000,
            minHeight: 700,
            center: true,
            show: false, // 先不显示，等准备好再显示
            skipTaskbar: false, // 确保在任务栏显示
            title: 'Mac 环境变量编辑器',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            }
        };
        // 如果成功加载图标，则设置图标
        if (appIcon && !appIcon.isEmpty()) {
            windowOptions.icon = appIcon;
            console.log('✓ 成功设置主窗口图标');
        }
        else {
            console.log('✗ 主窗口图标未设置，使用系统默认');
        }
        this.mainWindow = new BrowserWindow(windowOptions);
        // 窗口准备好后显示并获得焦点
        this.mainWindow.once('ready-to-show', () => {
            this.mainWindow?.show();
            this.mainWindow?.focus();
            // 在 macOS 上强制应用到前台并显示程序坞图标
            if (process.platform === 'darwin') {
                app.focus({ steal: true });
                if (app.dock) {
                    app.dock.show();
                }
            }
        });
        // 处理窗口关闭事件 - 隐藏到托盘而不是退出
        this.mainWindow.on('close', (event) => {
            if (process.platform === 'darwin' && !this.isQuitting) {
                event.preventDefault();
                this.hideWindow();
                // 隐藏程序坞图标，但保持应用运行和托盘图标显示
                if (app.dock) {
                    app.dock.hide();
                }
                return false;
            }
        });
        // 开发环境使用dev server
        if (process.env.NODE_ENV === 'development') {
            this.mainWindow.loadURL('http://localhost:3000');
            this.mainWindow.webContents.openDevTools();
        }
        else {
            // 生产环境加载构建后的文件
            if (app.isPackaged) {
                // 打包后的路径，主进程在/dist/main.js，所以__dirname是/dist
                this.mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));
            }
            else {
                // 开发构建时的路径
                this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
            }
        }
    }
    setupIPC() {
        // 避免重复注册IPC处理器
        if (this.ipcSetup) {
            return;
        }
        this.ipcSetup = true;
        ipcMain.handle('get-env-vars', this.handleGetEnvVars.bind(this));
        ipcMain.handle('save-env-vars', this.handleSaveEnvVars.bind(this));
        ipcMain.handle('backup-config', this.handleBackupConfig.bind(this));
        ipcMain.handle('get-shell-info', this.handleGetShellInfo.bind(this));
        ipcMain.handle('get-config-file-content', this.handleGetConfigFileContent.bind(this));
        ipcMain.handle('save-config-file-content', this.handleSaveConfigFileContent.bind(this));
        ipcMain.handle('open-external', this.handleOpenExternal.bind(this));
    }
    async handleGetEnvVars() {
        try {
            const homedir = os.homedir();
            const configFiles = [
                path.join(homedir, '.zshrc'),
                path.join(homedir, '.bash_profile'),
                path.join(homedir, '.bashrc'),
                path.join(homedir, '.profile')
            ];
            const envVars = {};
            const aliases = {};
            for (const configFile of configFiles) {
                if (await this.fileExists(configFile)) {
                    const content = await fs.promises.readFile(configFile, 'utf-8');
                    this.parseEnvVars(content, envVars);
                    this.parseAliases(content, aliases);
                }
            }
            const result = {
                env: envVars,
                aliases: aliases
            };
            return { success: true, data: result };
        }
        catch (error) {
            return { success: false, error: error?.message || String(error) };
        }
    }
    async handleSaveEnvVars(event, data) {
        try {
            const configFile = this.getPrimaryConfigFile();
            await this.handleBackupConfig(null, configFile);
            let content = '';
            if (await this.fileExists(configFile)) {
                content = await fs.promises.readFile(configFile, 'utf-8');
                content = this.updateEnvVars(content, data.env || {});
                content = this.updateAliases(content, data.aliases || {});
            }
            else {
                content =
                    this.generateEnvVarsContent(data.env || {}) +
                        '\n' +
                        this.generateAliasesContent(data.aliases || {});
            }
            await fs.promises.writeFile(configFile, content, 'utf-8');
            return { success: true, message: '环境变量和别名已保存', configFile };
        }
        catch (error) {
            return { success: false, error: error?.message || String(error) };
        }
    }
    async handleBackupConfig(event, configFile) {
        try {
            const targetPath = configFile || this.getPrimaryConfigFile();
            const backupPath = `${targetPath}.backup.${Date.now()}`;
            if (await this.fileExists(targetPath)) {
                await fs.promises.copyFile(targetPath, backupPath);
                return { success: true, backupPath };
            }
            else {
                return { success: false, message: '配置文件不存在' };
            }
        }
        catch (error) {
            return { success: false, error: error?.message || String(error) };
        }
    }
    async handleGetShellInfo() {
        try {
            const defaultShell = process.env.SHELL || '/bin/zsh';
            const shellName = path.basename(defaultShell);
            return {
                success: true,
                data: {
                    defaultShell,
                    shellName,
                    configPath: path.join(os.homedir(), `.${shellName}rc`),
                    activeConfig: this.getPrimaryConfigFile()
                }
            };
        }
        catch (error) {
            return { success: false, error: error?.message || String(error) };
        }
    }
    async handleGetConfigFileContent(event, configFile) {
        try {
            const targetPath = configFile || this.getPrimaryConfigFile();
            if (await this.fileExists(targetPath)) {
                const content = await fs.promises.readFile(targetPath, 'utf-8');
                return {
                    success: true,
                    data: {
                        content,
                        filePath: targetPath,
                        fileName: path.basename(targetPath)
                    }
                };
            }
            else {
                return {
                    success: true,
                    data: {
                        content: '',
                        filePath: targetPath,
                        fileName: path.basename(targetPath)
                    }
                };
            }
        }
        catch (error) {
            return { success: false, error: error?.message || String(error) };
        }
    }
    async handleSaveConfigFileContent(event, data) {
        try {
            const targetPath = data.filePath || this.getPrimaryConfigFile();
            // 创建备份
            await this.handleBackupConfig(null, targetPath);
            // 保存新内容
            await fs.promises.writeFile(targetPath, data.content, 'utf-8');
            return {
                success: true,
                message: '配置文件已保存',
                filePath: targetPath
            };
        }
        catch (error) {
            return { success: false, error: error?.message || String(error) };
        }
    }
    async fileExists(filePath) {
        try {
            await fs.promises.access(filePath);
            return true;
        }
        catch {
            return false;
        }
    }
    parseEnvVars(content, envVars) {
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const match = trimmed.match(/^export\s+([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^["']|["']$/g, '');
                    envVars[key] = value;
                }
            }
        }
    }
    updateEnvVars(content, envVars) {
        const lines = content.split('\n');
        const processedKeys = new Set();
        // 第一步：更新或删除现有的 export 行
        const result = lines
            .map(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const match = trimmed.match(/^export\s+([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    if (envVars.hasOwnProperty(key)) {
                        // 更新现有变量
                        processedKeys.add(key);
                        return `export ${key}="${envVars[key]}"`;
                    }
                    else {
                        // 删除不在新数据中的变量（返回空字符串）
                        return '';
                    }
                }
            }
            return line;
        })
            .filter(line => line !== ''); // 过滤掉空行（被删除的变量）
        // 第二步：添加新变量
        for (const [key, value] of Object.entries(envVars)) {
            if (!processedKeys.has(key)) {
                result.push(`export ${key}="${value}"`);
            }
        }
        return result.join('\n');
    }
    generateEnvVarsContent(envVars) {
        return Object.entries(envVars)
            .map(([key, value]) => `export ${key}="${value}"`)
            .join('\n');
    }
    parseAliases(content, aliases) {
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                // 匹配 alias name='command' 或 alias name="command" 或 alias name=command
                const match = trimmed.match(/^alias\s+([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const value = match[2].trim().replace(/^["']|["']$/g, '');
                    aliases[key] = value;
                }
            }
        }
    }
    updateAliases(content, aliases) {
        const lines = content.split('\n');
        const processedKeys = new Set();
        // 第一步：更新或删除现有的 alias 行
        const result = lines
            .map(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const match = trimmed.match(/^alias\s+([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    if (aliases.hasOwnProperty(key)) {
                        // 更新现有别名
                        processedKeys.add(key);
                        return `alias ${key}="${aliases[key]}"`;
                    }
                    else {
                        // 删除不在新数据中的别名（返回空字符串）
                        return '';
                    }
                }
            }
            return line;
        })
            .filter(line => line !== ''); // 过滤掉空行（被删除的别名）
        // 第二步：添加新别名
        for (const [key, value] of Object.entries(aliases)) {
            if (!processedKeys.has(key)) {
                result.push(`alias ${key}="${value}"`);
            }
        }
        return result.join('\n');
    }
    generateAliasesContent(aliases) {
        return Object.entries(aliases)
            .map(([key, value]) => `alias ${key}="${value}"`)
            .join('\n');
    }
    getPrimaryConfigFile() {
        const shell = process.env.SHELL || '/bin/zsh';
        const shellName = path.basename(shell);
        return path.join(os.homedir(), `.${shellName}rc`);
    }
    async handleOpenExternal(event, url) {
        try {
            await shell.openExternal(url);
        }
        catch (error) {
            console.error('Failed to open external URL:', error);
            throw error;
        }
    }
}
new EnvEditor();
