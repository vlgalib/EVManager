export interface SecurityConfig {
    preventProcessKill: boolean;
    allowedProcesses: string[];
    allowedCommands: string[];
    logViolations: boolean;
}
export declare const defaultSecurityConfig: SecurityConfig;
export declare class SecurityManager {
    private config;
    private originalProcessKill;
    private originalProcessExit;
    private isProtected;
    constructor(config?: SecurityConfig);
    initialize(): void;
    disable(): void;
    private protectProcessMethods;
    private restoreProcessMethods;
    private isKillAllowed;
    private isExitAllowed;
    private logSecurityViolation;
    updateConfig(newConfig: Partial<SecurityConfig>): void;
    getConfig(): SecurityConfig;
    isActive(): boolean;
}
export declare const securityManager: SecurityManager;
//# sourceMappingURL=security.d.ts.map