import React, { useState } from 'react';
import { X, Users, AlertTriangle } from 'lucide-react';
import { apiService } from '../services/api';
import { useNotification } from '../contexts/NotificationContext';
import { useLanguage } from '../contexts/LanguageContext';

interface TierAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TierAssignmentModal: React.FC<TierAssignmentModalProps> = ({ isOpen, onClose }) => {
  const { showNotification, showNotificationWithKey } = useNotification();
  const { t } = useLanguage();
  const [isProcessing, setIsProcessing] = useState(false);
  const [tierRanges, setTierRanges] = useState({
    tier1: { from: 0, to: 0 },
    tier2: { from: 0, to: 0 },
    tier3: { from: 0, to: 0 }
  });

  const handleRangeChange = (tier: 'tier1' | 'tier2' | 'tier3', field: 'from' | 'to', value: string) => {
    const numValue = parseInt(value) || 0;
    setTierRanges(prev => ({
      ...prev,
      [tier]: {
        ...prev[tier],
        [field]: numValue
      }
    }));
  };

  const validateRanges = () => {
    const ranges = Object.values(tierRanges);
    
    // Проверяем что from <= to для каждого тира
    for (const range of ranges) {
      if (range.from > range.to) {
        return t('tiers.validationFromTo');
      }
    }
    
    // Проверяем пересечения диапазонов
    const allRanges = [
      { name: t('tiers.tier1'), ...tierRanges.tier1 },
      { name: t('tiers.tier2'), ...tierRanges.tier2 },
      { name: t('tiers.tier3'), ...tierRanges.tier3 }
    ].sort((a, b) => a.from - b.from);
    
    for (let i = 0; i < allRanges.length - 1; i++) {
      if (allRanges[i].to >= allRanges[i + 1].from) {
        return t('tiers.validationOverlap', { tier1: allRanges[i].name, tier2: allRanges[i + 1].name });
      }
    }
    
    return null;
  };

  const handleAssignTiers = async () => {
    const validationError = validateRanges();
    if (validationError) {
      showNotification(validationError, 'error');
      return;
    }

    setIsProcessing(true);
    
    try {
      const response = await fetch('/api/assign-tiers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(tierRanges)
      });

      if (!response.ok) {
        throw new Error(t('tiers.errorAssigning'));
      }

      const result = await response.json();
      
      // Handle bilingual notifications from backend
      if (result.messageKey) {
        const params = result.count ? { count: result.count } : undefined;
        showNotificationWithKey(result.messageKey, result.message || t('tiers.successMessage', { count: result.updated }), 'success', params);
      } else {
        showNotification(t('tiers.successMessage', { count: result.updated }), 'success');
      }
      
      onClose();
    } catch (error) {
      console.error('Ошибка назначения тиров:', error);
      showNotification(t('tiers.errorAssigning'), 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl max-w-md w-full border border-slate-200 dark:border-slate-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              {t('tiers.title')}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                {t('tiers.description')}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Tier 1 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                🥇 {t('tiers.tier1')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder={t('tiers.from')}
                  value={tierRanges.tier1.from}
                  onChange={(e) => handleRangeChange('tier1', 'from', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-slate-500 dark:text-slate-400">—</span>
                <input
                  type="number"
                  placeholder={t('tiers.to')}
                  value={tierRanges.tier1.to}
                  onChange={(e) => handleRangeChange('tier1', 'to', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Tier 2 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                🥈 {t('tiers.tier2')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder={t('tiers.from')}
                  value={tierRanges.tier2.from}
                  onChange={(e) => handleRangeChange('tier2', 'from', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-slate-500 dark:text-slate-400">—</span>
                <input
                  type="number"
                  placeholder={t('tiers.to')}
                  value={tierRanges.tier2.to}
                  onChange={(e) => handleRangeChange('tier2', 'to', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Tier 3 */}
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                🥉 {t('tiers.tier3')}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder={t('tiers.from')}
                  value={tierRanges.tier3.from}
                  onChange={(e) => handleRangeChange('tier3', 'from', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-slate-500 dark:text-slate-400">—</span>
                <input
                  type="number"
                  placeholder={t('tiers.to')}
                  value={tierRanges.tier3.to}
                  onChange={(e) => handleRangeChange('tier3', 'to', e.target.value)}
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {t('tiers.cancel')}
          </button>
          <button
            onClick={handleAssignTiers}
            disabled={isProcessing}
            className="px-4 py-2 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                {t('tiers.applying')}
              </>
            ) : (
              t('tiers.apply')
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default TierAssignmentModal;