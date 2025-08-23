import { ProxyConfig } from '../types';
export declare class ProxyService {
    private proxies;
    private currentIndex;
    private failedProxies;
    private workingProxies;
    private proxyStats;
    private circuitBreakers;
    private readonly CIRCUIT_BREAKER_THRESHOLD;
    private readonly CIRCUIT_BREAKER_TIMEOUT;
    private lastCheckDate;
    private logger;
    constructor();
    private loadProxies;
    private parseProxyLine;
    getNextProxy: () => ProxyConfig | null;
    markProxyAsFailed: (proxy: ProxyConfig) => void;
    markProxyAsWorking: (proxy: ProxyConfig) => void;
    getProxyCount: () => number;
    getWorkingProxyCount: () => number;
    reloadProxies: () => void;
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
    private getCountryFromIP;
    private geoIPCache;
    private readonly GEOIP_CACHE_TTL;
    private lastGeoIPRequest;
    private readonly GEOIP_REQUEST_INTERVAL;
    private pendingGeoIPRequests;
    private isCheckingProxies;
    private getCountryFromGeoIP;
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
    checkAllProxies: () => Promise<void>;
    private getProxyAgent;
    isProxyCheckingInProgress: () => boolean;
    checkUncheckedProxies: () => Promise<void>;
    private cleanupGeoIPCache;
    private loadGeoIPCache;
    private saveGeoIPCache;
}
//# sourceMappingURL=proxyService.d.ts.map