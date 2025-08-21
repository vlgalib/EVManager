import React, { useState, useEffect } from 'react';
import { Activity, Search, ExternalLink, Filter, Download, ArrowUpDown, ChevronDown, ChevronRight, Wallet, Copy, ChevronLeft, ChevronRight as ChevronRightIcon } from 'lucide-react';
import { ProtocolData, FilterOptions } from '../types';
import { apiService } from '../services/api';
import { formatCurrency } from '../utils/helpers';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import LogoImage from './icons/LogoImage';
import { getChainLogo, getChainDisplayName } from '../data/chainLogos';
import { exportProtocolsToExcel } from '../utils/excelExport';
import { cn } from '../utils/helpers';
import CustomDropdown from './icons/CustomDropdown';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

const ProtocolsTab: React.FC = () => {
  const { t } = useLanguage();
  const { theme } = useTheme();
  const [protocols, setProtocols] = useState<ProtocolData[]>([]);
  const [filteredProtocols, setFilteredProtocols] = useState<ProtocolData[]>([]);
  const [wallets, setWallets] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedChain, setSelectedChain] = useState<string>('all_chains');

  const [sortBy, setSortBy] = useState('value');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [filters, setFilters] = useState<FilterOptions>({});
  const [showFilters, setShowFilters] = useState(false);
  const [expandedProtocols, setExpandedProtocols] = useState<Set<string>>(new Set());
  const [protocolWallets, setProtocolWallets] = useState<Record<string, any[]>>({});
  const [loadingProtocolWallets, setLoadingProtocolWallets] = useState<Set<string>>(new Set());
  const [protocolWalletPages, setProtocolWalletPages] = useState<Record<string, number>>({});
  const { selectedWallets } = useWalletSelection();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const selectedWalletsArray = Array.from(selectedWallets);
        const [aggregatedResponse, walletsResponse] = await Promise.all([
          apiService.getAggregated(selectedWalletsArray),
          apiService.getWallets()
        ]);
        
        const allProtocols = aggregatedResponse.topProtocols;
        const allWallets = walletsResponse.wallets;
        

        
        setProtocols(allProtocols);
        setFilteredProtocols(allProtocols);
        setWallets(allWallets);
        setError(null);
      } catch (err) {
        setError(t('status.loadingError'));
        console.error('Error fetching protocols:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Обновление каждые 5 секунд для более быстрой синхронизации

    return () => clearInterval(interval);
  }, [selectedWallets]);

  useEffect(() => {
    // Разворачиваем протоколы только если выбрана конкретная сеть
    const shouldExpand = selectedChain !== 'all_chains';
    const protocolsToFilter = shouldExpand ? expandProtocolsByChains(protocols) : protocols;
    let filtered = protocolsToFilter;

    // Поиск по названию
    if (searchTerm) {
      filtered = filtered.filter(protocol =>
        protocol.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Фильтр по цепочке
    if (selectedChain !== 'all_chains') {
      if (shouldExpand) {
        // Если протоколы развернуты, фильтруем просто по chain
        filtered = filtered.filter(protocol => protocol.chain === selectedChain);
      } else {
        // Если протоколы агрегированы, фильтруем по наличию сети в массиве chains
        filtered = filtered.filter(protocol => {
          if (protocol.chains && Array.isArray(protocol.chains)) {
            return protocol.chains.includes(selectedChain);
          } else {
            return protocol.chain === selectedChain;
          }
        });
      }
    }

    // Фильтр по протоколу
    if (filters.selectedProtocol) {
      filtered = filtered.filter(protocol => protocol.name === filters.selectedProtocol);
    }

    // Дополнительные фильтры
    if (filters.minValue !== undefined) {
      filtered = filtered.filter(protocol => protocol.value >= filters.minValue!);
    }
    if (filters.maxValue !== undefined) {
      filtered = filtered.filter(protocol => protocol.value <= filters.maxValue!);
    }

    // Сортировка
    filtered.sort((a, b) => {
      const aValue = a[sortBy as keyof ProtocolData];
      const bValue = b[sortBy as keyof ProtocolData];
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      } else {
        const aNum = aValue as number;
        const bNum = bValue as number;
        return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
      }
    });

    setFilteredProtocols(filtered);
  }, [protocols, searchTerm, selectedChain, sortBy, sortOrder, filters]);

  // Функция для разворачивания агрегированных протоколов в отдельные записи по сетям
  const expandProtocolsByChains = (protocols: ProtocolData[]): ProtocolData[] => {
    const expandedProtocols: ProtocolData[] = [];
    
    protocols.forEach(protocol => {
      if (protocol.chains && Array.isArray(protocol.chains) && protocol.chains.length > 1) {
        // Если протокол есть в нескольких сетях, создаем отдельную запись для каждой сети
        protocol.chains.forEach(chain => {
          if (chain !== 'all') {
            expandedProtocols.push({
              ...protocol,
              chain: chain,
              chains: [chain], // Устанавливаем только одну сеть
              // Примерно распределяем стоимость по сетям (это приблизительно)
              value: protocol.value / protocol.chains.length
            });
          }
        });
      } else {
        // Если протокол только в одной сети или chains не массив
        expandedProtocols.push({
          ...protocol,
          chain: protocol.chain === 'all' && protocol.chains?.[0] ? protocol.chains[0] : protocol.chain
        });
      }
    });
    
    return expandedProtocols;
  };

  const getUniqueChains = () => {
    const chains = new Set<string>();
    if (!protocols || protocols.length === 0) {
      return [];
    }
    
    protocols.forEach(protocol => {
      if (protocol) {
        // Проверяем массив chains сначала, потом fallback на chain
        if (protocol.chains && Array.isArray(protocol.chains)) {
          protocol.chains.forEach(chain => {
            if (chain && chain !== 'all') {
              chains.add(chain);
            }
          });
        } else if (protocol.chain && protocol.chain !== 'all') {
          chains.add(protocol.chain);
        }
      }
    });
    
    return Array.from(chains).sort();
  };

  const getUniqueProtocolsForChain = (chain: string) => {
    if (chain === 'all_chains') {
      const allProtocols = new Set<string>();
      protocols.forEach(protocol => allProtocols.add(protocol.name));
      return Array.from(allProtocols).sort();
    } else {
      // Для конкретной сети разворачиваем протоколы
      const expandedProtocols = expandProtocolsByChains(protocols);
      const chainProtocols = new Set<string>();
      expandedProtocols.filter(protocol => protocol.chain === chain).forEach(protocol => chainProtocols.add(protocol.name));
      return Array.from(chainProtocols).sort();
    }
  };



  const getProtocolStats = () => {
    // Сортируем протоколы по стоимости для отображения топ протоколов
    const sortedProtocols = [...protocols].sort((a, b) => b.value - a.value);
    
    // Берем топ 10 протоколов для диаграммы
    return sortedProtocols.slice(0, 10).map((protocol, index) => ({
      name: protocol.name,
      value: protocol.value,
      chain: protocol.chain,
      category: protocol.category,
      logo: protocol.logo,
      color: ['#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'][index % 10]
    }));
  };

  const handleExport = () => {
    exportProtocolsToExcel(wallets, selectedWallets);
  };

  const toggleProtocolExpansion = async (protocol: ProtocolData) => {
    const protocolKey = protocol.name; // Используем название протокола для объединения
    const isExpanded = expandedProtocols.has(protocolKey);
    
    if (isExpanded) {
      // Сворачиваем
      const newExpanded = new Set(expandedProtocols);
      newExpanded.delete(protocolKey);
      setExpandedProtocols(newExpanded);
    } else {
      // Разворачиваем и загружаем данные о кошельках
      const newExpanded = new Set(expandedProtocols);
      newExpanded.add(protocolKey);
      setExpandedProtocols(newExpanded);
      
      if (!protocolWallets[protocolKey]) {
        const newLoading = new Set(loadingProtocolWallets);
        newLoading.add(protocolKey);
        setLoadingProtocolWallets(newLoading);
        
        try {
          const selectedWalletsArray = Array.from(selectedWallets);
          
          // Загружаем все кошельки постранично
          const allWallets: any[] = [];
          let offset = 0;
          let hasMore = true;
          
          while (hasMore) {
            const response = await apiService.getProtocolWallets(
              protocol.name, // Передаем название протокола
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
          
          setProtocolWallets(prev => ({
            ...prev,
            [protocolKey]: allWallets
          }));
        } catch (error) {
          console.error('Ошибка загрузки кошельков протокола:', error);
        } finally {
          const newLoading = new Set(loadingProtocolWallets);
          newLoading.delete(protocolKey);
          setLoadingProtocolWallets(newLoading);
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

  const getProtocolPageData = (protocolKey: string) => {
    const wallets = protocolWallets[protocolKey] || [];
    const currentPage = protocolWalletPages[protocolKey] || 1;
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

  const setProtocolPage = (protocolKey: string, page: number) => {
    setProtocolWalletPages(prev => ({
      ...prev,
      [protocolKey]: page
    }));
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const totalValue = protocols.reduce((sum, protocol) => sum + protocol.value, 0);
  const chartData = getProtocolStats().map(protocol => ({
    ...protocol,
    percentage: (protocol.value / totalValue) * 100
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
            <Activity className="w-8 h-8 text-red-400" />
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
                placeholder={t('filters.searchProtocols')}
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
                  options={[
                    { value: 'all_chains', label: t('filters.allChains') },
                    ...getUniqueChains().map(chain => ({
                      value: chain,
                      label: getChainDisplayName(chain),
                      logo: getChainLogo(chain)
                    }))
                  ]}
                  placeholder={t('filters.allChains')}
                />
              </div>

              {/* Фильтр по протоколу */}
              <div>
                <label className={cn(
                  "block text-sm font-medium mb-2",
                  theme === 'dark' ? "text-slate-300" : "text-gray-700"
                )}>{t('filters.protocol')}</label>
                <CustomDropdown
                  value={filters.selectedProtocol || 'all_protocols'}
                  onChange={(value) => setFilters({ ...filters, selectedProtocol: value === 'all_protocols' ? undefined : value as string })}
                  options={[
                    { value: 'all_protocols', label: t('filters.allProtocols') },
                    ...getUniqueProtocolsForChain(selectedChain).map(protocol => {
                      const protocolData = protocols.find(p => p.name === protocol);
                      return {
                        value: protocol,
                        label: protocol,
                        logo: protocolData?.logo
                      };
                    })
                  ]}
                  placeholder={t('filters.allProtocols')}
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
        {/* Распределение по протоколам */}
        <div className={cn(
          "rounded-xl p-6 shadow-sm border",
          theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
        )}>
          <h3 className="text-lg font-semibold text-slate-100 mb-4">{t('protocols.protocolDistribution')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      
                      return (
                        <div className={cn(
                          "border rounded-lg p-3 shadow-lg",
                          theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
                        )}>
                          <div className="flex items-center space-x-2 mb-2">
                            <LogoImage 
                              src={data.logo} 
                              alt={data.name}
                              size="sm"
                            />
                            <span className="text-slate-100 font-medium">
                              {data.name}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-slate-300 text-sm">
                              {getChainDisplayName(data.chain)}
                            </span>
                          </div>
                          <p className="text-slate-300 text-sm">
                            {t('protocols.value')}: {formatCurrency(data.value)}
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
            {chartData.map((item, index) => {
              return (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <LogoImage 
                      src={item.logo} 
                      alt={item.name}
                      size="sm"
                    />
                    <span className="text-slate-300">{item.name}</span>
                  </div>
                  <span className="font-medium text-slate-100">{formatCurrency(item.value)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Топ протоколы по стоимости */}
        <div className={cn(
          "rounded-xl p-6 shadow-sm border",
          theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
        )}>
          <h3 className="text-lg font-semibold text-slate-100 mb-4">{t('protocols.topProtocolsByValue')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={filteredProtocols.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  formatter={(value: any) => [formatCurrency(value), t('protocols.value')]}
                  labelFormatter={(label) => `${label}`}
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #475569',
                    borderRadius: '8px',
                    color: '#f1f5f9'
                  }}
                  itemStyle={{ color: '#f1f5f9' }}
                  labelStyle={{ color: '#f1f5f9' }}
                />
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Таблица протоколов */}
      <div className={cn(
        "rounded-xl shadow-sm border",
        theme === 'dark' ? "bg-slate-800 border-slate-700" : "bg-white border-gray-200"
      )}>
        <div className="px-6 py-4 border-b border-slate-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-100">
              {t('protocols.title')} ({filteredProtocols.length})
            </h3>
            <div className="text-sm text-slate-400">
              {t('protocols.showing')} {filteredProtocols.length} {t('protocols.of')} {protocols.length}
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
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('protocols.protocol')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('protocols.chain')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('protocols.category')}</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">
                  <button
                    onClick={() => handleSort('value')}
                    className="flex items-center space-x-1 hover:text-slate-300 transition-colors"
                  >
                    <span>{t('protocols.value')}</span>
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                </th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">{t('protocols.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredProtocols.map((protocol, index) => {
                const protocolKey = protocol.name; // Используем название протокола
                const isExpanded = expandedProtocols.has(protocolKey);
                const isLoading = loadingProtocolWallets.has(protocolKey);
                const wallets = protocolWallets[protocolKey] || [];
                
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
                            onClick={() => toggleProtocolExpansion(protocol)}
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
                            src={protocol.logo} 
                            alt={protocol.name}
                            size="md"
                          />
                          <div>
                            <div className="font-medium text-slate-100">{protocol.name}</div>
                          </div>
                        </div>
                      </td>
                  <td className="py-3 px-4">
                    <div className="flex flex-wrap gap-1">
                      {(protocol.chains || [protocol.chain]).map((chain, chainIndex) => (
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
                  <td className="py-3 px-4">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/20 text-blue-400">
                      {protocol.category}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <span className="font-medium text-slate-100">{formatCurrency(protocol.value)}</span>
                  </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => window.open(`https://debank.com/protocols/${protocol.id}`, '_blank')}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                          title={t('wallets.openInDeBank')}
                        >
                          <ExternalLink className="w-4 h-4" />
                        </button>
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
                              <span>{t('protocols.walletsWithFunds')}</span>
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
                                Нет кошельков с средствами в этом протоколе
                              </div>
                            ) : (() => {
                              const protocolKey = protocol.name; // Используем название протокола
                              const pageData = getProtocolPageData(protocolKey);
                              
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
                                            {(walletData.protocol.chains || [walletData.protocol.chain]).map((chain, chainIndex) => (
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
                                        <div className={cn(
                                          "text-sm font-medium",
                                          theme === 'dark' ? "text-slate-100" : "text-gray-900"
                                        )}>
                                          {formatCurrency(walletData.protocol.value)}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                  
                                  {pageData.totalPages > 1 && (
                                    <div className="flex items-center justify-between pt-4 border-t border-slate-600">
                                      <div className="text-sm text-slate-400">
                                        Показано {pageData.startIndex}-{pageData.endIndex} из {pageData.totalWallets} кошельков
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => setProtocolPage(protocolKey, pageData.currentPage - 1)}
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
                                          onClick={() => setProtocolPage(protocolKey, pageData.currentPage + 1)}
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
          {filteredProtocols.map((protocol, index) => {
            const protocolKey = protocol.name;
            const isExpanded = expandedProtocols.has(protocolKey);
            const isLoading = loadingProtocolWallets.has(protocolKey);
            const wallets = protocolWallets[protocolKey] || [];

            return (
              <div key={index} className="bg-slate-700/50 rounded-lg p-4 border border-slate-600">
                {/* Protocol Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => toggleProtocolExpansion(protocol)}
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
                      src={protocol.logo} 
                      alt={protocol.name}
                      size="md"
                    />
                    <div>
                      <div className="font-medium text-slate-100">{protocol.name}</div>
                    </div>
                  </div>
                  <button
                    onClick={() => window.open(`https://debank.com/protocols/${protocol.id}`, '_blank')}
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                    title={t('wallets.openInDeBank')}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                </div>

                {/* Protocol Stats */}
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <div className="text-xs text-slate-400 mb-1">{t('protocols.category')}</div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/20 text-blue-400">
                      {protocol.category}
                    </span>
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-slate-400 mb-1">{t('protocols.value')}</div>
                    <div className="font-medium text-slate-100">{formatCurrency(protocol.value)}</div>
                  </div>
                </div>

                {/* Chains */}
                <div className="mb-3">
                  <div className="text-xs text-slate-400 mb-2">{t('protocols.chain')}</div>
                  <div className="flex flex-wrap gap-1">
                    {(protocol.chains || [protocol.chain]).map((chain, chainIndex) => (
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

                {/* Expanded Wallets Section */}
                {isExpanded && (
                  <div className="border-t border-slate-600 pt-3 mt-3">
                    <div className="flex items-center gap-2 text-slate-300 font-medium mb-3">
                      <Wallet className="w-4 h-4" />
                      <span>{t('protocols.walletsWithFunds')}</span>
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
                        Нет кошельков с средствами в этом протоколе
                      </div>
                    ) : (() => {
                      const pageData = getProtocolPageData(protocolKey);
                      
                      return (
                        <div className="space-y-2">
                          {pageData.pageWallets.map((walletData: any, idx: number) => (
                            <div key={idx} className={cn(
                              "flex items-center justify-between py-2 px-3 rounded-lg",
                              theme === 'dark' ? "bg-slate-600/30" : "bg-gray-100"
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
                                  {(walletData.protocol.chains || [walletData.protocol.chain]).map((chain, chainIndex) => (
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
                              <div className={cn(
                                "text-sm font-medium",
                                theme === 'dark' ? "text-slate-100" : "text-gray-900"
                              )}>
                                {formatCurrency(walletData.protocol.value)}
                              </div>
                            </div>
                          ))}
                          
                          {pageData.totalPages > 1 && (
                            <div className="flex items-center justify-between pt-3 border-t border-slate-600">
                              <div className="text-sm text-slate-400">
                                Показано {pageData.startIndex}-{pageData.endIndex} из {pageData.totalWallets} кошельков
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setProtocolPage(protocolKey, pageData.currentPage - 1)}
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
                                  onClick={() => setProtocolPage(protocolKey, pageData.currentPage + 1)}
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

        {filteredProtocols.length === 0 && (
          <div className="p-8 text-center">
            <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-100 mb-2">Протоколы не найдены</h3>
            <p className="text-slate-400">Попробуйте изменить фильтры или поисковый запрос</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProtocolsTab; 