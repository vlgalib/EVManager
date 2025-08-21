import fs from 'fs';
import path from 'path';
import { SecurityConfig, defaultSecurityConfig } from './security';

export interface AppConfig {
  security: SecurityConfig;
  server: {
    port: number;
    corsOrigin: string;
  };
  processing: {
    maxConcurrent: number;
    batchSize: number;
    retryAttempts: number;
  };
}

const CONFIG_FILE = path.join(__dirname, '../../data/config.json');

export const defaultConfig: AppConfig = {
  security: defaultSecurityConfig,
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

export class ConfigManager {
  private config: AppConfig;

  constructor() {
    this.config = this.loadConfig();
  }

  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        const configData = fs.readFileSync(CONFIG_FILE, 'utf8');
        const loadedConfig = JSON.parse(configData);
        
        // Мержим с дефолтными настройками для совместимости
        return {
          ...defaultConfig,
          ...loadedConfig,
          security: {
            ...defaultConfig.security,
            ...loadedConfig.security
          }
        };
      }
    } catch (error) {
      console.warn('Ошибка при загрузке конфигурации, используются настройки по умолчанию:', error);
    }
    
    return { ...defaultConfig };
  }

  public saveConfig(): void {
    try {
      const dataDir = path.dirname(CONFIG_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.error('Ошибка при сохранении конфигурации:', error);
    }
  }

  public getConfig(): AppConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<AppConfig>): void {
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

  public getSecurityConfig(): SecurityConfig {
    return { ...this.config.security };
  }

  public updateSecurityConfig(securityConfig: Partial<SecurityConfig>): void {
    this.config.security = {
      ...this.config.security,
      ...securityConfig
    };
    this.saveConfig();
  }
}

export const configManager = new ConfigManager();