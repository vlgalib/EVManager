"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityManager = exports.SecurityManager = exports.defaultSecurityConfig = void 0;
exports.defaultSecurityConfig = {
    preventProcessKill: true,
    allowedProcesses: [
        'node',
        'npm',
        'chrome',
        'chromium',
        'evmanager',
        'ts-node',
        'nodemon'
    ],
    allowedCommands: [
        'process.exitCode',
        'child.kill', // для дочерних процессов puppeteer
        'browser.close', // закрытие браузера
        'page.close'
    ],
    logViolations: true
};
class SecurityManager {
    constructor(config = exports.defaultSecurityConfig) {
        this.isProtected = false;
        this.config = config;
        this.originalProcessKill = process.kill.bind(process);
        this.originalProcessExit = process.exit.bind(process);
    }
    initialize() {
        if (!this.config.preventProcessKill || this.isProtected) {
            return;
        }
        this.protectProcessMethods();
        this.isProtected = true;
        console.log('🔒 Process protection activated');
    }
    disable() {
        if (!this.isProtected) {
            return;
        }
        this.restoreProcessMethods();
        this.isProtected = false;
        console.log('🔓 Process protection disabled');
    }
    protectProcessMethods() {
        // Защищаем process.kill
        process.kill = (pid, signal) => {
            if (this.isKillAllowed(pid, signal)) {
                return this.originalProcessKill(pid, signal);
            }
            const errorMsg = `🚫 Process termination attempt for ${pid} blocked by security system`;
            console.error(errorMsg);
            if (this.config.logViolations) {
                this.logSecurityViolation('process.kill', { pid, signal });
            }
            throw new Error(`Process kill blocked by security system: ${pid}`);
        };
        // Защищаем process.exit
        process.exit = (code) => {
            if (this.isExitAllowed()) {
                return this.originalProcessExit(code);
            }
            const errorMsg = `🚫 Node.js process termination attempt blocked by security system`;
            console.error(errorMsg);
            if (this.config.logViolations) {
                this.logSecurityViolation('process.exit', { code });
            }
            // Вместо завершения процесса просто возвращаемся
            return undefined;
        };
    }
    restoreProcessMethods() {
        process.kill = this.originalProcessKill;
        process.exit = this.originalProcessExit;
    }
    isKillAllowed(pid, signal) {
        // Разрешаем завершение собственного процесса только с определенными сигналами
        if (pid === process.pid) {
            const allowedSelfSignals = ['SIGTERM', 'SIGINT', 0];
            return allowedSelfSignals.includes(signal);
        }
        // Разрешаем завершение дочерних процессов (например, браузера Puppeteer)
        const stackTrace = new Error().stack || '';
        const isFromPuppeteer = stackTrace.includes('puppeteer') ||
            stackTrace.includes('@puppeteer') ||
            stackTrace.includes('launch.js');
        if (isFromPuppeteer) {
            return true;
        }
        // Проверяем другие разрешенные команды
        for (const allowedCmd of this.config.allowedCommands) {
            if (stackTrace.includes(allowedCmd)) {
                return true;
            }
        }
        return false;
    }
    isExitAllowed() {
        // Анализируем стек вызовов
        const stackTrace = new Error().stack || '';
        // Разрешаем выход только в определенных случаях
        const allowedExitContexts = [
            'process.on(\'SIGTERM\'',
            'process.on(\'SIGINT\'',
            'process.on(\'uncaughtException\'',
            'process.on(\'unhandledRejection\'',
            'graceful-shutdown'
        ];
        return allowedExitContexts.some(context => stackTrace.includes(context));
    }
    logSecurityViolation(method, details) {
        const violation = {
            timestamp: new Date().toISOString(),
            method,
            details,
            stack: new Error().stack,
            pid: process.pid,
            processTitle: process.title
        };
        console.warn('🔐 Security violation:', violation);
    }
    updateConfig(newConfig) {
        this.config = { ...this.config, ...newConfig };
        if (this.isProtected && !this.config.preventProcessKill) {
            this.disable();
        }
        else if (!this.isProtected && this.config.preventProcessKill) {
            this.initialize();
        }
    }
    getConfig() {
        return { ...this.config };
    }
    isActive() {
        return this.isProtected;
    }
}
exports.SecurityManager = SecurityManager;
// Глобальный экземпляр менеджера безопасности
exports.securityManager = new SecurityManager();
//# sourceMappingURL=security.js.map