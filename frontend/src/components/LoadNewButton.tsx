import React, { useState } from 'react';
import { Download } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNotification } from '../contexts/NotificationContext';
import { apiService } from '../services/api';

const LoadNewButton: React.FC = () => {
  const { t } = useLanguage();
  const { showNotificationWithKey } = useNotification();
  const [isLoading, setIsLoading] = useState(false);

  const handleLoad = async () => {
    if (isLoading) return;
    try {
      setIsLoading(true);
      const res = await apiService.reloadFromFiles();
      
      // Handle bilingual notifications from backend
      if (res?.messageKey) {
        const params = res.count ? { count: res.count } : undefined;
        showNotificationWithKey(res.messageKey, res.message || 'Done', 'success', params);
      } else {
        showNotificationWithKey('notification.filesReloaded', res?.message || 'Done', 'success');
      }
      
      // Wallet pages/aggregates will pick up changes through intervals
    } catch (e) {
      console.error(e);
      showNotificationWithKey('common.error', 'Error loading new wallets/proxies', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <button
      onClick={handleLoad}
      disabled={isLoading}
      className={`flex items-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors h-9 ${
        isLoading ? 'bg-slate-700 text-slate-400 cursor-wait' : 'bg-emerald-600 text-white hover:bg-emerald-700'
      }`}
      title={t('loadNew.title')}
    >
      <Download className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
      <span>{isLoading ? t('loadNew.loading') : t('loadNew.loadNew')}</span>
    </button>
  );
};

export default LoadNewButton;
