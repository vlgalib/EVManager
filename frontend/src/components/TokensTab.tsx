import React, { useState, useEffect } from 'react';
import { Coins, Search, Filter, Download, ChevronDown, ChevronRight, Wallet, Copy, ExternalLink, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { TokenData, FilterOptions } from '../types';
import { apiService } from '../services/api';
import { formatCurrency, formatTokenBalance, getTokenExplorerUrl } from '../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import LogoImage from './icons/LogoImage';
import { getChainLogo, getChainDisplayName, getChainData } from '../data/chainLogos';
import { exportTokensToExcel } from '../utils/excelExport';
import { cn } from '../utils/helpers';
import CustomDropdown from './icons/CustomDropdown';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

const TokensTab: React.FC = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [filteredTokens, setFilteredTokens] = useState<TokenData[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [aggregatedData, setAggregatedData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChain, setSelectedChain] = useState<string>('all_chains');
  const [sortBy] = useState('value');
  const [sortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<FilterOptions>({});
  const [showFilters, setShowFilters] = useState(false);
  const [expandedTokens, setExpandedTokens] = useState<Set<string>>(new Set());
  const [groupedTokens, setGroupedTokens] = useState<{[symbol: string]: TokenData[]}>({});
  const [tokenWallets, setTokenWallets] = useState<Record<string, any[]>>({});
  const [loadingTokenWallets, setLoadingTokenWallets] = useState<Set<string>>(new Set());
  const [tokenWalletPages, setTokenWalletPages] = useState<Record<string, number>>({});
  const { selectedWallets } = useWalletSelection();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const selectedWalletsArray = Array.from(selectedWallets);
        const [aggregatedResponse, walletsResponse] = await Promise.all([
          apiService.getAggregated(selectedWalletsArray),
          apiService.getWallets()
        ]);
        
        const allTokens = aggregatedResponse.detailedTopTokens || aggregatedResponse.topTokens;
        const allWallets = walletsResponse.wallets;
        
        
        setTokens(allTokens || []);
        setWallets(allWallets);
        setAggregatedData(aggregatedResponse);
        setError(null);
      } catch (err) {
        setError(t('status.loadingError'));
        console.error('Error fetching tokens:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    
    // Умное обновление: только когда изменились выбранные кошельки или идет обработка
    const interval = setInterval(async () => {
      try {
        // Проверяем статус сервера
        const statusData = await apiService.getStatus();
        if (statusData.isProcessing) {
          // Обновляем только если идет обработка кошельков
          fetchData();
        }
      } catch {
        // игнорируем периодические ошибки
      }
    }, 8000); // Увеличиваем интервал до 8 секунд

    return () => clearInterval(interval);
  }, [selectedWallets]);

  useEffect(() => {
    // Разворачиваем токены только если выбрана конкретная сеть
    const shouldExpand = selectedChain !== 'all_chains';
    const tokensToFilter = shouldExpand ? expandTokensByChains(tokens) : tokens;
    let filtered = tokensToFilter;

    // Поиск по символу, названию или сети
    if (searchTerm) {
      filtered = filtered.filter(token => {
        const searchLower = searchTerm.toLowerCase();
        
        // Поиск по символу и названию
        if (token.symbol.toLowerCase().includes(searchLower) ||
            token.name.toLowerCase().includes(searchLower)) {
          return true;
        }
        
        // Поиск по сетям - зависит от того, развернуты ли токены
        if (shouldExpand) {
          // Если токены развернуты, у каждого токена одна сеть
          return getChainDisplayName(token.chain).toLowerCase().includes(searchLower);
        } else {
          // Если токены агрегированы, ищем по всем сетям в массиве chains
          if (token.chains && Array.isArray(token.chains)) {
            return token.chains.some(chain => 
              getChainDisplayName(chain).toLowerCase().includes(searchLower)
            );
          } else if (token.chain) {
            return getChainDisplayName(token.chain).toLowerCase().includes(searchLower);
          }
        }
        
        return false;
      });
    }

    // Фильтр по цепочке
    if (selectedChain !== 'all_chains') {
      if (shouldExpand) {
        // Если токены развернуты, фильтруем просто по chain
        filtered = filtered.filter(token => token.chain === selectedChain);
      } else {
        // Если токены агрегированы, фильтруем по наличию сети в массиве chains
        filtered = filtered.filter(token => {
          if (token.chains && Array.isArray(token.chains)) {
            return token.chains.includes(selectedChain);
          } else {
            return token.chain === selectedChain;
          }
        });
      }
    }

    // Дополнительные фильтры
    if (filters.minValue !== undefined) {
      filtered = filtered.filter(token => token.value >= filters.minValue!);
    }
    if (filters.maxValue !== undefined) {
      filtered = filtered.filter(token => token.value <= filters.maxValue!);
    }
    
    // Фильтр по токену
    if (filters.selectedToken) {
      filtered = filtered.filter(token => token.symbol === filters.selectedToken);
    }

    // Сортировка
    filtered.sort((a, b) => {
      if (sortBy === 'chain') {
        const aChain = getChainDisplayName(a.chain);
        const bChain = getChainDisplayName(b.chain);
        const comparison = aChain.localeCompare(bChain);
        return sortOrder === 'asc' ? comparison : -comparison;
      }
      
      const aValue = a[sortBy as keyof TokenData] as number;
      const bValue = b[sortBy as keyof TokenData] as number;
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    setFilteredTokens(filtered);
    
    // Группировка токенов по символу
    const grouped: {[symbol: string]: TokenData[]} = {};
    const symbolCounts: {[symbol: string]: number} = {};
    
    // Подсчитываем количество уникальных сетей для каждого символа токена
    filtered.forEach(token => {
      if (!symbolCounts[token.symbol]) {
        symbolCounts[token.symbol] = 0;
      }
      // Проверяем, есть ли уже токен с таким символом в такой сети
      const existingChains = filtered
        .filter(t => t.symbol === token.symbol)
        .map(t => t.chain);
      symbolCounts[token.symbol] = new Set(existingChains).size;
    });
    
    // Группируем все токены по символу
    filtered.forEach(token => {
      if (!grouped[token.symbol]) {
        grouped[token.symbol] = [];
      }
      grouped[token.symbol].push(token);
    });
    
    // Сортируем токены в каждой группе по стоимости
    Object.keys(grouped).forEach(key => {
      grouped[key].sort((a, b) => b.value - a.value);
    });
    
    setGroupedTokens(grouped);
  }, [tokens, searchTerm, selectedChain, sortBy, sortOrder, filters]);

  // Функция для разворачивания агрегированных токенов в отдельные записи по сетям
  const expandTokensByChains = (tokens: TokenData[]): TokenData[] => {
    const expandedTokens: TokenData[] = [];
    
    tokens.forEach(token => {
      if (token.chains && Array.isArray(token.chains) && token.chains.length > 1) {
        // Если токен есть в нескольких сетях, создаем отдельную запись для каждой сети
        token.chains.forEach(chain => {
          if (chain !== 'all') {
            expandedTokens.push({
              ...token,
              chain: chain,
              chains: [chain], // Устанавливаем только одну сеть
              // Примерно распределяем стоимость и баланс по сетям (это приблизительно)
              value: token.value / token.chains.length,
              balance: token.balance / token.chains.length
            });
          }
        });
      } else {
        // Если токен только в одной сети или chains не массив
        expandedTokens.push({
          ...token,
          chain: token.chain === 'all' && token.chains?.[0] ? token.chains[0] : token.chain
        });
      }
    });
    
    return expandedTokens;
  };

  const getUniqueChains = () => {
    // Всегда показываем все доступные сети из исходных данных
    const chains = new Set<string>();
    if (!tokens || tokens.length === 0) {
      return [];
    }
    
    tokens.forEach(token => {
      if (token) {
        // Проверяем массив chains сначала, потом fallback на chain
        if (token.chains && Array.isArray(token.chains)) {
          token.chains.forEach(chain => {
            if (chain && chain !== 'all') {
              chains.add(chain);
            }
          });
        } else if (token.chain && token.chain !== 'all') {
          chains.add(token.chain);
        }
      }
    });
    
    return Array.from(chains).sort();
  };

  const getUniqueTokensForChain = (chain: string) => {
    if (chain === 'all_chains') {
      const allTokens = new Set<string>();
      tokens.forEach(token => allTokens.add(token.symbol));
      return Array.from(allTokens).sort();
    } else {
      // Для конкретной сети разворачиваем токены
      const expandedTokens = expandTokensByChains(tokens);
      const chainTokens = new Set<string>();
      expandedTokens.filter(token => token.chain === chain).forEach(token => chainTokens.add(token.symbol));
      return Array.from(chainTokens).sort();
    }
  };

  const getChainStats = () => {
    // Используем данные из aggregatedData.topChains для получения статистики по сетям
    // Эти данные уже содержат правильное распределение по сетям
    if (aggregatedData?.topChains) {
      return aggregatedData.topChains.map(chain => ({
        name: getChainDisplayName(chain.name),
        chainName: chain.name,
        value: chain.value,
        tokenCount: chain.tokens?.length || 0
      })).sort((a, b) => b.value - a.value);
    }

    // Fallback на старую логику если нет данных
    const stats = new Map<string, { totalValue: number; tokenCount: number }>();
    
    tokens.forEach(token => {
      const existing = stats.get(token.chain) || { totalValue: 0, tokenCount: 0 };
      stats.set(token.chain, {
        totalValue: existing.totalValue + token.value,
        tokenCount: existing.tokenCount + 1
      });
    });

    return Array.from(stats.entries()).map(([chain, data]) => ({
      name: getChainDisplayName(chain),
      chainName: chain, // Добавляем оригинальное название для получения логотипа
      value: data.totalValue,
      tokenCount: data.tokenCount
    }));
  };

  const handleExport = () => {
    exportTokensToExcel(wallets, selectedWallets);
  };

  const toggleTokenExpansionWithWallets = async (tokenSymbol: string, tokenChain: string) => {
    const tokenKey = tokenSymbol; // Используем только символ токена для объединения
    const isExpanded = expandedTokens.has(tokenKey);
    
    if (isExpanded) {
      // Сворачиваем
      const newExpanded = new Set(expandedTokens);
      newExpanded.delete(tokenKey);
      setExpandedTokens(newExpanded);
    } else {
      // Разворачиваем и загружаем данные о кошельках
      const newExpanded = new Set(expandedTokens);
      newExpanded.add(tokenKey);
      setExpandedTokens(newExpanded);
      
      if (!tokenWallets[tokenKey]) {
        const newLoading = new Set(loadingTokenWallets);
        newLoading.add(tokenKey);
        setLoadingTokenWallets(newLoading);
        
        try {
          const selectedWalletsArray = Array.from(selectedWallets);
          
          // Загружаем все кошельки постранично
          const allWallets: any[] = [];
          let offset = 0;
          let hasMore = true;
          
          while (hasMore) {
            const response = await apiService.getTokenWallets(
              tokenSymbol, 
              'all', // Передаем 'all' чтобы получить кошельки по всем сетям
              selectedWalletsArray.length > 0 ? selectedWalletsArray : undefined,
              offset,
              1000 // Загружаем по 1000 кошельков за раз
            );
            
            allWallets.push(...response.wallets);
            hasMore = response.hasMore;
            offset += 1000;
            
            // Добавляем небольшую задержку чтобы не перегрузить сервер
            if (hasMore) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          }
          
          setTokenWallets(prev => ({
            ...prev,
            [tokenKey]: allWallets
          }));
        } catch (error) {
          console.error('Ошибка загрузки кошельков токена:', error);
        } finally {
          const newLoading = new Set(loadingTokenWallets);
          newLoading.delete(tokenKey);
          setLoadingTokenWallets(newLoading);
        }
      }
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      // You could add a toast notification here if needed
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const getTokenPageData = (tokenKey: string) => {
    const wallets = tokenWallets[tokenKey] || [];
    const currentPage = tokenWalletPages[tokenKey] || 1;
    const itemsPerPage = 10;
    const totalPages = Math.ceil(wallets.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageWallets = wallets.slice(startIndex, endIndex);
    
    return {
      pageWallets,
      currentPage,
      totalPages,
      totalWallets: wallets.length,
      startIndex: startIndex + 1,
      endIndex: Math.min(endIndex, wallets.length)
    };
  };

  const setTokenPage = (tokenKey: string, page: number) => {
    setTokenWalletPages(prev => ({
      ...prev,
      [tokenKey]: page
    }));
  };

  const chartData = getChainStats().map((chain, index) => ({
    name: chain.name,
    chainName: chain.chainName, // Добавляем оригинальное название для получения логотипа
    value: chain.value,
    tokenCount: chain.tokenCount,
    color: ['#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#06B6D4'][index % 6]
  }));

  // Вычисляем общую стоимость для расчета процентов
  const totalValue = chartData.reduce((sum, item) => sum + item.value, 0);
  
  // Добавляем процент к каждому элементу
  const chartDataWithPercentage = chartData.map(item => ({
    ...item,
    percentage: (item.value / totalValue) * 100
  }));

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
      <div className={cn(
        "rounded-xl p-8 shadow-sm border",
        theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
      )}>
        <div className="text-center">
          <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Coins className="w-8 h-8 text-red-400" />
          </div>
<h3 className="text-lg font-semibold text-slate-100 mb-2">{t('status.loadingError')}</h3>
          <p className="text-slate-400">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Фильтры */}
      <div className={cn(
        "rounded-xl p-6 shadow-sm border",
        theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
      )}>
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder={t('filters.searchTokens')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent",
                  theme === 'dark' 
                    ? "border-slate-600 bg-slate-800 text-slate-100 placeholder-slate-400"
                    : "border-gray-300 bg-white text-gray-900 placeholder-gray-500"
                )}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                "flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors",
                showFilters
                  ? "bg-blue-900/20 border-blue-600 text-blue-400"
                  : theme === 'dark'
                    ? "bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700"
                    : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              )}
            >
              <Filter className="w-4 h-4" />
              <span>{t('filters.filters')}</span>
            </button>
            <button
              onClick={handleExport}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>{t('filters.export')}</span>
            </button>
          </div>
        </div>

        {/* Панель фильтров */}
        {showFilters && (
          <div className={cn(
            "mt-4 p-4 rounded-lg",
            theme === 'dark' ? "bg-slate-700" : "bg-gray-50"
          )}>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Фильтр по цепочке */}
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? "text-slate-300" : "text-gray-700"
                )}>{t('filters.chain')}</label>
                <CustomDropdown
                  value={selectedChain}
                  onChange={(value) => setSelectedChain(value as string)}
                  options={(() => {
                    const uniqueChains = getUniqueChains();
                    const chainOptions = [
                      { value: 'all_chains', label: t('filters.allChains') },
                      ...uniqueChains.map(chain => ({
                        value: chain,
                        label: getChainDisplayName(chain),
                        logo: getChainLogo(chain)
                      }))
                    ];
                    return chainOptions;
                  })()}
                  placeholder={t('filters.allChains')}
                />
              </div>

              {/* Токен */}
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? "text-slate-300" : "text-gray-700"
                )}>{t('filters.token')}</label>
                <CustomDropdown
                  value={filters.selectedToken || 'all_tokens'}
                  onChange={(value) => setFilters({ ...filters, selectedToken: value === 'all_tokens' ? undefined : value as string })}
                  options={[
                    { value: 'all_tokens', label: t('filters.allTokens') },
                    ...getUniqueTokensForChain(selectedChain).map(token => {
                      const tokenData = tokens.find(t => t.symbol === token);
                      return {
                        value: token,
                        label: token,
                        logo: tokenData?.logo
                      };
                    })
                  ]}
                  placeholder={t('filters.allTokens')}
                />
              </div>

              {/* Фильтр по стоимости - объединим в одну колонку */}
              <div className="md:col-span-2">
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? "text-slate-300" : "text-gray-700"
                )}>{t('filters.valueRange')}</label>
                <div className="flex space-x-2">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={t('filters.from')}
                    value={filters.minValue || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || parseFloat(value) >= 0) {
                        setFilters({ ...filters, minValue: value === '' ? undefined : parseFloat(value) });
                      }
                    }}
                    className={cn(
                      "flex-1 px-3 py-2 border rounded-lg text-sm",
                      theme === 'dark' 
                        ? "border-slate-600 bg-slate-800 text-slate-100" 
                        : "border-gray-300 bg-white text-gray-900"
                    )}
                  />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder={t('filters.to')}
                    value={filters.maxValue || ''}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value === '' || parseFloat(value) >= 0) {
                        setFilters({ ...filters, maxValue: value === '' ? undefined : parseFloat(value) });
                      }
                    }}
                    className={cn(
                      "flex-1 px-3 py-2 border rounded-lg text-sm",
                      theme === 'dark' 
                        ? "border-slate-600 bg-slate-800 text-slate-100" 
                        : "border-gray-300 bg-white text-gray-900"
                    )}
                  />
                </div>
              </div>
            </div>

            {/* Кнопка сброса фильтров */}
            <div className="mt-4">
              <button
                onClick={() => {
                  setFilters({});
                  setSearchTerm('');
                  setSelectedChain('all_chains');
                }}
                className="text-sm text-slate-400 hover:text-slate-300"
              >
{t('filters.reset')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Распределение по цепочкам */}
        <div className={cn(
          "rounded-xl p-6 shadow-sm border",
          theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
        )}>
<h3 className="text-lg font-semibold text-slate-100 mb-4">{t('tokens.chainDistribution')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartDataWithPercentage}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartDataWithPercentage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const chainData = getChainData(data.chainName);
                      
                      return (
                        <div className={cn(
                          "border rounded-lg p-3 shadow-lg",
                          theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
                        )}>
                          <div className="flex items-center space-x-2 mb-2">
                            {chainData?.logo && (
                              <img 
                                src={chainData.logo} 
                                alt={data.name}
                                className="w-5 h-5 rounded-full"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                            <span className="text-slate-100 font-medium">
                              {data.name}
                            </span>
                          </div>
                          <p className="text-slate-300 text-sm">
                            {t('tokens.value')}: {formatCurrency(data.value)}
                          </p>
                          <p className="text-slate-400 text-xs">
                            {data.percentage.toFixed(2)}%
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                  contentStyle={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    boxShadow: 'none'
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-4 space-y-2">
            {chartDataWithPercentage.map((item, index) => {
              const chainData = getChainData(item.chainName);
              return (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    {chainData?.logo && (
                      <img 
                        src={chainData.logo} 
                        alt={item.name}
                        className="w-5 h-5 rounded-full"
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    <span className="text-slate-300">{item.name}</span>
                  </div>
                  <span className="font-medium text-slate-100">{formatCurrency(item.value)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Топ токены по стоимости */}
        <div className={cn(
          "rounded-xl p-6 shadow-sm border",
          theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
        )}>
          <h3 className="text-lg font-semibold text-slate-100 mb-4">{t('tokens.topTokensByValue')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(() => {
                // Use properly aggregated data from backend instead of re-aggregating
                // Backend already handles latest price logic correctly
                const topTokens = tokens
                  .filter(token => token.chain === 'all') // Use only aggregated tokens from backend
                  .sort((a, b) => b.value - a.value)
                  .slice(0, 10);
                
                if (topTokens.length === 0) {
                  // Fallback: if no aggregated data, use filtered tokens but don't recalculate prices
                  const fallbackTokens = filteredTokens
                    .sort((a, b) => b.value - a.value)
                    .slice(0, 10);
                  const totalValue = fallbackTokens.reduce((sum, token) => sum + token.value, 0);
                  return fallbackTokens.map(token => ({
                    ...token,
                    displayName: token.symbol,
                    percentage: (token.value / totalValue) * 100
                  }));
                }
                
                const totalValue = topTokens.reduce((sum, token) => sum + token.value, 0);
                return topTokens.map(token => ({
                  ...token,
                  displayName: token.symbol,
                  percentage: (token.value / totalValue) * 100
                }));
              })()}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis 
                  dataKey="displayName" 
                  stroke="#94a3b8" 
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  interval={0}
                />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      
                      return (
                        <div className={cn(
                          "border rounded-lg p-3 shadow-lg",
                          theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
                        )}>
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-slate-100 font-medium">
                              {data.symbol}
                            </span>
                            {data.logo && (
                              <img 
                                src={data.logo} 
                                alt={data.symbol}
                                className="w-5 h-5 rounded-full"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                          <p className="text-slate-300 text-sm">
                            {t('overview.totalValue')}: {formatCurrency(data.value)}
                          </p>
                          <p className="text-slate-400 text-xs">
                            {data.percentage.toFixed(2)}% {t('tokens.ofTopTen')}
                          </p>
                          <p className="text-slate-500 text-xs">
                            {t('tokens.aggregatedAcrossNetworks')}
                          </p>
                        </div>
                      );
                    }
                    return null;
                  }}
                  contentStyle={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    boxShadow: 'none'
                  }}
                />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Таблица токенов */}
      <div className={cn(
        "rounded-xl shadow-sm border",
        theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
      )}>
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">
              {t('tokens.title')} ({Object.keys(groupedTokens).length} {t('tokens.groups')}, {filteredTokens.length} {t('tokens.tokensTotal')})
            </h3>
            <div className="text-sm text-slate-400">
              {t('tokens.showing')} {Object.keys(groupedTokens).length} {t('tokens.groupsOf')} {filteredTokens.length} {t('tokens.tokensTotal')}
            </div>
          </div>
        </div>

        {/* Desktop Table */}
        <div className="hidden lg:block overflow-x-auto">
          <table className="w-full">
            <thead className={cn(
              theme === 'dark' ? "bg-slate-800" : "bg-gray-50"
            )}>
              <tr>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('tokens.token')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('tokens.chain')}</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">{t('tokens.balance')}</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">{t('tokens.price')}</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">{t('tokens.value')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredTokens.map((token, index) => {
                const tokenKey = token.symbol; // Используем только символ токена
                const isExpanded = expandedTokens.has(tokenKey);
                const isLoading = loadingTokenWallets.has(tokenKey);
                const wallets = tokenWallets[tokenKey] || [];

                return (
                  <React.Fragment key={index}>
                    <tr className={cn(
                      "border-b transition-colors",
                      theme === 'dark' 
                        ? "border-slate-700 hover:bg-slate-700/50" 
                        : "border-gray-200 hover:bg-gray-50"
                    )}>
                      <td className="py-3 px-4">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => toggleTokenExpansionWithWallets(token.symbol, 'all')}
                            className={cn(
                              "p-1 rounded transition-colors",
                              theme === 'dark' ? "hover:bg-slate-600" : "hover:bg-gray-200"
                            )}
                            title={isExpanded ? "Свернуть" : "Развернуть"}
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-4 h-4 text-slate-400" />
                            ) : (
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            )}
                          </button>
                          <LogoImage 
                            src={token.logo} 
                            alt={token.name || token.symbol}
                            size="md"
                          />
                          <div>
                            <div className="font-medium text-slate-100">
                              {token.address ? (
                                <a
                                  href={getTokenExplorerUrl(token.address, token.chain)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 transition-colors"
                                  title="Открыть в эксплорере"
                                >
                                  {token.symbol}
                                </a>
                              ) : (
                                token.symbol
                              )}
                            </div>
                            <div className="text-sm text-slate-400">{token.name}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(token.chains || [token.chain]).map((chain, chainIndex) => (
                            <div key={chainIndex} className="flex items-center space-x-1">
                              <LogoImage
                                src={getChainLogo(chain)}
                                alt={chain}
                                size="sm"
                              />
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/20 text-blue-400">
                                {getChainDisplayName(chain)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-mono text-sm text-slate-100">{formatTokenBalance(token.balance)}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-slate-100">{formatCurrency(token.price)}</span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="font-medium text-slate-100">{formatCurrency(token.value)}</span>
                      </td>
                    </tr>

                    {/* Раскрывающаяся часть с кошельками */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={5} className={cn(
                          "px-6 py-4",
                          theme === 'dark' ? "bg-slate-800/50" : "bg-gray-50"
                        )}>
                          <div className="space-y-3">
                            <div className="flex items-center gap-2 text-slate-300 font-medium">
                              <Wallet className="w-4 h-4" />
                              <span>{t('tokens.walletsWithToken')}</span>
                              {isLoading && (
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                              )}
                            </div>
                            
                            {isLoading ? (
                              <div className="text-center py-4 text-slate-400">
                                Загрузка кошельков...
                              </div>
                            ) : wallets.length === 0 ? (
                              <div className="text-center py-4 text-slate-400">
                                Нет кошельков с этим токеном
                              </div>
                            ) : (() => {
                              const tokenKey = token.symbol; // Используем только символ токена
                              const pageData = getTokenPageData(tokenKey);
                              
                              return (
                                <div className="space-y-4">
                                  <div className="space-y-2">
                                    {pageData.pageWallets.map((walletData: any, idx: number) => (
                                      <div key={idx} className={cn(
                                        "flex items-center justify-between py-2 px-4 rounded-lg",
                                        theme === 'dark' ? "bg-slate-700/30" : "bg-gray-100"
                                      )}>
                                        <div className="flex items-center gap-3">
                                          <div className={cn(
                                            "text-sm font-mono",
                                            theme === 'dark' ? "text-slate-300" : "text-gray-600"
                                          )}>
                                            #{walletData.wallet.id}
                                          </div>
                                          <div className={cn(
                                            "text-sm font-mono",
                                            theme === 'dark' ? "text-blue-400" : "text-blue-600"
                                          )}>
                                            {walletData.wallet.address.slice(0, 6)}...{walletData.wallet.address.slice(-4)}
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button
                                              onClick={() => copyToClipboard(walletData.wallet.address)}
                                              className={cn(
                                                "p-1 rounded transition-colors",
                                                theme === 'dark' ? "hover:bg-slate-600" : "hover:bg-gray-200"
                                              )}
                                              title={t('wallets.copyAddress')}
                                            >
                                              <Copy className={cn(
                                                "w-3 h-3",
                                                theme === 'dark' ? "text-slate-400 hover:text-slate-300" : "text-gray-500 hover:text-gray-700"
                                              )} />
                                            </button>
                                            <button
                                              onClick={() => window.open(`https://debank.com/profile/${walletData.wallet.address}`, '_blank')}
                                              className={cn(
                                                "p-1 rounded transition-colors",
                                                theme === 'dark' ? "hover:bg-slate-600" : "hover:bg-gray-200"
                                              )}
                                              title={t('wallets.openInDeBank')}
                                            >
                                              <ExternalLink className={cn(
                                                "w-3 h-3",
                                                theme === 'dark' ? "text-slate-400 hover:text-slate-300" : "text-gray-500 hover:text-gray-700"
                                              )} />
                                            </button>
                                          </div>
                                          <div className="flex flex-wrap gap-1">
                                            {(walletData.token.chains || [walletData.token.chain]).map((chain, chainIndex) => (
                                              <div key={chainIndex} className="flex items-center space-x-1">
                                                <LogoImage
                                                  src={getChainLogo(chain)}
                                                  alt={chain}
                                                  size="sm"
                                                />
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-900/20 text-green-400">
                                                  {getChainDisplayName(chain)}
                                                </span>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <div className="text-sm text-slate-300">
                                            {formatTokenBalance(walletData.token.balance)}
                                          </div>
                                          <div className="text-sm font-medium text-slate-100">
                                            {formatCurrency(walletData.token.value)}
                                          </div>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  
                                  {pageData.totalPages > 1 && (
                                    <div className="flex items-center justify-between pt-4 border-t border-slate-600">
                                      <div className="text-sm text-slate-400">
                                        {t('wallets.showing')} {pageData.startIndex}-{pageData.endIndex} {t('wallets.of')} {pageData.totalWallets} {t('common.wallets')}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => setTokenPage(tokenKey, pageData.currentPage - 1)}
                                          disabled={pageData.currentPage === 1}
                                          className={cn(
                                            "p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                                            theme === 'dark' ? "hover:bg-slate-600" : "hover:bg-gray-200"
                                          )}
                                        >
                                          <ChevronLeft className="w-4 h-4 text-slate-400" />
                                        </button>
                                        <span className="text-sm text-slate-300">
                                          {pageData.currentPage} / {pageData.totalPages}
                                        </span>
                                        <button
                                          onClick={() => setTokenPage(tokenKey, pageData.currentPage + 1)}
                                          disabled={pageData.currentPage === pageData.totalPages}
                                          className={cn(
                                            "p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                                            theme === 'dark' ? "hover:bg-slate-600" : "hover:bg-gray-200"
                                          )}
                                        >
                                          <ChevronRightIcon className="w-4 h-4 text-slate-400" />
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile Card Layout */}
        <div className="lg:hidden space-y-3 px-4 py-4">
          {filteredTokens.map((token, index) => {
            const tokenKey = token.symbol;
            const isExpanded = expandedTokens.has(tokenKey);
            const isLoading = loadingTokenWallets.has(tokenKey);
            const wallets = tokenWallets[tokenKey] || [];

            return (
              <div key={index} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                {/* Token Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => toggleTokenExpansionWithWallets(token.symbol, 'all')}
                      className={cn(
                        "p-1 rounded transition-colors",
                        theme === 'dark' ? "hover:bg-slate-600" : "hover:bg-gray-200"
                      )}
                      title={isExpanded ? "Свернуть" : "Развернуть"}
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                    <LogoImage 
                      src={token.logo} 
                      alt={token.name || token.symbol}
                      size="md"
                    />
                    <div>
                      <div className="font-medium text-slate-100">
                        {token.address ? (
                          <a
                            href={getTokenExplorerUrl(token.address, token.chain)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                            title="Открыть в эксплорере"
                          >
                            {token.symbol}
                          </a>
                        ) : (
                          token.symbol
                        )}
                      </div>
                      <div className="text-sm text-slate-400">{token.name}</div>
                    </div>
                  </div>
                </div>

                {/* Token Stats */}
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">{t('tokens.balance')}</div>
                    <div className="font-mono text-sm text-slate-100">{formatTokenBalance(token.balance)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400 mb-1">{t('tokens.value')}</div>
                    <div className="font-medium text-slate-100">{formatCurrency(token.value)}</div>
                  </div>
                </div>

                {/* Price and Chains */}
                <div className="mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <div className="text-xs text-slate-400 mb-1">{t('tokens.price')}</div>
                      <div className="text-slate-100">{formatCurrency(token.price)}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-slate-400 mb-2">{t('tokens.chain')}</div>
                    <div className="flex flex-wrap gap-1">
                      {(token.chains || [token.chain]).map((chain, chainIndex) => (
                        <div key={chainIndex} className="flex items-center space-x-1">
                          <LogoImage
                            src={getChainLogo(chain)}
                            alt={chain}
                            size="sm"
                          />
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-900/20 text-blue-400">
                            {getChainDisplayName(chain)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Expanded Wallets Section */}
                {isExpanded && (
                  <div className="border-t border-slate-600 pt-3 mt-3">
                    <div className="flex items-center gap-2 text-slate-300 font-medium mb-3">
                      <Wallet className="w-4 h-4" />
                      <span>{t('tokens.walletsWithToken')}</span>
                      {isLoading && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      )}
                    </div>
                    
                    {isLoading ? (
                      <div className="text-center py-4 text-slate-400">
                        Загрузка кошельков...
                      </div>
                    ) : wallets.length === 0 ? (
                      <div className="text-center py-4 text-slate-400">
                        Нет кошельков с этим токеном
                      </div>
                    ) : (() => {
                      const pageData = getTokenPageData(tokenKey);
                      
                      return (
                        <div className="space-y-2">
                          {pageData.pageWallets.map((walletData: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between py-2 px-3 bg-slate-600/30 rounded-lg">
                              <div className="flex items-center gap-3">
                                <div className="text-sm font-mono text-slate-300">
                                  #{walletData.wallet.id}
                                </div>
                                <div className="text-sm font-mono text-blue-400">
                                  {walletData.wallet.address.slice(0, 6)}...{walletData.wallet.address.slice(-4)}
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => copyToClipboard(walletData.wallet.address)}
                                    className={cn(
                                      "p-1 rounded transition-colors",
                                      theme === 'dark' ? "hover:bg-slate-600" : "hover:bg-gray-200"
                                    )}
                                    title={t('wallets.copyAddress')}
                                  >
                                    <Copy className={cn(
                                      "w-3 h-3",
                                      theme === 'dark' ? "text-slate-400 hover:text-slate-300" : "text-gray-500 hover:text-gray-700"
                                    )} />
                                  </button>
                                  <button
                                    onClick={() => window.open(`https://debank.com/profile/${walletData.wallet.address}`, '_blank')}
                                    className={cn(
                                      "p-1 rounded transition-colors",
                                      theme === 'dark' ? "hover:bg-slate-600" : "hover:bg-gray-200"
                                    )}
                                    title={t('wallets.openInDeBank')}
                                  >
                                    <ExternalLink className={cn(
                                      "w-3 h-3",
                                      theme === 'dark' ? "text-slate-400 hover:text-slate-300" : "text-gray-500 hover:text-gray-700"
                                    )} />
                                  </button>
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-sm text-slate-300">
                                  {formatTokenBalance(walletData.token.balance)}
                                </div>
                                <div className="text-sm font-medium text-slate-100">
                                  {formatCurrency(walletData.token.value)}
                                </div>
                              </div>
                            </div>
                          ))}
                          
                          {pageData.totalPages > 1 && (
                            <div className="flex items-center justify-between pt-3 border-t border-slate-600">
                              <div className="text-sm text-slate-400">
                                {t('wallets.showing')} {pageData.startIndex}-{pageData.endIndex} {t('wallets.of')} {pageData.totalWallets} {t('common.wallets')}
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setTokenPage(tokenKey, pageData.currentPage - 1)}
                                  disabled={pageData.currentPage === 1}
                                  className={cn(
                                    "p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                                    theme === 'dark' ? "hover:bg-slate-600" : "hover:bg-gray-200"
                                  )}
                                >
                                  <ChevronLeft className="w-4 h-4 text-slate-400" />
                                </button>
                                <span className="text-sm text-slate-300">
                                  {pageData.currentPage} / {pageData.totalPages}
                                </span>
                                <button
                                  onClick={() => setTokenPage(tokenKey, pageData.currentPage + 1)}
                                  disabled={pageData.currentPage === pageData.totalPages}
                                  className={cn(
                                    "p-1 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
                                    theme === 'dark' ? "hover:bg-slate-600" : "hover:bg-gray-200"
                                  )}
                                >
                                  <ChevronRightIcon className="w-4 h-4 text-slate-400" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredTokens.length === 0 && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Coins className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">Токены не найдены</h3>
            <p className="text-slate-400">Попробуйте изменить фильтры или поисковый запрос</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TokensTab; 