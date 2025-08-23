import { ProxyService } from './proxyService';
import { WalletData } from '../types';
export declare class DeBankService {
    private proxyService;
    private logger;
    private cacheService;
    private maxRetries;
    private requestTimeout;
    private cache;
    private cacheTimeout;
    constructor();
    private normalizeAddress;
    getWalletData: (walletAddress: string, forceUpdate?: boolean, walletId?: number) => Promise<WalletData | null>;
    private scrapeWalletData;
    private launchBrowser;
    private processWalletData;
    private delay;
    getProxyStatus: () => {
        total: number;
        working: number;
    };
    getProxyStats: () => {
        total: number;
        working: number;
        failed: number;
        details: {
            host: string;
            port: number;
            protocol: "http" | "https" | "socks4" | "socks5";
            isWorking: boolean;
            isFailed: boolean;
            success: number;
            fails: number;
            successRate: string;
            lastUsed: string;
        }[];
    };
    clearCache: () => void;
    getCacheStats: () => {
        totalEntries: number;
        validEntries: number;
        cacheTimeout: number;
    };
    getProxiesStatus: () => {
        id: string;
        host: string;
        port: number;
        protocol: "http" | "https" | "socks4" | "socks5";
        username: string | undefined;
        status: "working" | "failed" | "unknown";
        responseTime: number | undefined;
        lastChecked: string | undefined;
        errorMessage: string | undefined;
        errorMessageKey: string | undefined;
        country: string | undefined;
    }[];
    checkProxies: () => Promise<void>;
    reloadProxies: () => void;
    getProxyService: () => ProxyService;
}
//# sourceMappingURL=debankService.d.ts.map