import { WalletData } from '../types';
interface StoredWalletData extends WalletData {
    lastUpdated: string;
    fetchedAt: string;
}
interface WalletMetadata {
    totalWallets: number;
    lastFetch: string;
    version: string;
}
type WalletDatabase = {
    [address: string]: StoredWalletData;
} & {
    _metadata?: WalletMetadata;
};
export declare class CacheService {
    private static instance;
    private dbPath;
    private database;
    constructor();
    static getInstance(): CacheService;
    private loadDatabase;
    private saveDatabase;
    private normalizeAddress;
    getWallet(address: string): WalletData | null;
    setWallet(address: string, data: WalletData): void;
    batchUpdateWallets(updates: Array<{
        address: string;
        data: WalletData;
    }>): void;
    private removeOldDuplicateAddresses;
    removeWallet(address: string): void;
    getAllWallets(): WalletData[];
    getCachedAddresses(): string[];
    clearOldData(): number;
    clearAll(): void;
    getStats(): {
        total: number;
        lastFetch: string;
        dbSize: string;
    };
    getWalletInfo(address: string): {
        data: WalletData;
        fetchedAt: string;
    } | null;
    exportDatabase(): WalletDatabase;
    importDatabase(data: WalletDatabase): void;
    deduplicateWallets(): {
        removed: number;
        updated: number;
    };
    updateWalletIds(walletIdMapping: Map<string, number>): {
        updated: number;
    };
}
export {};
//# sourceMappingURL=cacheService.d.ts.map