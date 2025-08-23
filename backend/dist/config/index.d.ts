import { SecurityConfig } from './security';
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
export declare const defaultConfig: AppConfig;
export declare class ConfigManager {
    private config;
    constructor();
    private loadConfig;
    saveConfig(): void;
    getConfig(): AppConfig;
    updateConfig(updates: Partial<AppConfig>): void;
    getSecurityConfig(): SecurityConfig;
    updateSecurityConfig(securityConfig: Partial<SecurityConfig>): void;
}
export declare const configManager: ConfigManager;
//# sourceMappingURL=index.d.ts.map