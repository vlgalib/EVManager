import axios from 'axios';
import { WalletData, AggregatedData, ServerStatus, FilterOptions } from '../types';

const API_BASE_URL = (import.meta as any).env?.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const apiService = {
  // Получить статус сервера
  getStatus: async (): Promise<ServerStatus> => {
    const response = await api.get('/status');
    return response.data;
  },

  // Получить все кошельки
  getWallets: async (
    sortBy = 'id', 
    sortOrder = 'desc', 
    limit?: number, 
    offset?: number
  ): Promise<{ wallets: WalletData[]; total: number; returned: number }> => {
    const params = new URLSearchParams({
      sortBy,
      sortOrder
    });
    
    if (limit !== undefined) params.append('limit', limit.toString());
    if (offset !== undefined) params.append('offset', offset.toString());
    
    const response = await api.get(`/wallets?${params}`);
    return response.data;
  },

  // Получить агрегированные данные
  getAggregated: async (selectedWallets?: string[]): Promise<AggregatedData> => {
    if (selectedWallets && selectedWallets.length > 0) {
      // POST когда нужно передать список кошельков
      const response = await api.post('/aggregated', { wallets: selectedWallets });
      return response.data;
    } else {
      // GET когда нужны все данные
      const response = await api.get('/aggregated');
      return response.data;
    }
  },

  // Получить статистику
  getStats: async (selectedWallets?: string[]): Promise<any> => {
    const response = await api.post('/stats', {
      selectedWallets
    });
    return response.data;
  },

  // Получить отладочные данные
  getDebugData: async (walletAddress?: string, includeSystemInfo = false): Promise<any> => {
    const response = await api.post('/debug', {
      walletAddress,
      includeSystemInfo
    });
    return response.data;
  },

  // Получить логи
  getLogs: async (level?: string, limit?: number, walletAddress?: string): Promise<any> => {
    const response = await api.post('/logs', {
      level,
      limit,
      walletAddress
    });
    return response.data;
  },

  // Фильтровать кошельки
  filterWallets: async (filters: FilterOptions): Promise<{ wallets: WalletData[]; total: number }> => {
    const response = await api.post('/wallets/filter', filters);
    return response.data;
  },

  // Фильтровать токены по стоимости
  filterTokens: async (filters: FilterOptions, selectedWallets?: string[]): Promise<{ tokens: any[]; total: number }> => {
    const response = await api.post('/tokens/filter', {
      ...filters,
      wallets: selectedWallets
    });
    return response.data;
  },

  // Фильтровать протоколы по стоимости
  filterProtocols: async (filters: FilterOptions, selectedWallets?: string[]): Promise<{ protocols: any[]; total: number }> => {
    const response = await api.post('/protocols/filter', {
      ...filters,
      wallets: selectedWallets
    });
    return response.data;
  },

  // Добавить кошельки
  addWallets: async (addresses: string[]): Promise<any> => {
    const response = await api.post('/wallets/add', { addresses });
    return response.data;
  },

  // Назначить тир одному кошельку
  assignWalletTier: async (address: string, tier: number | null): Promise<any> => {
    const response = await api.post('/wallets/assign-tier', { address, tier });
    return response.data;
  },

  // Очистить данные
  clearData: async (): Promise<any> => {
    const response = await api.delete('/wallets');
    return response.data;
  },

  // Delete specific wallets
  deleteWallets: async (addresses: string[]): Promise<{ message: string; deletedCount: number; remainingCount: number }> => {
    const response = await api.delete('/wallets/delete', {
      data: { addresses }
    });
    return response.data;
  },

  // Очистить логи
  clearLogs: async (walletAddress?: string): Promise<any> => {
    const response = await api.delete('/logs', {
      params: { walletAddress }
    });
    return response.data;
  },

  // Очистить кэш
  clearCache: async (): Promise<any> => {
    const response = await api.delete('/cache');
    return response.data;
  },

  // Экспорт CSV
  exportCSV: async (selectedWallets?: string[], format = 'csv'): Promise<Blob> => {
    const response = await api.post('/export/csv', {
      selectedWallets,
      format
    }, {
      responseType: 'blob'
    });
    return response.data;
  },

  // Переключить режим отладки
  toggleDebugMode: async (enabled: boolean): Promise<any> => {
    const response = await api.post('/debug/mode', { enabled });
    return response.data;
  },

  // Получить кошельки, хранящие конкретный протокол (с пагинацией)
  getProtocolWallets: async (protocolId: string, chain: string, selectedWallets?: string[], offset: number = 0, limit: number = 1000): Promise<any> => {
    const response = await api.get(`/protocols/${protocolId}/wallets`, {
      params: {
        chain,
        selectedWallets: selectedWallets ? JSON.stringify(selectedWallets) : undefined,
        offset,
        limit
      }
    });
    return response.data;
  },

  // Получить кошельки, хранящие конкретный токен (с пагинацией)
  getTokenWallets: async (tokenSymbol: string, chain: string, selectedWallets?: string[], offset: number = 0, limit: number = 1000): Promise<any> => {
    const response = await api.get(`/tokens/${tokenSymbol}/wallets`, {
      params: {
        chain,
        selectedWallets: selectedWallets ? JSON.stringify(selectedWallets) : undefined,
        offset,
        limit
      }
    });
    return response.data;
  },

  // Запустить обработку кошельков
  processWallets: async (): Promise<any> => {
    const response = await api.post('/wallets/process');
    return response.data;
  },

  // Обновить выбранные кошельки
  refreshWallets: async (wallets: string[]): Promise<any> => {
    const response = await api.post('/wallets/refresh', { wallets });
    return response.data;
  },

  // Получить список прокси
  getProxies: async (
    limit?: number, 
    offset?: number, 
    status?: string
  ): Promise<{ proxies: any[]; total: number; returned: number; isChecking: boolean }> => {
    const response = await api.post('/proxies', {
      limit,
      offset,
      status
    });
    return response.data;
  },

  // Проверить прокси
  checkProxies: async (): Promise<any> => {
    const response = await api.post('/proxies/check');
    return response.data;
  },

  // Перечитать wallets.txt и proxy.txt и запустить обработку
  reloadFromFiles: async (): Promise<any> => {
    const response = await api.post('/reload');
    return response.data;
  },

  // Очистить дубликаты в БД
  deduplicateDatabase: async (): Promise<any> => {
    const response = await api.post('/database/deduplicate');
    return response.data;
  },

  // Система безопасности
  security: {
    // Получить статус безопасности
    getStatus: async (): Promise<any> => {
      const response = await api.get('/security/status');
      return response.data;
    },

    // Переключить систему безопасности
    toggle: async (enabled: boolean): Promise<any> => {
      const response = await api.post('/security/toggle', { enabled });
      return response.data;
    },

    // Обновить конфигурацию безопасности
    updateConfig: async (config: any): Promise<any> => {
      const response = await api.put('/security/config', config);
      return response.data;
    }
  }
};

export default apiService; 