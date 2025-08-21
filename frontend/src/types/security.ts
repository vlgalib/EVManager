export interface SecurityConfig {
  preventProcessKill: boolean;
  allowedProcesses: string[];
  allowedCommands: string[];
  logViolations: boolean;
}