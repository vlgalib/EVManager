import { WalletData, AggregatedData, TokenData, ProtocolData } from '../types';
export declare class DataProcessor {
    aggregateWalletsData: (wallets: WalletData[]) => AggregatedData;
    getWalletStats: (wallets: WalletData[]) => {
        totalWallets: number;
        totalValue: number;
        averageValue: number;
        medianValue: number;
        topWallet: WalletData | null;
        bottomWallet: WalletData | null;
        valueDistribution: {
            under1k: number;
            under10k: number;
            under100k: number;
            under1m: number;
            over1m: number;
        };
        chainsDistribution: Map<string, number>;
    };
    filterWallets: (wallets: WalletData[], filters: {
        minValue?: number;
        maxValue?: number;
        chains?: string[];
        tokens?: string[];
    }) => WalletData[];
    filterTokensByValue: (wallets: WalletData[], filters: {
        minValue?: number;
        maxValue?: number;
        chains?: string[];
        tokens?: string[];
    }) => TokenData[];
    filterProtocolsByValue: (wallets: WalletData[], filters: {
        minValue?: number;
        maxValue?: number;
        chains?: string[];
        protocols?: string[];
    }) => ProtocolData[];
    sortWallets: (wallets: WalletData[], sortBy: string, sortOrder?: "asc" | "desc") => WalletData[];
    getProtocolWallets: (wallets: WalletData[], protocolName: string, protocolChain: string) => {
        wallet: WalletData;
        protocol: ProtocolData;
    }[];
    getTokenWallets: (wallets: WalletData[], tokenSymbol: string, tokenChain: string) => {
        wallet: WalletData;
        token: TokenData;
    }[];
    exportToCSV: (wallets: WalletData[]) => string;
    private aggregateWalletsByAddress;
    private aggregateWalletsByAddressForTokens;
}
//# sourceMappingURL=dataProcessor.d.ts.map