import React, { useState, useEffect, useMemo } from 'react';
import { ServerStatus } from '../types';
import { cn } from '../utils/helpers';
import { Clock, Users, Database, HardDrive, X } from 'lucide-react';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';

interface StatusBarProps {
  status: ServerStatus;
}

const StatusBar: React.FC<StatusBarProps> = React.memo(({ status }) => {
  const { selectedWallets, clearSelection } = useWalletSelection();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const [currentTime, setCurrentTime] = useState(Date.now());

  // Update time only when processing to avoid unnecessary re-renders
  useEffect(() => {
    if (!status.isProcessing) {
      return; // Don't run timer when not processing
    }

    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 5000); // Update every 5 seconds instead of every second

    return () => clearInterval(interval);
  }, [status.isProcessing]); // Only restart when processing status changes
  
  const getProgressPercentage = () => {
    if (!status.processingProgress || status.processingProgress.total === 0) return 0;
    return Math.round((status.processingProgress.current / status.processingProgress.total) * 100);
  };

  const timeRemaining = useMemo(() => {
    if (!status.processingProgress?.estimatedFinish || !status.isProcessing) return null;
    
    const finish = new Date(status.processingProgress.estimatedFinish);
    const diff = finish.getTime() - currentTime;
    
    if (diff <= 0) return "finishing...";
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) {
      return `~${minutes}m ${seconds}s`;
    } else {
      return `~${seconds}s`;
    }
  }, [status.processingProgress?.estimatedFinish, currentTime, status.isProcessing]);

  const elapsedTime = useMemo(() => {
    if (!status.processingProgress?.startTime || !status.isProcessing) return null;
    
    const start = new Date(status.processingProgress.startTime);
    const diff = currentTime - start.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }, [status.processingProgress?.startTime, currentTime, status.isProcessing]);

  return (
    <div className={cn(
      "border-b",
      theme === 'dark' 
        ? "bg-slate-800 border-slate-700" 
        : "bg-white border-gray-200"
    )}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2">
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-6">
            {/* Wallet count */}
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300">
{status.walletsCount} {t('status.wallets')}
              </span>
            </div>

            {/* Database status */}
            <div className="flex items-center space-x-2">
              <Database className="w-4 h-4 text-slate-400" />
              <span className="text-slate-300">
{t('status.database')}: {status.walletsInDatabase || 0} {t('status.wallets')} ({status.database?.size || `0 ${t('status.mb')}`})
                {selectedWallets.size > 0 && (
                  <span className="text-blue-400 ml-2 flex items-center space-x-1">
                    <span>• {selectedWallets.size} {t('wallets.selected').toLowerCase()}</span>
                    <button
                      onClick={clearSelection}
                      className="ml-1 p-0.5 rounded text-blue-400 hover:text-red-400 hover:bg-red-900/20 transition-colors"
                      title={t('wallets.deselectAll')}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </span>
            </div>

            {/* Оффлайн режим */}
            {status.offlineMode && (
              <div className="flex items-center space-x-2">
                <HardDrive className="w-4 h-4 text-amber-400" />
                <span className="text-amber-400 font-medium">
Offline Mode
                </span>
              </div>
            )}

            {/* Статус обработки с прогресс-баром */}
            {status.isProcessing && (
              <div className="flex items-center space-x-3">
                <Clock className="w-4 h-4 text-blue-400 animate-pulse" />
                <div className="flex items-center space-x-3">
                  <span className="text-blue-400 font-medium">
{t('status.processing')} {t('status.wallets')}: {status.processingProgress?.current || 0}/{status.processingProgress?.total || 0}
                  </span>
                  
                  {status.processingProgress && (
                    <div className="flex items-center space-x-2">
                      <div className="w-32 h-2 bg-slate-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-400 transition-all duration-300 ease-out"
                          style={{ width: `${getProgressPercentage()}%` }}
                        />
                      </div>
                      <span className="text-blue-300 text-xs">
                        {getProgressPercentage()}%
                      </span>
                    </div>
                  )}
                  
                  {/* Processing time */}
                  <div className="flex items-center space-x-3 text-xs">
                    {elapsedTime && (
                      <span className="text-slate-400">
                        ⏱️ {elapsedTime}
                      </span>
                    )}
                    {timeRemaining && (
                      <span className="text-blue-300">
                        ⏳ {timeRemaining}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

StatusBar.displayName = 'StatusBar';

export default StatusBar; 