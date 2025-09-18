import { app, BrowserWindow, ipcMain } from 'electron';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
class EnvEditor {
    constructor() {
        this.mainWindow = null;
        this.init();
    }
    init() {
        app.whenReady().then(() => {
            this.createWindow();
            app.on('activate', () => {
                if (BrowserWindow.getAllWindows().length === 0) {
                    this.createWindow();
                }
            });
        });
        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });
    }
    createWindow() {
        this.mainWindow = new BrowserWindow({
            width: 800,
            height: 600,
            title: 'Mac 环境变量编辑器',
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });
        if (process.env.NODE_ENV === 'development') {
            this.mainWindow.loadURL('http://localhost:3000');
            this.mainWindow.webContents.openDevTools();
        }
        else {
            this.mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
        }
        this.setupIPC();
    }
    setupIPC() {
        ipcMain.handle('get-env-vars', this.handleGetEnvVars.bind(this));
        ipcMain.handle('save-env-vars', this.handleSaveEnvVars.bind(this));
        ipcMain.handle('backup-config', this.handleBackupConfig.bind(this));
        ipcMain.handle('get-shell-info', this.handleGetShellInfo.bind(this));
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
            return { success: false, error: error.message };
        }
    }
    async handleSaveEnvVars(event, data) {
        try {
            const homedir = os.homedir();
            const configFile = this.getPrimaryConfigFile();
            await this.handleBackupConfig(null, configFile);
            let content = '';
            if (await this.fileExists(configFile)) {
                content = await fs.promises.readFile(configFile, 'utf-8');
                content = this.updateEnvVars(content, data.env || {});
                content = this.updateAliases(content, data.aliases || {});
            }
            else {
                content = this.generateEnvVarsContent(data.env || {}) + '\n' + this.generateAliasesContent(data.aliases || {});
            }
            await fs.promises.writeFile(configFile, content, 'utf-8');
            return { success: true, message: '环境变量和别名已保存', configFile };
        }
        catch (error) {
            return { success: false, error: error.message };
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
            return { success: false, error: error.message };
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
            return { success: false, error: error.message };
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
        const result = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const match = trimmed.match(/^export\s+([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    if (envVars.hasOwnProperty(key)) {
                        processedKeys.add(key);
                        return `export ${key}="${envVars[key]}"`;
                    }
                }
            }
            return line;
        });
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
        const result = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const match = trimmed.match(/^alias\s+([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    if (aliases.hasOwnProperty(key)) {
                        processedKeys.add(key);
                        return `alias ${key}="${aliases[key]}"`;
                    }
                }
            }
            return line;
        });
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
}
new EnvEditor();
