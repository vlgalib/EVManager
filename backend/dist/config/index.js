"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.configManager = exports.ConfigManager = exports.defaultConfig = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const security_1 = require("./security");
const CONFIG_FILE = path_1.default.join(__dirname, '../../data/config.json');
exports.defaultConfig = {
    security: security_1.defaultSecurityConfig,
    server: {
        port: 5000,
        corsOrigin: 'http://localhost:5001'
    },
    processing: {
        maxConcurrent: 1,
        batchSize: 1,
        retryAttempts: 3
    }
};
class ConfigManager {
    constructor() {
        this.config = this.loadConfig();
    }
    loadConfig() {
        try {
            if (fs_1.default.existsSync(CONFIG_FILE)) {
                const configData = fs_1.default.readFileSync(CONFIG_FILE, 'utf8');
                const loadedConfig = JSON.parse(configData);
                // Мержим с дефолтными настройками для совместимости
                return {
                    ...exports.defaultConfig,
                    ...loadedConfig,
                    security: {
                        ...exports.defaultConfig.security,
                        ...loadedConfig.security
                    }
                };
            }
        }
        catch (error) {
            console.warn('Ошибка при загрузке конфигурации, используются настройки по умолчанию:', error);
        }
        return { ...exports.defaultConfig };
    }
    saveConfig() {
        try {
            const dataDir = path_1.default.dirname(CONFIG_FILE);
            if (!fs_1.default.existsSync(dataDir)) {
                fs_1.default.mkdirSync(dataDir, { recursive: true });
            }
            fs_1.default.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
        }
        catch (error) {
            console.error('Ошибка при сохранении конфигурации:', error);
        }
    }
    getConfig() {
        return { ...this.config };
    }
    updateConfig(updates) {
        this.config = {
            ...this.config,
            ...updates,
            security: {
                ...this.config.security,
                ...updates.security
            }
        };
        this.saveConfig();
    }
    getSecurityConfig() {
        return { ...this.config.security };
    }
    updateSecurityConfig(securityConfig) {
        this.config.security = {
            ...this.config.security,
            ...securityConfig
        };
        this.saveConfig();
    }
}
exports.ConfigManager = ConfigManager;
exports.configManager = new ConfigManager();
//# sourceMappingURL=index.js.map