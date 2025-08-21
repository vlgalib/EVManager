import React, { useState, useEffect } from 'react';
import { SecurityConfig } from '../types/security';

interface SecurityStatus {
  isActive: boolean;
  config: SecurityConfig;
  message: string;
}

export const SecuritySettings: React.FC = () => {
  const [securityStatus, setSecurityStatus] = useState<SecurityStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const loadSecurityStatus = async () => {
    try {
      const response = await fetch('/api/security/status');
      const data = await response.json();
      setSecurityStatus(data);
    } catch (err) {
      setError('Ошибка при загрузке статуса безопасности');
      console.error(err);
    }
  };

  const toggleSecurity = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/security/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !securityStatus?.isActive })
      });
      
      const data = await response.json();
      setSecurityStatus(prev => prev ? { ...prev, isActive: data.isActive, message: data.message } : null);
    } catch (err) {
      setError('Ошибка при переключении системы безопасности');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateConfig = async (newConfig: Partial<SecurityConfig>) => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('/api/security/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newConfig)
      });
      
      const data = await response.json();
      setSecurityStatus(prev => prev ? { ...prev, config: data.config } : null);
    } catch (err) {
      setError('Ошибка при обновлении конфигурации');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAllowedProcessChange = (processes: string) => {
    const allowedProcesses = processes.split(',').map(p => p.trim()).filter(p => p);
    updateConfig({ allowedProcesses });
  };

  const handleAllowedCommandsChange = (commands: string) => {
    const allowedCommands = commands.split(',').map(c => c.trim()).filter(c => c);
    updateConfig({ allowedCommands });
  };

  useEffect(() => {
    loadSecurityStatus();
  }, []);

  if (!securityStatus) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Настройки безопасности
        </h3>
        <div className="text-center">Загрузка...</div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Настройки безопасности
      </h3>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      <div className="space-y-6">
        {/* Статус системы безопасности */}
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Защита от завершения процессов
            </label>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {securityStatus.message}
            </p>
          </div>
          <button
            onClick={toggleSecurity}
            disabled={loading}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              securityStatus.isActive ? 'bg-blue-600' : 'bg-gray-200'
            } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform ring-0 transition duration-200 ease-in-out ${
                securityStatus.isActive ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Конфигурация */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Разрешенные процессы
            </label>
            <input
              type="text"
              value={securityStatus.config.allowedProcesses.join(', ')}
              onChange={(e) => handleAllowedProcessChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="node, npm, chrome, ..."
              disabled={loading}
            />
            <p className="mt-1 text-sm text-gray-500">
              Список процессов, которые могут быть завершены (через запятую)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Разрешенные команды
            </label>
            <input
              type="text"
              value={securityStatus.config.allowedCommands.join(', ')}
              onChange={(e) => handleAllowedCommandsChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              placeholder="process.exitCode, child.kill, ..."
              disabled={loading}
            />
            <p className="mt-1 text-sm text-gray-500">
              Список команд, которые могут завершать процессы (через запятую)
            </p>
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="logViolations"
              checked={securityStatus.config.logViolations}
              onChange={(e) => updateConfig({ logViolations: e.target.checked })}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={loading}
            />
            <label htmlFor="logViolations" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
              Логировать нарушения безопасности
            </label>
          </div>
        </div>

        {/* Информация о защите */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                О системе защиты
              </h3>
              <div className="mt-2 text-sm text-blue-700 dark:text-blue-300">
                <p>
                  Система защиты предотвращает случайное или злонамеренное завершение Node.js процессов.
                  Она блокирует вызовы <code>process.exit()</code> и <code>process.kill()</code>, 
                  за исключением разрешенных контекстов.
                </p>
                <p className="mt-2">
                  Дочерние процессы (например, браузер Puppeteer) могут быть завершены в рамках обычной работы приложения.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};