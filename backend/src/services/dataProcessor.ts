import { WalletData, AggregatedData, TokenData, ChainData, ProtocolData } from '../types';

export class DataProcessor {
  public aggregateWalletsData = (wallets: WalletData[]): AggregatedData => {
    const aggregated: AggregatedData = {
      totalValue: 0,
      totalChange24h: 0,
      walletsCount: wallets.length,
      topTokens: [],
      detailedTopTokens: [],
      topChains: [],
      topProtocols: [],
      wallets: wallets
    };

    // Собираем все токены из всех кошельков
    const allTokensByChain = new Map<string, TokenData>(); // Токены по сетям отдельно (старая логика)
    const allTokensBySymbol = new Map<string, TokenData>(); // Токены агрегированные по символу (новая логика)
    const allChains = new Map<string, ChainData>();
    const allProtocols = new Map<string, ProtocolData>();

    wallets.forEach(wallet => {
      // Суммируем общие значения
      aggregated.totalValue += wallet.totalValue;
      aggregated.totalChange24h += wallet.change24h;

      // Обрабатываем токены (две версии: по сетям и агрегированные)
      wallet.tokens.forEach(token => {
        // Старая логика - по сетям отдельно
        const chainKey = `${token.symbol}-${token.chain}`;
        if (allTokensByChain.has(chainKey)) {
          const existing = allTokensByChain.get(chainKey)!;
          existing.balance += token.balance;
          existing.value += token.value;
        } else {
          allTokensByChain.set(chainKey, { ...token });
        }

        // Новая логика - агрегированные по символу
        const symbolKey = token.symbol;
        if (allTokensBySymbol.has(symbolKey)) {
          const existing = allTokensBySymbol.get(symbolKey)!;
          existing.balance += token.balance;
          existing.value += token.value;
          existing.price = existing.value / existing.balance; // Средневзвешенная цена
          // Добавляем сеть в список если её там еще нет
          if (existing.chains && !existing.chains.includes(token.chain)) {
            existing.chains.push(token.chain);
          }
        } else {
          // Создаем новый токен со списком сетей
          allTokensBySymbol.set(symbolKey, { 
            ...token,
            chain: 'all', // Обозначаем что это агрегированные данные
            chains: [token.chain] // Начинаем с текущей сети
          });
        }
      });

      // Обрабатываем цепочки
      wallet.chains.forEach(chain => {
        if (allChains.has(chain.name)) {
          const existing = allChains.get(chain.name)!;
          existing.value += chain.value;
          // Объединяем токены без дублирования
          chain.tokens.forEach(token => {
            const existingToken = existing.tokens.find(t => t.symbol === token.symbol && t.address === token.address);
            if (existingToken) {
              existingToken.balance += token.balance;
              existingToken.value += token.value;
              existingToken.price = existingToken.balance > 0 ? existingToken.value / existingToken.balance : 0;
            } else {
              existing.tokens.push({
                symbol: token.symbol,
                name: token.name,
                balance: token.balance,
                value: token.value,
                price: token.price,
                chain: token.chain,
                logo: token.logo,
                priceChange24h: token.priceChange24h,
                address: token.address
              });
            }
          });
        } else {
          allChains.set(chain.name, { 
            name: chain.name,
            value: chain.value,
            tokens: chain.tokens.map(token => ({
              symbol: token.symbol,
              name: token.name,
              balance: token.balance,
              value: token.value,
              price: token.price,
              chain: token.chain,
              logo: token.logo,
              priceChange24h: token.priceChange24h,
              address: token.address
            }))
          });
        }
      });

      // Обрабатываем протоколы - объединяем по названию, сохраняя список всех сетей
      wallet.protocols.forEach(protocol => {
        const key = protocol.name; // Используем название протокола для объединения
        if (allProtocols.has(key)) {
          const existing = allProtocols.get(key)!;
          existing.value += protocol.value;
          // Добавляем сеть в список если её там еще нет
          if (existing.chains && !existing.chains.includes(protocol.chain)) {
            existing.chains.push(protocol.chain);
          }
        } else {
          // Создаем новый протокол со списком сетей
          allProtocols.set(key, { 
            ...protocol,
            chain: 'all', // Обозначаем что это агрегированные данные
            chains: [protocol.chain] // Начинаем с текущей сети
          });
        }
      });

    });

    // topTokens - для графиков на главной странице (агрегированные по символу)
    aggregated.topTokens = Array.from(allTokensBySymbol.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 20);

    // detailedTopTokens - для страницы Токены (агрегированные по символу с информацией о сетях)
    aggregated.detailedTopTokens = Array.from(allTokensBySymbol.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 100); // Увеличиваем до 100 чтобы показать больше токенов

    // Сортируем и берем топ цепочки
    aggregated.topChains = Array.from(allChains.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Сортируем и берем топ протоколы
    aggregated.topProtocols = Array.from(allProtocols.values())
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);

    return aggregated;
  };

  public getWalletStats = (wallets: WalletData[]) => {
    const stats = {
      totalWallets: wallets.length,
      totalValue: 0,
      averageValue: 0,
      medianValue: 0,
      topWallet: null as WalletData | null,
      bottomWallet: null as WalletData | null,
      valueDistribution: {
        under1k: 0,
        under10k: 0,
        under100k: 0,
        under1m: 0,
        over1m: 0
      },
      chainsDistribution: new Map<string, number>()
    };

    if (wallets.length === 0) return stats;

    // Сортируем кошельки по стоимости
    const sortedWallets = [...wallets].sort((a, b) => b.totalValue - a.totalValue);
    
    stats.totalValue = sortedWallets.reduce((sum, wallet) => sum + wallet.totalValue, 0);
    stats.averageValue = stats.totalValue / stats.totalWallets;
    stats.topWallet = sortedWallets[0];
    stats.bottomWallet = sortedWallets[sortedWallets.length - 1];

    // Вычисляем медиану
    const mid = Math.floor(sortedWallets.length / 2);
    stats.medianValue = sortedWallets.length % 2 === 0
      ? (sortedWallets[mid - 1].totalValue + sortedWallets[mid].totalValue) / 2
      : sortedWallets[mid].totalValue;

    // Распределение по стоимости
    wallets.forEach(wallet => {
      if (wallet.totalValue < 1000) stats.valueDistribution.under1k++;
      else if (wallet.totalValue < 10000) stats.valueDistribution.under10k++;
      else if (wallet.totalValue < 100000) stats.valueDistribution.under100k++;
      else if (wallet.totalValue < 1000000) stats.valueDistribution.under1m++;
      else stats.valueDistribution.over1m++;
    });

    // Распределение по цепочкам
    wallets.forEach(wallet => {
      wallet.chains.forEach(chain => {
        const current = stats.chainsDistribution.get(chain.name) || 0;
        stats.chainsDistribution.set(chain.name, current + 1);
      });
    });

    return stats;
  };

  public filterWallets = (wallets: WalletData[], filters: {
    minValue?: number;
    maxValue?: number;
    chains?: string[];
    tokens?: string[];
  }): WalletData[] => {
    return wallets.filter(wallet => {
      // Фильтр по стоимости
      if (filters.minValue && wallet.totalValue < filters.minValue) return false;
      if (filters.maxValue && wallet.totalValue > filters.maxValue) return false;

      // Фильтр по цепочкам
      if (filters.chains && filters.chains.length > 0) {
        const walletChains = wallet.chains.map(chain => chain.name);
        const hasMatchingChain = filters.chains.some(chain => walletChains.includes(chain));
        if (!hasMatchingChain) return false;
      }

      // Фильтр по токенам
      if (filters.tokens && filters.tokens.length > 0) {
        const walletTokens = wallet.tokens.map(token => token.symbol);
        const hasMatchingToken = filters.tokens.some(token => walletTokens.includes(token));
        if (!hasMatchingToken) return false;
      }

      return true;
    });
  };

  // Новый метод для фильтрации токенов по минимальной и максимальной сумме
  public filterTokensByValue = (wallets: WalletData[], filters: {
    minValue?: number;
    maxValue?: number;
    chains?: string[];
    tokens?: string[];
  }): TokenData[] => {
    const allTokens: TokenData[] = [];
    
    wallets.forEach(wallet => {
      wallet.tokens.forEach(token => {
        let shouldInclude = true;
        
        // Фильтр по минимальной сумме
        if (filters.minValue !== undefined && token.value < filters.minValue) {
          shouldInclude = false;
        }
        
        // Фильтр по максимальной сумме
        if (filters.maxValue !== undefined && token.value > filters.maxValue) {
          shouldInclude = false;
        }
        
        // Фильтр по цепочкам
        if (filters.chains && filters.chains.length > 0) {
          if (!filters.chains.includes(token.chain)) {
            shouldInclude = false;
          }
        }
        
        // Фильтр по токенам
        if (filters.tokens && filters.tokens.length > 0) {
          if (!filters.tokens.includes(token.symbol)) {
            shouldInclude = false;
          }
        }
        
        if (shouldInclude) {
          allTokens.push(token);
        }
      });
    });
    
    return allTokens;
  };

  // Новый метод для фильтрации протоколов по минимальной и максимальной сумме
  public filterProtocolsByValue = (wallets: WalletData[], filters: {
    minValue?: number;
    maxValue?: number;
    chains?: string[];
    protocols?: string[];
  }): ProtocolData[] => {
    const allProtocols: ProtocolData[] = [];
    
    wallets.forEach(wallet => {
      wallet.protocols.forEach(protocol => {
        let shouldInclude = true;
        
        // Фильтр по минимальной сумме
        if (filters.minValue !== undefined && protocol.value < filters.minValue) {
          shouldInclude = false;
        }
        
        // Фильтр по максимальной сумме
        if (filters.maxValue !== undefined && protocol.value > filters.maxValue) {
          shouldInclude = false;
        }
        
        // Фильтр по цепочкам
        if (filters.chains && filters.chains.length > 0) {
          if (!filters.chains.includes(protocol.chain)) {
            shouldInclude = false;
          }
        }
        
        // Фильтр по протоколам
        if (filters.protocols && filters.protocols.length > 0) {
          if (!filters.protocols.includes(protocol.name)) {
            shouldInclude = false;
          }
        }
        
        if (shouldInclude) {
          allProtocols.push(protocol);
        }
      });
    });
    
    return allProtocols;
  };

  public sortWallets = (wallets: WalletData[], sortBy: string, sortOrder: 'asc' | 'desc' = 'desc'): WalletData[] => {
    const sorted = [...wallets];

    sorted.sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortBy) {
        case 'id':
          aValue = a.id;
          bValue = b.id;
          break;
        case 'totalValue':
          aValue = a.totalValue;
          bValue = b.totalValue;
          break;
        case 'change24h':
          aValue = a.change24h;
          bValue = b.change24h;
          break;
        case 'rank':
          aValue = a.rank || Infinity;
          bValue = b.rank || Infinity;
          break;
        case 'age':
          aValue = a.age || 0;
          bValue = b.age || 0;
          break;
        case 'followers':
          aValue = a.followers || 0;
          bValue = b.followers || 0;
          break;
        case 'tier':
          aValue = a.tier || 4;
          bValue = b.tier || 4;
          break;
        case 'lastUpdated':
          aValue = new Date(a.lastUpdated).getTime();
          bValue = new Date(b.lastUpdated).getTime();
          break;
        case 'protocolsValue':
          aValue = a.protocols.reduce((sum, protocol) => sum + protocol.value, 0);
          bValue = b.protocols.reduce((sum, protocol) => sum + protocol.value, 0);
          break;
        default:
          aValue = a.totalValue;
          bValue = b.totalValue;
      }

      // Правильное сравнение для разных типов данных
      let comparison: number;
      
      // Все наши поля - числовые, поэтому используем числовое сравнение
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        comparison = aValue - bValue;
      } else {
        // Fallback для других типов
        comparison = String(aValue).localeCompare(String(bValue));
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return sorted;
  };


  public getProtocolWallets = (wallets: WalletData[], protocolName: string, protocolChain: string): { wallet: WalletData; protocol: ProtocolData }[] => {
    const results: { wallet: WalletData; protocol: ProtocolData }[] = [];
    
    wallets.forEach(wallet => {
      wallet.protocols.forEach(protocol => {
        // Если protocolChain === 'all', ищем по всем сетям, иначе по конкретной сети
        // Используем имя протокола для поиска вместо ID
        if (protocol.name === protocolName && (protocolChain === 'all' || protocol.chain === protocolChain)) {
          results.push({
            wallet,
            protocol
          });
        }
      });
    });
    
    // Если protocolChain === 'all', агрегируем одинаковые кошельки по адресу
    if (protocolChain === 'all') {
      return this.aggregateWalletsByAddress(results);
    }
    
    // Сортируем по убыванию стоимости в протоколе
    return results.sort((a, b) => b.protocol.value - a.protocol.value);
  };

  public getTokenWallets = (wallets: WalletData[], tokenSymbol: string, tokenChain: string): { wallet: WalletData; token: TokenData }[] => {
    const results: { wallet: WalletData; token: TokenData }[] = [];
    
    wallets.forEach(wallet => {
      wallet.tokens.forEach(token => {
        // Если tokenChain === 'all', ищем по всем сетям, иначе по конкретной сети
        if (token.symbol === tokenSymbol && (tokenChain === 'all' || token.chain === tokenChain)) {
          results.push({
            wallet,
            token
          });
        }
      });
    });
    
    // Если tokenChain === 'all', агрегируем одинаковые кошельки по адресу
    if (tokenChain === 'all') {
      return this.aggregateWalletsByAddressForTokens(results);
    }
    
    // Сортируем по убыванию стоимости токена
    return results.sort((a, b) => b.token.value - a.token.value);
  };

  public exportToCSV = (wallets: WalletData[]): string => {
    const headers = [
      'Address',
      'Total Value (USD)',
      '24h Change (USD)',
      'Rank',
      'Age (days)',
      'Followers',
      'Following',
      'Chains Count',
      'Tokens Count',
      'Last Updated'
    ];

    const rows = wallets.map(wallet => [
      wallet.address,
      wallet.totalValue.toFixed(2),
      wallet.change24h.toFixed(2),
      wallet.rank || '',
      wallet.age || '',
      wallet.followers || '',
      wallet.following || '',
      wallet.chains.length,
      wallet.tokens.length,
      wallet.lastUpdated
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  };

  // Агрегация кошельков по адресу для протоколов
  private aggregateWalletsByAddress = (results: { wallet: WalletData; protocol: ProtocolData }[]): { wallet: WalletData; protocol: ProtocolData }[] => {
    const aggregatedMap = new Map<string, { wallet: WalletData; protocol: ProtocolData; chains: string[] }>();
    
    results.forEach(({ wallet, protocol }) => {
      const key = wallet.address;
      
      if (aggregatedMap.has(key)) {
        const existing = aggregatedMap.get(key)!;
        // Суммируем значения протокола
        existing.protocol.value += protocol.value;
        // Добавляем сеть в список если её там еще нет
        if (!existing.chains.includes(protocol.chain)) {
          existing.chains.push(protocol.chain);
        }
      } else {
        // Создаем новую запись
        aggregatedMap.set(key, {
          wallet,
          protocol: {
            ...protocol,
            chains: [protocol.chain] // Список сетей для этого кошелька
          },
          chains: [protocol.chain]
        });
      }
    });
    
    // Преобразуем обратно в нужный формат и сортируем
    return Array.from(aggregatedMap.values())
      .map(({ wallet, protocol, chains }) => ({
        wallet: {
          ...wallet,
          chains: wallet.chains // Оставляем оригинальные сети кошелька
        },
        protocol: {
          ...protocol,
          chains: chains // Используем агрегированный список сетей для протокола
        }
      }))
      .sort((a, b) => b.protocol.value - a.protocol.value);
  };

  // Агрегация кошельков по адресу для токенов
  private aggregateWalletsByAddressForTokens = (results: { wallet: WalletData; token: TokenData }[]): { wallet: WalletData; token: TokenData }[] => {
    const aggregatedMap = new Map<string, { wallet: WalletData; token: TokenData; chains: string[] }>();
    
    results.forEach(({ wallet, token }) => {
      const key = wallet.address;
      
      if (aggregatedMap.has(key)) {
        const existing = aggregatedMap.get(key)!;
        // Суммируем значения токена
        existing.token.balance += token.balance;
        existing.token.value += token.value;
        existing.token.price = existing.token.value / existing.token.balance; // Пересчитываем среднюю цену
        // Добавляем сеть в список если её там еще нет
        if (!existing.chains.includes(token.chain)) {
          existing.chains.push(token.chain);
        }
      } else {
        // Создаем новую запись
        aggregatedMap.set(key, {
          wallet,
          token: {
            ...token,
            chains: [token.chain] // Список сетей для этого кошелька
          },
          chains: [token.chain]
        });
      }
    });
    
    // Преобразуем обратно в нужный формат и сортируем
    return Array.from(aggregatedMap.values())
      .map(({ wallet, token, chains }) => ({
        wallet: {
          ...wallet,
          chains: wallet.chains // Оставляем оригинальные сети кошелька
        },
        token: {
          ...token,
          chains: chains // Используем агрегированный список сетей для токена
        }
      }))
      .sort((a, b) => b.token.value - a.token.value);
  };
} 