export type WalletData = {
  id: number;
  address: string;
  totalValue: number;
  change24h: number;
  rank?: number;
  age?: number;
  followers?: number;
  following?: number;
  tier?: number;
  chains: ChainData[];
  tokens: TokenData[];
  protocols: ProtocolData[];
  lastUpdated: string;
};

export type ChainData = {
  name: string;
  value: number;
  tokens: TokenData[];
};

export type TokenData = {
  symbol: string;
  name: string;
  balance: number;
  value: number;
  price: number;
  chain: string;
  logo?: string;
  address?: string;
  chains?: string[]; // Массив сетей для агрегированных токенов
};

export type ProtocolData = {
  id: string;
  name: string;
  value: number;
  chain: string;
  category: string;
  logo?: string;
  chains?: string[]; // Массив сетей для агрегированных протоколов
  tokens?: ProtocolToken[]; // Токены внутри протокола
};

export type ProtocolToken = {
  symbol: string;
  name: string;
  value: number;
  amount: number;
  logo?: string;
  category?: string; // lending, liquidity, staking, etc.
};

export type AggregatedData = {
  totalValue: number;
  totalChange24h: number;
  walletsCount: number;
  topTokens: TokenData[];
  topChains: ChainData[];
  topProtocols: ProtocolData[];
  wallets: WalletData[];
};

export type ProcessingProgress = {
  current: number;
  total: number;
  startTime?: string;
  estimatedFinish?: string;
  averageTimePerWallet?: number;
};

export type ServerStatus = {
  status: string;
  walletsCount: number;
  processedWalletsCount: number;
  walletsInDatabase: number;
  isProcessing: boolean;
  processingProgress?: ProcessingProgress;
  database: {
    total: number;
    lastFetch: string;
    size: string;
  };
  offlineMode: boolean;
  proxyStatus: {
    currentProxy: string;
    totalProxies: number;
    workingProxies: number;
  };
  loggerStats?: {
    totalLogs: number;
    totalDebugData: number;
    debugMode: boolean;
  };
};

export type FilterOptions = {
  minValue?: number;
  maxValue?: number;
  chains?: string[];
  protocols?: string[];
  selectedToken?: string;
  selectedProtocol?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
};

export type ChartData = {
  name: string;
  value: number;
  percentage?: number;
  color?: string;
};

export type TabType = 'overview' | 'wallets' | 'tokens' | 'protocols' | 'proxies' | 'debug' | 'tiers';

export type ProxyStatus = 'working' | 'failed' | 'checking' | 'unknown';

export type ProxyData = {
  id: string;
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  username?: string;
  password?: string;
  status: ProxyStatus;
  responseTime?: number;
  lastChecked?: string;
  errorMessage?: string;
  errorMessageKey?: string;
  country?: string;
}; 