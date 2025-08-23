import React, { useState, useEffect, useRef } from 'react';
import { ArrowUpDown, ExternalLink, Copy, Eye, Search, X, Trash2 } from 'lucide-react';
import { WalletData, ServerStatus } from '../types';
import { apiService } from '../services/api';
import { formatCurrency, formatAddress, getTimeAgo, cn } from '../utils/helpers';
import { getChainDisplayName } from '../data/chainLogos';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

interface WalletsTabProps {
  status: ServerStatus | null;
  forceRefresh?: number;
}

const WalletsTab: React.FC<WalletsTabProps> = ({ status, forceRefresh }) => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [displayedWallets, setDisplayedWallets] = useState<WalletData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState('id');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [minValue, setMinValue] = useState<number>(() => {
    const saved = localStorage.getItem('minWalletValue');
    return saved ? parseFloat(saved) : 0.5;
  });
  const [activeTier, setActiveTier] = useState<'all' | 'tier1' | 'tier2' | 'tier3' | 'no-tier'>(() => (localStorage.getItem('activeTier') as any) || 'all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Пагинация
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [totalWallets, setTotalWallets] = useState(0);
  const [loadingPage, setLoadingPage] = useState(false);
  
  const { selectedWallets, tempSelectedWallets, selectAll, deselectAll, toggleWallet, isWalletSelected, saveChanges, discardChanges, hasUnsavedChanges } = useWalletSelection();
  
  // Для множественного выбора с Shift
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  
  // For deletion confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Функция для обработки клика с поддержкой Shift
  const handleWalletToggle = (walletAddress: string, currentIndex: number, event: React.MouseEvent) => {
    if (event.shiftKey && lastSelectedIndex !== null) {
      // Выбираем диапазон
      const startIndex = Math.min(lastSelectedIndex, currentIndex);
      const endIndex = Math.max(lastSelectedIndex, currentIndex);
      const walletsToToggle = displayedWallets.slice(startIndex, endIndex + 1);
      
      // Определяем действие (выбрать или отменить) на основе последнего выбранного
      const shouldSelect = !isWalletSelected(displayedWallets[lastSelectedIndex].address);
      
      walletsToToggle.forEach(wallet => {
        if (shouldSelect && !isWalletSelected(wallet.address)) {
          toggleWallet(wallet.address);
        } else if (!shouldSelect && isWalletSelected(wallet.address)) {
          toggleWallet(wallet.address);
        }
      });
    } else {
      // Обычный клик
      toggleWallet(walletAddress);
    }
    
    setLastSelectedIndex(currentIndex);
  };
  
  // Note: tierWallets state removed - now using database tiers from wallet.tier field


  // Загрузка всех кошельков для правильной фильтрации
  const fetchWallets = async (resetData: boolean = false) => {
    setIsLoading(true);
    
    try {
      // Загружаем все кошельки без пагинации для правильной фильтрации
      const response = await apiService.getWallets(sortBy, sortOrder);
      
      setWallets(response.wallets);
      setTotalWallets(response.total || response.wallets.length);
      
      // Автовыбор только при самой первой загрузке страницы и отсутствии сохранённых данных
      const savedSelected = localStorage.getItem('selectedWallets');
      const savedTier = localStorage.getItem('activeTier');
      
      if (!savedSelected && response.wallets.length > 0 && resetData && !savedTier) {
        // Для первой загрузки выбираем все кошельки только если нет сохраненного тира
        const allAddresses = response.wallets.map(w => w.address);
        selectAll(allAddresses);
      }
      
      setError(null);
    } catch (err) {
      setError(t('status.walletsLoadError'));
      console.error('Error fetching wallets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Первичная загрузка только один раз при монтировании компонента
  useEffect(() => {
    fetchWallets(true); // Только при первой загрузке делаем автовыбор
  }, []);

  useEffect(() => {
    // При смене сортировки загружаем все кошельки без автовыбора
    if (wallets.length > 0) { // Только если уже есть кошельки (не первая загрузка)
      fetchWallets(false);
    }
    setCurrentPage(1);
  }, [sortBy, sortOrder]);

  // Track processing completion via global status from App.tsx
  const prevProcessingStatus = useRef<boolean | null>(null);
  const prevProcessedCount = useRef<number>(0);
  
  useEffect(() => {
    if (!status) return;
    
    const currentProcessing = status.isProcessing;
    const currentProcessedCount = status.processedWalletsCount || 0;
    
    // Update wallets only on significant changes:
    // 1. Processing just completed
    // 2. Processed significant number of new wallets (more than 20)
    if (prevProcessingStatus.current === true && !currentProcessing) {
      // Processing completed
      console.log('WalletsTab: Processing completed, refreshing wallets');
      fetchWallets(false);
    } else if (currentProcessing && Math.abs(currentProcessedCount - prevProcessedCount.current) >= 20) {
      // Processed many new wallets
      console.log(`WalletsTab: Processed ${currentProcessedCount - prevProcessedCount.current} new wallets, refreshing`);
      fetchWallets(false);
      prevProcessedCount.current = currentProcessedCount;
    }
    
    prevProcessingStatus.current = currentProcessing;
  }, [status?.isProcessing, status?.processedWalletsCount]);

  // Принудительное обновление кошельков (например, после назначения тиров)
  useEffect(() => {
    if (forceRefresh && forceRefresh > 0) {
      console.log('WalletsTab: Force refreshing wallets due to external trigger');
      fetchWallets(false); // Без автовыбора при принудительном обновлении
    }
  }, [forceRefresh]);

  useEffect(() => {
    let list = [...wallets];
    
    // Фильтр по поиску (полный адрес кошелька)
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      list = list.filter(w => 
        w.address.toLowerCase().includes(searchLower) ||
        w.id.toString().includes(searchTerm)
      );
    }
    
    if (minValue > 0) {
      list = list.filter(w => w.totalValue && w.totalValue >= minValue);
    }
    
    if (activeTier !== 'all') {
      if (activeTier === 'no-tier') {
        // Показываем кошельки, которые НЕ имеют назначенного тира в базе данных
        list = list.filter(w => !w.tier || w.tier === null || w.tier === undefined);
      } else {
        // Фильтруем по тиру из базы данных
        const tierNumber = activeTier === 'tier1' ? 1 : activeTier === 'tier2' ? 2 : 3;
        list = list.filter(w => w.tier === tierNumber);
      }
    }
    
    // Обновляем общее количество после фильтрации
    setTotalWallets(list.length);
    
    // Применяем клиентскую пагинацию для отображения
    const startIndex = (currentPage - 1) * pageSize;
    const paginatedList = list.slice(startIndex, startIndex + pageSize);
    
    setDisplayedWallets(paginatedList);
  }, [wallets, minValue, activeTier, searchTerm, currentPage, pageSize]);

  // Сбрасываем на первую страницу при изменении фильтров
  useEffect(() => {
    setCurrentPage(1);
  }, [minValue, activeTier, searchTerm]);



  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const handleCopyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
  };

  const handleViewWallet = (address: string) => {
    window.open(`https://debank.com/profile/${address}`, '_blank');
  };

  const handleDeleteWallets = async () => {
    if (tempSelectedWallets.size === 0) return;

    setIsDeleting(true);
    try {
      const addressesToDelete = Array.from(tempSelectedWallets);
      const result = await apiService.deleteWallets(addressesToDelete);
      
      // Clear selection
      deselectAll();
      setShowDeleteConfirm(false);
      
      // Reload wallets
      await fetchWallets();
      
      // Show success message (you can add toast notification here)
      console.log(`Successfully deleted ${result.deletedCount} wallets`);
      
    } catch (error) {
      console.error('Error deleting wallets:', error);
      // Show error message (you can add toast notification here)
    } finally {
      setIsDeleting(false);
    }
  };





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

  if (error) {
    return (
      <div className="bg-slate-800 rounded-xl p-8 shadow-sm border border-slate-700">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Eye className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">{t('status.walletsLoadError')}</h3>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Результаты */}
      <div className="bg-slate-800 rounded-xl shadow-sm border border-slate-700">
        <div className="px-6 py-4 border-b border-slate-700">
          {/* Заголовок */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-slate-100 flex items-center gap-2">
                {t('wallets.title')} ({displayedWallets.length}/{totalWallets}) - {t('wallets.selected')}: {tempSelectedWallets.size}
                {tempSelectedWallets.size > 0 && (
                  <button
                    onClick={deselectAll}
                    className="ml-1 p-1 text-red-400 hover:text-red-300 transition-colors"
                    title={t('wallets.deselectAll')}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
                {loadingPage && (
                  <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                )}
              </h3>
              <div className="text-sm text-slate-400">
                {t('wallets.total')}: {totalWallets} | {t('wallets.page')}: {currentPage} {t('wallets.of')} {Math.ceil(totalWallets / pageSize)}
              </div>
            </div>
            {hasUnsavedChanges && (
              <div className="flex gap-2">
                <button
                  onClick={discardChanges}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={tempSelectedWallets.size === 0}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete ({tempSelectedWallets.size})
                </button>
                <button
                  onClick={saveChanges}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  {t('common.save')}
                </button>
              </div>
            )}
          </div>

          {/* Фильтры и управление */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
            {/* Поиск - левая колонка */}
            <div className="flex items-center gap-2">
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-8 py-2 border border-slate-600 bg-slate-700 rounded-lg text-slate-300 placeholder-slate-400 focus:ring-blue-500 focus:border-blue-500 text-sm"
                  placeholder={t('wallets.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Тиры - центральная колонка */}
            <div className="flex flex-col gap-2 items-center">
              <div className={cn(
                "flex items-center gap-1 rounded-lg p-1",
                theme === 'dark' ? "bg-slate-700" : "bg-gray-200"
              )}>
                {[
                  { id: 'all', label: t('wallets.all') },
                  { id: 'tier1', label: t('wallets.tier1') },
                  { id: 'tier2', label: t('wallets.tier2') },
                  { id: 'tier3', label: t('wallets.tier3') },
                  { id: 'no-tier', label: t('wallets.noTier') },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setActiveTier(t.id as any); localStorage.setItem('activeTier', t.id); }}
                    className={cn(
                      "px-3 py-1 rounded-md text-sm transition-colors",
                      (activeTier === t.id)
                        ? 'bg-blue-600 text-white'
                        : theme === 'dark'
                          ? 'text-slate-300 hover:text-white'
                          : 'text-gray-600 hover:text-gray-900'
                    )}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              
              {/* Минимальное значение фильтра ПОД тирами */}
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <label>Min $</label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={minValue}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    setMinValue(value);
                    localStorage.setItem('minWalletValue', value.toString());
                  }}
                  className={cn(
                    "w-20 px-2 py-1 text-xs border rounded focus:ring-blue-500 focus:border-blue-500",
                    theme === 'dark' 
                      ? "border-slate-600 bg-slate-700 text-slate-200" 
                      : "border-gray-300 bg-white text-gray-900"
                  )}
                  placeholder="0.5"
                />
              </div>
            </div>

            {/* Управление - правая колонка */}
            <div className="flex items-center justify-end gap-2">
              {/* Массовое добавление выбранных в Tier */}
              <div className="relative group">
                <button className={cn(
                  "px-3 py-2 rounded-md text-sm transition-colors",
                  theme === 'dark' 
                    ? "bg-slate-700 text-slate-200 hover:bg-slate-600" 
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                )}>
                  В Tier ▾
                </button>
                <div className={cn(
                  "absolute right-0 mt-1 hidden group-hover:block border rounded-md shadow-lg z-10 min-w-[160px]",
                  theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
                )}>
                  {(['tier1','tier2','tier3'] as const).map(tier => (
                    <button
                      key={tier}
                      onClick={async () => {
                        try {
                          const addresses = Array.from(tempSelectedWallets.size > 0 ? tempSelectedWallets : selectedWallets);
                          const tierNumber = tier === 'tier1' ? 1 : tier === 'tier2' ? 2 : 3;
                          
                          // Assign tier to all selected wallets
                          await Promise.all(
                            addresses.map(address => apiService.assignWalletTier(address, tierNumber))
                          );
                          
                          // Refresh wallet data to show updated tiers
                          await fetchWallets(false);
                        } catch (error) {
                          console.error('Error assigning tier to multiple wallets:', error);
                        }
                      }}
                      className={cn(
                        "block w-full text-left px-3 py-1 text-sm",
                        theme === 'dark' 
                          ? "text-slate-300 hover:bg-slate-700" 
                          : "text-gray-700 hover:bg-gray-100"
                      )}
                    >
                      {tier === 'tier1' ? t('wallets.addToTier1') : tier === 'tier2' ? t('wallets.addToTier2') : t('wallets.addToTier3')}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-800">
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                  <button
                    onClick={() => handleSort('id')}
                    className="flex items-center space-x-1 hover:text-slate-300 transition-colors"
                  >
                    <span>{t('wallets.id')}</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('wallets.address')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                  <button
                    onClick={() => handleSort('totalValue')}
                    className="flex items-center space-x-1 hover:text-slate-300 transition-colors"
                  >
                    <span>{t('wallets.balance')}</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('wallets.chains')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('wallets.tokens')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('wallets.protocols')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                  <button
                    onClick={() => handleSort('protocolsValue')}
                    className="flex items-center space-x-1 hover:text-slate-300 transition-colors"
                  >
                    <span>{t('wallets.inProtocols')}</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">
                  <button
                    onClick={() => handleSort('lastUpdated')}
                    className="flex items-center space-x-1 hover:text-slate-300 transition-colors"
                  >
                    <span>{t('wallets.updated')}</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-400">
                  <input
                    type="checkbox"
                    className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                    checked={false}
                    ref={(checkbox) => {
                      if (checkbox) {
                        const selectedCount = displayedWallets.filter(w => tempSelectedWallets.has(w.address)).length;
                        const totalCount = displayedWallets.length;
                        
                        if (selectedCount === 0) {
                          checkbox.checked = false;
                          checkbox.indeterminate = false;
                        } else if (selectedCount === totalCount && totalCount > 0) {
                          checkbox.checked = true;
                          checkbox.indeterminate = false;
                        } else if (selectedCount > 0) {
                          checkbox.checked = false;
                          checkbox.indeterminate = true;
                        }
                      }
                    }}
                    onChange={() => {
                      // Проверяем все ли отображаемые кошельки выбраны
                      const allDisplayedSelected = displayedWallets.length > 0 && displayedWallets.every(w => tempSelectedWallets.has(w.address));
                      
                      if (allDisplayedSelected) {
                        // Если все выбраны - снимаем выбор только с отображаемых кошельков
                        const displayedAddresses = displayedWallets.map(w => w.address);
                        const newSelection = new Set(tempSelectedWallets);
                        displayedAddresses.forEach(address => {
                          newSelection.delete(address);
                        });
                        selectAll(Array.from(newSelection));
                      } else {
                        // Если не все выбраны - добавляем всех отображаемых к уже выбранным
                        const displayedAddresses = displayedWallets.map(w => w.address);
                        const newSelection = new Set(tempSelectedWallets);
                        displayedAddresses.forEach(address => {
                          newSelection.add(address);
                        });
                        selectAll(Array.from(newSelection));
                      }
                    }}
                    title={displayedWallets.length > 0 && displayedWallets.every(w => tempSelectedWallets.has(w.address)) 
                      ? t('wallets.deselectAllVisible') 
                      : t('wallets.selectAllVisible')
                    }
                  />
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">{t('wallets.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {displayedWallets.map((wallet, index) => (
                <tr key={wallet.id} className={cn(
                  "border-b transition-colors",
                  theme === 'dark' 
                    ? "border-slate-700 hover:bg-slate-700/50" 
                    : "border-gray-200 hover:bg-gray-50"
                )}>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-slate-400">{wallet.id}</span>
                      {wallet.tier && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/20 text-blue-400">
                          T{wallet.tier}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm text-slate-100">{formatAddress(wallet.address)}</span>
                      <button
                        onClick={() => handleCopyAddress(wallet.address)}
                        className="text-slate-400 hover:text-slate-300 transition-colors"
                        title={t('wallets.copyAddress')}
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => window.open(`https://debank.com/profile/${wallet.address}`, '_blank')}
                        className="text-slate-400 hover:text-slate-300 transition-colors"
                        title={t('wallets.openInDeBank')}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-slate-100">{formatCurrency(wallet.totalValue)}</span>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {wallet.chains.slice(0, 3).map((chain, chainIndex) => (
                        <span
                          key={chainIndex}
                          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-900/20 text-blue-400"
                        >
                          {getChainDisplayName(chain.name)}
                        </span>
                      ))}
                      {wallet.chains.length > 3 && (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-400">
                          +{wallet.chains.length - 3}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-slate-400">{wallet.tokens.length}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-slate-400">{wallet.protocols.length}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-medium text-slate-100">
                      {formatCurrency(wallet.protocols.reduce((sum, protocol) => sum + protocol.value, 0))}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-sm text-slate-500">{getTimeAgo(wallet.lastUpdated)}</span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                      checked={isWalletSelected(wallet.address)}
                      onChange={(e) => handleWalletToggle(wallet.address, index, e)}
                      title={t('wallets.includeInCalculations')}
                    />
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="relative group">
                        <button className={cn(
                          "transition-colors",
                          theme === 'dark' 
                            ? "text-slate-400 hover:text-white" 
                            : "text-gray-600 hover:text-gray-900"
                        )}>Tier ▾</button>
                        <div className={cn(
                          "absolute right-0 mt-1 hidden group-hover:block rounded-md shadow-lg z-10",
                          theme === 'dark' 
                            ? "bg-slate-800 border border-slate-700" 
                            : "bg-white border border-gray-200"
                        )}>
                          {(['tier1','tier2','tier3'] as const).map(tier => (
                            <button
                              key={tier}
                              onClick={async () => {
                                try {
                                  const tierNumber = tier === 'tier1' ? 1 : tier === 'tier2' ? 2 : 3;
                                  await apiService.assignWalletTier(wallet.address, tierNumber);
                                  // Refresh wallet data to show updated tier
                                  fetchWallets(false);
                                } catch (error) {
                                  console.error('Error assigning tier:', error);
                                }
                              }}
                              className={cn(
                                "block w-full text-left px-3 py-1 text-sm transition-colors",
                                theme === 'dark' ? "hover:bg-slate-700" : "hover:bg-gray-100",
                                (tier === 'tier1' && wallet.tier === 1) ||
                                (tier === 'tier2' && wallet.tier === 2) ||
                                (tier === 'tier3' && wallet.tier === 3)
                                  ? 'text-blue-500'
                                  : (theme === 'dark' ? 'text-slate-300' : 'text-gray-700')
                              )}
                            >
                              {tier === 'tier1' ? t('wallets.addToTier1') : tier === 'tier2' ? t('wallets.addToTier2') : t('wallets.addToTier3')}
                            </button>
                          ))}
                          <div className="border-t border-slate-700" />
                          <button
                            onClick={async () => {
                              try {
                                await apiService.assignWalletTier(wallet.address, null);
                                // Refresh wallet data to show updated tier
                                await fetchWallets(false);
                              } catch (error) {
                                console.error('Error removing tier:', error);
                              }
                            }}
                            className="block w-full text-left px-3 py-1 text-sm text-red-300 hover:bg-slate-700"
                          >
                            {t('wallets.removeFromTier')}
                          </button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout */}
        <div className="lg:hidden space-y-3 px-4 py-4">
          {displayedWallets.map((wallet, index) => (
            <div key={wallet.id} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
              {/* First Row: ID, Address, Checkbox */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-3">
                  <span className="text-sm text-slate-400 font-medium">#{wallet.id}</span>
                  {wallet.tier && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/20 text-blue-400">
                      T{wallet.tier}
                    </span>
                  )}
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm text-slate-100">{formatAddress(wallet.address)}</span>
                    <button
                      onClick={() => handleCopyAddress(wallet.address)}
                      className="text-slate-400 hover:text-slate-300 transition-colors"
                      title={t('wallets.copyAddress')}
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => window.open(`https://debank.com/profile/${wallet.address}`, '_blank')}
                      className="text-slate-400 hover:text-slate-300 transition-colors"
                      title={t('wallets.openInDeBank')}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="rounded border-slate-600 bg-slate-700 text-blue-600 focus:ring-blue-500"
                  checked={isWalletSelected(wallet.address)}
                  onChange={(e) => handleWalletToggle(wallet.address, index, e)}
                  title={t('wallets.includeInCalculations')}
                />
              </div>

              {/* Second Row: Balance and Protocol Value */}
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="text-xs text-slate-400 mb-1">{t('wallets.balance')}</div>
                  <div className="font-medium text-slate-100">{formatCurrency(wallet.totalValue)}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-400 mb-1">{t('wallets.inProtocols')}</div>
                  <div className="font-medium text-slate-100">
                    {formatCurrency(wallet.protocols.reduce((sum, protocol) => sum + protocol.value, 0))}
                  </div>
                </div>
              </div>

              {/* Third Row: Chains */}
              <div className="mb-3">
                <div className="text-xs text-slate-400 mb-2">{t('wallets.chains')}</div>
                <div className="flex flex-wrap gap-1">
                  {wallet.chains.slice(0, 4).map((chain, chainIndex) => (
                    <span
                      key={chainIndex}
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-900/20 text-blue-400"
                    >
                      {getChainDisplayName(chain.name)}
                    </span>
                  ))}
                  {wallet.chains.length > 4 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-700 text-slate-400">
                      +{wallet.chains.length - 4}
                    </span>
                  )}
                </div>
              </div>

              {/* Fourth Row: Stats and Actions */}
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4 text-sm">
                  <div>
                    <span className="text-slate-400">{t('wallets.tokens')}: </span>
                    <span className="text-slate-300">{wallet.tokens.length}</span>
                  </div>
                  <div>
                    <span className="text-slate-400">{t('wallets.protocols')}: </span>
                    <span className="text-slate-300">{wallet.protocols.length}</span>
                  </div>
                  <div className="text-xs text-slate-500">{getTimeAgo(wallet.lastUpdated)}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleViewWallet(wallet.address)}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                    title={t('wallets.openInDeBank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <div className="relative group">
                    <button className="text-slate-400 hover:text-white text-sm">Tier ▾</button>
                    <div className="absolute right-0 bottom-full mb-1 hidden group-hover:block bg-slate-800 border border-slate-700 rounded-md shadow-lg z-10 min-w-[140px]">
                      {(['tier1','tier2','tier3'] as const).map(tier => (
                        <button
                          key={tier}
                          onClick={async () => {
                            try {
                              const tierNumber = tier === 'tier1' ? 1 : tier === 'tier2' ? 2 : 3;
                              await apiService.assignWalletTier(wallet.address, tierNumber);
                              // Refresh wallet data to show updated tier
                              await fetchWallets(false);
                            } catch (error) {
                              console.error('Error assigning tier:', error);
                            }
                          }}
                          className={`block w-full text-left px-3 py-1 text-sm hover:bg-slate-700 ${
                            (tier === 'tier1' && wallet.tier === 1) ||
                            (tier === 'tier2' && wallet.tier === 2) ||
                            (tier === 'tier3' && wallet.tier === 3)
                              ? 'text-blue-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {tier === 'tier1' ? t('wallets.addToTier1') : tier === 'tier2' ? t('wallets.addToTier2') : t('wallets.addToTier3')}
                        </button>
                      ))}
                      <div className="border-t border-slate-700" />
                      <button
                        onClick={async () => {
                          try {
                            await apiService.assignWalletTier(wallet.address, null);
                            // Refresh wallet data to show updated tier
                            await fetchWallets(false);
                          } catch (error) {
                            console.error('Error removing tier:', error);
                          }
                        }}
                        className="block w-full text-left px-3 py-1 text-sm text-red-300 hover:bg-slate-700"
                      >
                        {t('wallets.removeFromTier')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {displayedWallets.length === 0 && !isLoading && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Eye className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">{t('wallets.noWalletsFound')}</h3>
            <p className="text-slate-400">{t('wallets.noWalletsDescription')}</p>
          </div>
        )}

        {/* Пагинация */}
        {totalWallets > pageSize && displayedWallets.length >= pageSize && (
          <div className="mt-6 flex items-center justify-between px-4 py-3 bg-slate-800 border border-slate-700 rounded-lg">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-400">
                {t('wallets.showing')} {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, totalWallets)} {t('wallets.of')} {totalWallets} {t('common.wallets')}
              </span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                  fetchWallets(1, true);
                }}
                className="text-sm bg-slate-700 border border-slate-600 text-slate-200 rounded px-2 py-1"
              >
                <option value={50}>50 {t('wallets.perPage')}</option>
                <option value={100}>100 {t('wallets.perPage')}</option>
                <option value={200}>200 {t('wallets.perPage')}</option>
                <option value={500}>500 {t('wallets.perPage')}</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1 || loadingPage}
                className="px-3 py-1 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('wallets.first')}
              </button>
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1 || loadingPage}
                className="px-3 py-1 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('wallets.previous')}
              </button>

              {/* Номера страниц */}
              {(() => {
                const totalPages = Math.ceil(totalWallets / pageSize);
                const maxVisiblePages = 5;
                let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                
                if (endPage - startPage + 1 < maxVisiblePages) {
                  startPage = Math.max(1, endPage - maxVisiblePages + 1);
                }

                return Array.from({ length: endPage - startPage + 1 }, (_, i) => {
                  const pageNum = startPage + i;
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      disabled={loadingPage}
                      className={`px-3 py-1 text-sm rounded ${
                        pageNum === currentPage
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                      } disabled:opacity-50 disabled:cursor-not-allowed`}
                    >
                      {pageNum}
                    </button>
                  );
                });
              })()}

              <button
                onClick={() => setCurrentPage(Math.min(Math.ceil(totalWallets / pageSize), currentPage + 1))}
                disabled={currentPage >= Math.ceil(totalWallets / pageSize) || loadingPage}
                className="px-3 py-1 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('wallets.next')}
              </button>
              <button
                onClick={() => setCurrentPage(Math.ceil(totalWallets / pageSize))}
                disabled={currentPage >= Math.ceil(totalWallets / pageSize) || loadingPage}
                className="px-3 py-1 text-sm bg-slate-700 text-slate-300 rounded hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('wallets.last')}
              </button>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full mx-4 border border-slate-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center">
                  <Trash2 className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-100">Delete Wallets</h3>
                  <p className="text-sm text-slate-400">This action cannot be undone</p>
                </div>
              </div>
              
              <p className="text-slate-300 mb-6">
                Are you sure you want to delete <strong>{tempSelectedWallets.size} wallet{tempSelectedWallets.size > 1 ? 's' : ''}</strong> from the database? 
                This will permanently remove all data for these wallets.
              </p>
              
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-slate-600 text-white rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteWallets}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      Delete {tempSelectedWallets.size} wallet{tempSelectedWallets.size > 1 ? 's' : ''}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WalletsTab; 