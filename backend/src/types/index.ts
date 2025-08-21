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
  priceChange24h?: number;
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
};

export type ProxyConfig = {
  host: string;
  port: number;
  protocol: 'http' | 'https' | 'socks4' | 'socks5';
  username?: string;
  password?: string;
};

export type DeBankApiResponse = {
  user?: any;
  token_balance_list?: any[];
  portfolio_list?: any[] | undefined;
  total_net_curve?: any;
};

export type AggregatedData = {
  totalValue: number;
  totalChange24h: number;
  walletsCount: number;
  topTokens: TokenData[];
  detailedTopTokens: TokenData[];
  topChains: ChainData[];
  topProtocols: ProtocolData[];
  wallets: WalletData[];
}; 