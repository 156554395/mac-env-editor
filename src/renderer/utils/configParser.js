export class ConfigParser {
    constructor() {
        this.ENV_VAR_REGEX = /^export\s+([^=]+)=(.*)$/;
        this.COMMENT_REGEX = /^\s*#/;
    }
    static parseFileContent(content) {
        const envVars = [];
        const lines = content.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const match = trimmed.match(/^export\s+([^=]+)=(.*)$/);
                if (match) {
                    envVars.push({
                        key: match[1].trim(),
                        value: this.unquoteValue(match[2].trim()),
                        isValid: this.validateEnvironmentVariable(match[1].trim(), match[2].trim())
                    });
                }
            }
        }
        return envVars;
    }
    static generateFileContent(envVars) {
        return envVars
            .filter(env => env.isValid && env.key && env.value !== undefined)
            .map(env => `export ${env.key}="${this.escapeValue(env.value)}"`)
            .join('\n');
    }
    static updateFileContent(originalContent, envVars) {
        const lines = originalContent.split('\n');
        const processedKeys = new Set();
        const validEnvVars = envVars.filter(env => env.isValid && env.key && env.value !== undefined);
        const result = lines.map(line => {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                const match = trimmed.match(/^export\s+([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    const existingVar = validEnvVars.find(env => env.key === key);
                    if (existingVar) {
                        processedKeys.add(key);
                        return `export ${key}="${this.escapeValue(existingVar.value)}"`;
                    }
                }
            }
            return line;
        });
        validEnvVars.forEach(env => {
            if (!processedKeys.has(env.key)) {
                result.push(`export ${env.key}="${this.escapeValue(env.value)}"`);
            }
        });
        return result.join('\n');
    }
    static unquoteValue(value) {
        return value.replace(/^["']|["']$/g, '');
    }
    static escapeValue(value) {
        return value.replace(/"/g, '\\"');
    }
    static validateEnvironmentVariable(key, value) {
        if (!key || typeof key !== 'string') {
            return false;
        }
        const keyRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
        if (!keyRegex.test(key)) {
            return false;
        }
        if (value === undefined) {
            return false;
        }
        return true;
    }
    static detectConfigFiles() {
        const homedir = require('os').homedir();
        return [
            require('path').join(homedir, '.zshrc'),
            require('path').join(homedir, '.bash_profile'),
            require('path').join(homedir, '.bashrc'),
            require('path').join(homedir, '.profile'),
            '/etc/paths'
        ];
    }
    static async getConfigFileInfo(filePath) {
        const fs = require('fs').promises;
        const path = require('path');
        try {
            const stats = await fs.stat(filePath);
            const content = await fs.readFile(filePath, 'utf-8');
            return {
                path: filePath,
                exists: true,
                content,
                lastModified: stats.mtime
            };
        }
        catch (error) {
            return {
                path: filePath,
                exists: false,
                content: '',
                lastModified: new Date(0)
            };
        }
    }
    static async getAllConfigFilesInfo() {
        const files = this.detectConfigFiles();
        const promises = files.map(file => this.getConfigFileInfo(file));
        return Promise.all(promises);
    }
    static determinePrimaryConfigFile() {
        const shell = process.env.SHELL || '/bin/zsh';
        const path = require('path');
        const homedir = require('os').homedir();
        const shellName = path.basename(shell);
        return path.join(homedir, `.${shellName}rc`);
    }
}
