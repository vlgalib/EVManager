import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';
import { apiService } from '../services/api';

const RefreshButton: React.FC = () => {
  const { selectedWallets, tempSelectedWallets, saveChanges } = useWalletSelection();
  const { showNotification } = useNotification();
  const { t } = useLanguage();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isServerBusy, setIsServerBusy] = useState(false);

  useEffect(() => {
    let mounted = true;
    const check = async () => {
      try {
        const status = await apiService.getStatus();
        if (!mounted) return;
        setIsServerBusy(!!status?.isProcessing);
      } catch {
        // ignore
      }
    };
    check();
    const id = setInterval(check, 3000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  const handleRefresh = async () => {
    const walletsToRefresh = tempSelectedWallets.size > 0 ? tempSelectedWallets : selectedWallets;

    if (walletsToRefresh.size === 0) {
      showNotification(t('notification.noWalletsSelected'), 'error');
      return;
    }

    if (isRefreshing) return;
    if (isServerBusy) {
      showNotification(t('notification.serverBusy'), 'error');
      return;
    }

    try {
      // Проверяем, не запущена ли уже обработка на сервере
      const status = await apiService.getStatus();
      if (status?.isProcessing) {
        showNotification(t('notification.serverBusy'), 'error');
        return;
      }

      // Сохраняем текущие выборы в основное состояние перед началом обработки
      if (tempSelectedWallets.size > 0) {
        saveChanges();
      }

      setIsRefreshing(true);
      const walletsArray = Array.from(walletsToRefresh);
      console.log('RefreshButton: API call with wallets:', walletsArray);
      const response = await apiService.refreshWallets(walletsArray);
      console.log('RefreshButton: API response:', response);
      
      // Show notification that processing has started
      showNotification(
        t('notification.refreshStarted').replace('{count}', walletsArray.length.toString()), 
        'info', 
        true, 
        10000
      );
    } catch (error) {
      console.error('Error refreshing wallets:', error);
      // Try to show server message
      const anyErr: any = error as any;
      const serverMsg = anyErr?.response?.data?.error || anyErr?.message || 'Unknown error';
      showNotification(t('notification.refreshError').replace('{error}', serverMsg), 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <div className="flex items-center space-x-3">
      <button
        onClick={handleRefresh}
        disabled={isRefreshing || isServerBusy || (tempSelectedWallets.size === 0 && selectedWallets.size === 0)}
        className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors h-9 ${
          (tempSelectedWallets.size === 0 && selectedWallets.size === 0)
            ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-slate-600 dark:text-slate-400'
            : isRefreshing
              ? 'bg-yellow-500 text-white cursor-wait dark:bg-yellow-600 dark:text-white'
              : isServerBusy
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-slate-600 dark:text-slate-400'
                : 'bg-blue-500 text-white hover:bg-blue-600 dark:bg-blue-600 dark:text-white dark:hover:bg-blue-700'
        }`}
        title={(tempSelectedWallets.size === 0 && selectedWallets.size === 0)
          ? t('refresh.selectWallets')
          : isServerBusy
            ? t('refresh.serverBusy')
            : t('refresh.updateSelected').replace('{count}', (tempSelectedWallets.size || selectedWallets.size).toString())}
      >
        <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
        <span>{isRefreshing ? t('refresh.updating') : isServerBusy ? t('refresh.busy') : t('refresh.update')}</span>
      </button>
    </div>
  );
};

export default RefreshButton;