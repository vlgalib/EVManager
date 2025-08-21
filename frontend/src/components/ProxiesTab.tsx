import React, { useState, useEffect } from 'react';
import { Shield, CheckCircle, XCircle, Clock, AlertCircle, RefreshCw, ArrowUpDown } from 'lucide-react';
import { ProxyData, ProxyStatus } from '../types';
import { apiService } from '../services/api';
import { cn } from '../utils/helpers';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

const ProxiesTab: React.FC = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [proxies, setProxies] = useState<ProxyData[]>([]);
  const [sortedProxies, setSortedProxies] = useState<ProxyData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'status' | 'lastChecked' | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  const fetchProxies = async () => {
    try {
      const response = await apiService.getProxies();
      setProxies(response.proxies || []);
      setIsChecking(response.isChecking || false); // Обновляем состояние проверки с сервера
      setError(null);
    } catch (err) {
      setError('Ошибка загрузки прокси');
      console.error('Error fetching proxies:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (field: 'status' | 'lastChecked') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  // Sort proxies whenever sorting parameters change
  useEffect(() => {
    let sorted = [...proxies];
    
    if (sortBy) {
      sorted.sort((a, b) => {
        let aValue: any;
        let bValue: any;
        
        switch (sortBy) {
          case 'status':
            // Define status priority for sorting
            const statusPriority = { 'working': 1, 'checking': 2, 'failed': 3, 'unknown': 4 };
            aValue = statusPriority[a.status] || 4;
            bValue = statusPriority[b.status] || 4;
            break;
          case 'lastChecked':
            aValue = a.lastChecked ? new Date(a.lastChecked).getTime() : 0;
            bValue = b.lastChecked ? new Date(b.lastChecked).getTime() : 0;
            break;
          default:
            return 0;
        }
        
        if (aValue < bValue) return sortOrder === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
    }
    
    setSortedProxies(sorted);
  }, [proxies, sortBy, sortOrder]);

  const checkProxies = async () => {
    try {
      await apiService.checkProxies();
      await fetchProxies(); // Обновить данные после запуска проверки
    } catch (err) {
      setError('Ошибка проверки прокси');
      console.error('Error checking proxies:', err);
    }
  };

  useEffect(() => {
    fetchProxies();
    
    // Auto-refresh: more frequent during checking, less frequent when idle
    const refreshInterval = isChecking ? 3000 : 30000; // 3 seconds during checking, 30 seconds otherwise
    const interval = setInterval(() => {
      fetchProxies();
    }, refreshInterval);
    
    return () => clearInterval(interval);
  }, [isChecking]);

  const getStatusIcon = (status: ProxyStatus) => {
    switch (status) {
      case 'working':
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />;
      case 'checking':
        return <Clock className="w-5 h-5 text-blue-400 animate-pulse" />;
      default:
        return <AlertCircle className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusText = (status: ProxyStatus) => {
    switch (status) {
      case 'working':
        return t('proxies.working');
      case 'failed':
        return t('proxies.failed');
      case 'checking':
        return t('proxies.checking');
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status: ProxyStatus) => {
    switch (status) {
      case 'working':
        return 'text-green-400';
      case 'failed':
        return 'text-red-400';
      case 'checking':
        return 'text-blue-400';
      default:
        return 'text-slate-400';
    }
  };

  const workingProxies = proxies.filter(p => p.status === 'working').length;
  const failedProxies = proxies.filter(p => p.status === 'failed').length;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
            <div className="h-4 bg-slate-700 rounded mb-4 w-1/3"></div>
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-slate-700 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Статистика */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">{t('proxies.total')}</p>
              <p className="text-2xl font-bold text-slate-100">{proxies.length}</p>
            </div>
            <div className="w-12 h-12 bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">{t('proxies.working')}</p>
              <p className="text-2xl font-bold text-green-400">{workingProxies}</p>
            </div>
            <div className="w-12 h-12 bg-green-900/20 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">{t('proxies.failed')}</p>
              <p className="text-2xl font-bold text-red-400">{failedProxies}</p>
            </div>
            <div className="w-12 h-12 bg-red-900/20 rounded-lg flex items-center justify-center">
              <XCircle className="w-6 h-6 text-red-400" />
            </div>
          </div>
        </div>

        <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">{t('proxies.successRate')}</p>
              <p className="text-2xl font-bold text-blue-400">
                {proxies.length > 0 ? Math.round((workingProxies / proxies.length) * 100) : 0}%
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Shield className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Список прокси */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700">
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">
              {t('proxies.title')}
            </h3>
            <button
              onClick={checkProxies}
              disabled={isChecking}
              className={cn(
                "flex items-center space-x-2 px-4 py-2 rounded-lg font-medium text-sm transition-colors",
                isChecking
                  ? "bg-slate-700 text-slate-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
              )}
            >
              <RefreshCw className={cn("w-4 h-4", isChecking && "animate-spin")} />
              <span>{isChecking ? t('proxies.checking') : t('proxies.checkAll')}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="px-6 py-4 bg-red-900/20 border-b border-slate-700">
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                  <button
                    onClick={() => handleSort('status')}
                    className="flex items-center space-x-1 hover:text-slate-300 transition-colors"
                  >
                    <span>{t('proxies.status')}</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('proxies.protocol')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('proxies.address')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('proxies.port')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('proxies.country')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('proxies.responseTime')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                  <button
                    onClick={() => handleSort('lastChecked')}
                    className="flex items-center space-x-1 hover:text-slate-300 transition-colors"
                  >
                    <span>{t('proxies.lastCheck')}</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('proxies.error')}</th>
              </tr>
            </thead>
            <tbody>
              {sortedProxies.map((proxy, index) => (
                <tr key={proxy.id || index} className={cn(
                  "border-b transition-colors",
                  theme === 'dark' 
                    ? "border-slate-700 hover:bg-slate-700/50" 
                    : "border-gray-200 hover:bg-gray-100"
                )}>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      {getStatusIcon(proxy.status)}
                      <span className={cn("text-sm font-medium", getStatusColor(proxy.status))}>
                        {getStatusText(proxy.status)}
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/20 text-blue-400">
                      {proxy.protocol.toUpperCase()}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-mono text-sm text-slate-300">{proxy.host}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-slate-400">{proxy.port}</span>
                  </td>
                  <td className="py-3 px-4">
                    {proxy.country ? (
                      <div className="flex items-center space-x-2">
                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-900/20 text-purple-400">
                          {proxy.country}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-500 text-sm">Checking...</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {proxy.responseTime ? (
                      <span className={cn(
                        "font-mono text-sm",
                        proxy.responseTime < 1000 ? "text-green-400" :
                        proxy.responseTime < 3000 ? "text-yellow-400" :
                        "text-red-400"
                      )}>
                        {proxy.responseTime}{t('proxies.ms')}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {proxy.lastChecked ? (
                      <span className="text-sm text-slate-500">
                        {new Date(proxy.lastChecked).toLocaleString('ru-RU')}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {proxy.errorMessage ? (
                      <span className="text-sm text-red-400 truncate max-w-xs" title={proxy.errorMessageKey ? t(proxy.errorMessageKey) : proxy.errorMessage}>
                        {proxy.errorMessageKey ? t(proxy.errorMessageKey) : proxy.errorMessage}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout */}
        <div className="lg:hidden space-y-3 px-4 py-4">
          {sortedProxies.map((proxy, index) => (
            <div key={proxy.id || index} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
              {/* Proxy Header */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(proxy.status)}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm text-slate-300">{proxy.host}</span>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/20 text-blue-400">
                        {proxy.protocol.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400">Port: {proxy.port}</div>
                  </div>
                </div>
                <span className={cn("text-sm font-medium", getStatusColor(proxy.status))}>
                  {getStatusText(proxy.status)}
                </span>
              </div>

              {/* Proxy Stats */}
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <div className="text-xs text-slate-400 mb-1">{t('proxies.country')}</div>
                  {proxy.country ? (
                    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-900/20 text-purple-400">
                      {proxy.country}
                    </span>
                  ) : (
                    <span className="text-slate-500 text-sm">Checking...</span>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 mb-1">{t('proxies.responseTime')}</div>
                  {proxy.responseTime ? (
                    <span className={cn(
                      "font-mono text-sm",
                      proxy.responseTime < 1000 ? "text-green-400" :
                      proxy.responseTime < 3000 ? "text-yellow-400" :
                      "text-red-400"
                    )}>
                      {proxy.responseTime}{t('proxies.ms')}
                    </span>
                  ) : (
                    <span className="text-slate-500">-</span>
                  )}
                </div>
              </div>

              {/* Last Check and Error */}
              <div className="pt-3 border-t border-slate-600">
                <div className="flex items-center justify-between text-sm">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">{t('proxies.lastCheck')}</div>
                    {proxy.lastChecked ? (
                      <span className="text-slate-500">
                        {new Date(proxy.lastChecked).toLocaleString('ru-RU')}
                      </span>
                    ) : (
                      <span className="text-slate-500">-</span>
                    )}
                  </div>
                  {proxy.errorMessage && (
                    <div className="text-right max-w-[50%]">
                      <div className="text-xs text-slate-400 mb-1">{t('proxies.error')}</div>
                      <span className="text-xs text-red-400 truncate block" title={proxy.errorMessageKey ? t(proxy.errorMessageKey) : proxy.errorMessage}>
                        {proxy.errorMessageKey ? t(proxy.errorMessageKey) : proxy.errorMessage}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {proxies.length === 0 && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Shield className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">{t('proxies.notFound')}</h3>
            <p className="text-slate-400">{t('proxies.addToFile')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProxiesTab;