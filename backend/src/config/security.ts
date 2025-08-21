export interface SecurityConfig {
  preventProcessKill: boolean;
  allowedProcesses: string[];
  allowedCommands: string[];
  logViolations: boolean;
}

export const defaultSecurityConfig: SecurityConfig = {
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

export class SecurityManager {
  private config: SecurityConfig;
  private originalProcessKill: typeof process.kill;
  private originalProcessExit: typeof process.exit;
  private isProtected: boolean = false;
  
  constructor(config: SecurityConfig = defaultSecurityConfig) {
    this.config = config;
    this.originalProcessKill = process.kill.bind(process);
    this.originalProcessExit = process.exit.bind(process);
  }

  public initialize(): void {
    if (!this.config.preventProcessKill || this.isProtected) {
      return;
    }

    this.protectProcessMethods();
    this.isProtected = true;
    console.log('🔒 Process protection activated');
  }

  public disable(): void {
    if (!this.isProtected) {
      return;
    }

    this.restoreProcessMethods();
    this.isProtected = false;
    console.log('🔓 Process protection disabled');
  }

  private protectProcessMethods(): void {
    // Защищаем process.kill
    process.kill = (pid: number, signal?: string | number): true => {
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
    process.exit = (code?: number): never => {
      if (this.isExitAllowed()) {
        return this.originalProcessExit(code);
      }
      
      const errorMsg = `🚫 Node.js process termination attempt blocked by security system`;
      console.error(errorMsg);
      
      if (this.config.logViolations) {
        this.logSecurityViolation('process.exit', { code });
      }
      
      // Вместо завершения процесса просто возвращаемся
      return undefined as never;
    };
  }

  private restoreProcessMethods(): void {
    process.kill = this.originalProcessKill;
    process.exit = this.originalProcessExit;
  }

  private isKillAllowed(pid: number, signal?: string | number): boolean {
    // Разрешаем завершение собственного процесса только с определенными сигналами
    if (pid === process.pid) {
      const allowedSelfSignals = ['SIGTERM', 'SIGINT', 0];
      return allowedSelfSignals.includes(signal as string | number);
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

  private isExitAllowed(): boolean {
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

  private logSecurityViolation(method: string, details: any): void {
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

  public updateConfig(newConfig: Partial<SecurityConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (this.isProtected && !this.config.preventProcessKill) {
      this.disable();
    } else if (!this.isProtected && this.config.preventProcessKill) {
      this.initialize();
    }
  }

  public getConfig(): SecurityConfig {
    return { ...this.config };
  }

  public isActive(): boolean {
    return this.isProtected;
  }
}

// Глобальный экземпляр менеджера безопасности
export const securityManager = new SecurityManager();