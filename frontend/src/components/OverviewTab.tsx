import React, { useState, useEffect } from 'react';
import { DollarSign, Coins, Activity, Wallet, Link } from 'lucide-react';
import { AggregatedData } from '../types';
import { apiService } from '../services/api';
import { formatCurrency, formatPercentage, getPriceChangeColor, getPriceChangeIcon, cn } from '../utils/helpers';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getChainDisplayName, getChainLogo, getChainData } from '../data/chainLogos';
import LogoImage from './icons/LogoImage';
import { useWalletSelection } from '../contexts/WalletSelectionContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';

const OverviewTab: React.FC = () => {
  const { theme } = useTheme();
  const [data, setData] = useState<AggregatedData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { selectedWallets } = useWalletSelection();
  const { t } = useLanguage();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const selectedWalletsArray = Array.from(selectedWallets);
        const aggregatedData = await apiService.getAggregated(selectedWalletsArray);
        setData(aggregatedData);
        setError(null);
      } catch (err) {
        setError(t('status.loadingError'));
        console.error('Error fetching aggregated data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Подхватываем новые кошельки после загрузки

    return () => clearInterval(interval);
  }, [selectedWallets]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
                <div className="h-4 bg-slate-700 rounded mb-4"></div>
                <div className="h-8 bg-slate-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-800 rounded-xl p-8 shadow-sm border border-slate-700">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-100 mb-2">{t('status.loadingError')}</h3>
          <p className="text-slate-400">{error || t('common.noData')}</p>
        </div>
      </div>
    );
  }

  const chartData = data.topChains.map((chain, index) => ({
    name: getChainDisplayName(chain.name),
    chainName: chain.name, // Добавляем оригинальное название для получения логотипа
    value: chain.value,
    percentage: (chain.value / data.totalValue) * 100,
    color: ['#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#10B981'][index % 5]
  }));

  const tokenChartData = data.topTokens.slice(0, 10).map((token, index) => ({
    name: token.symbol, // Показываем только символ, так как токены теперь агрегированы по символу
    symbol: token.symbol,
    chain: token.chain,
    value: token.value,
    percentage: (token.value / data.totalValue) * 100,
    color: ['#3B82F6', '#8B5CF6', '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#84CC16', '#F97316', '#EC4899', '#6366F1'][index % 10]
  }));

  return (
    <div className="space-y-6">
      {/* Основные метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Общая стоимость */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">{t('overview.totalValue')}</p>
              <p className="text-2xl font-bold text-slate-100">{formatCurrency(data.totalValue)}</p>
              <div className="flex items-center mt-2">
                <span className={getPriceChangeColor(data.totalChange24h)}>
                  {getPriceChangeIcon(data.totalChange24h)} {formatPercentage(data.totalChange24h)}
                </span>
                <span className="text-xs text-slate-500 ml-2">{t('overview.for24h')}</span>
              </div>
            </div>
            <div className="w-12 h-12 bg-blue-900/20 rounded-lg flex items-center justify-center">
              <DollarSign className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Количество кошельков */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">{t('overview.wallets')}</p>
              <p className="text-2xl font-bold text-slate-100">{data.walletsCount}</p>
              <p className="text-xs text-slate-500 mt-2">{t('overview.activeAddresses')}</p>
            </div>
            <div className="w-12 h-12 bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Wallet className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Топ токен */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">{t('overview.topToken')}</p>
              <p className="text-xl font-bold text-slate-100">
                {data.topTokens[0]?.symbol || 'N/A'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {formatCurrency(data.topTokens[0]?.value || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Coins className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>

        {/* Топ цепочка */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-400 mb-1">{t('overview.topChain')}</p>
              <p className="text-xl font-bold text-slate-100">
                {data.topChains[0]?.name ? getChainDisplayName(data.topChains[0].name) : 'N/A'}
              </p>
              <p className="text-sm text-slate-400 mt-1">
                {formatCurrency(data.topChains[0]?.value || 0)}
              </p>
            </div>
            <div className="w-12 h-12 bg-blue-900/20 rounded-lg flex items-center justify-center">
              <Link className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Графики */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Распределение по цепочкам */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">{t('overview.chainDistribution')}</h3>
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
                      const chainData = getChainData(data.chainName);
                      
                      return (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
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
                            {t('overview.value')}: {formatCurrency(data.value)}
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

        {/* Топ токены */}
        <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
          <h3 className="text-lg font-semibold text-slate-100 mb-4">{t('overview.topTokens')}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tokenChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                <XAxis 
                  dataKey="name" 
                  stroke="#94a3b8" 
                  fontSize={10}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                  tickFormatter={(value) => {
                    // Сокращаем длинные названия для лучшей читаемости
                    if (value.length > 15) {
                      const parts = value.split(' (');
                      if (parts.length === 2) {
                        const symbol = parts[0];
                        const chain = parts[1].replace(')', '');
                        // Сокращаем название сети если оно слишком длинное
                        const shortChain = chain.length > 8 ? chain.substring(0, 8) + '...' : chain;
                        return `${symbol} (${shortChain})`;
                      }
                    }
                    return value;
                  }}
                />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  content={({ active, payload, label }: any) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const chainData = getChainData(data.chain);
                      
                      return (
                        <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 shadow-lg">
                          <div className="flex items-center space-x-2 mb-2">
                            <span className="text-slate-100 font-medium">
                              {data.symbol}
                            </span>
                            <span className="text-xs bg-slate-600 text-slate-300 px-2 py-0.5 rounded">
                              {t('overview.aggregated')}
                            </span>
                          </div>
                          <p className="text-slate-300 text-sm">
                            {t('overview.value')}: {formatCurrency(data.value)}
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
                <Bar dataKey="value" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Топ протоколы */}
      <div className="bg-slate-800 rounded-xl p-6 shadow-sm border border-slate-700">
        <h3 className="text-lg font-semibold text-slate-100 mb-4">{t('overview.topProtocols')}</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('overview.protocol')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('overview.chain')}</th>
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-400">{t('overview.category')}</th>
                <th className="text-right py-3 px-4 text-sm font-medium text-slate-400">{t('overview.value')}</th>
              </tr>
            </thead>
            <tbody>
              {data.topProtocols.slice(0, 10).map((protocol, index) => (
                <tr key={index} className={cn(
                  "border-b transition-colors",
                  theme === 'dark' 
                    ? "border-slate-700 hover:bg-slate-700/50" 
                    : "border-gray-200 hover:bg-gray-50"
                )}>
                  <td className="py-3 px-4">
                    <div className="flex items-center space-x-3">
                      <LogoImage 
                        src={protocol.logo} 
                        alt={protocol.name}
                        size="sm"
                      />
                      <span className="font-medium text-slate-100">{protocol.name}</span>
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
                  <td className="py-3 px-4 text-right font-medium text-slate-100">
                    {formatCurrency(protocol.value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default OverviewTab; 