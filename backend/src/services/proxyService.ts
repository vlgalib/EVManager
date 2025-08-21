import fs from 'fs';
import path from 'path';
import { ProxyConfig } from '../types';
import { LoggerService } from './loggerService';

export class ProxyService {
  private proxies: ProxyConfig[] = [];
  private currentIndex = 0;
  private failedProxies = new Set<string>();
  private workingProxies = new Set<string>();
  private proxyStats = new Map<string, { success: number; fails: number; lastUsed: number; responseTime?: number }>();
  private circuitBreakers = new Map<string, { failures: number; lastFailure: number; isOpen: boolean }>();
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5; // Количество ошибок для размыкания
  private readonly CIRCUIT_BREAKER_TIMEOUT = 300000; // 5 минут до попытки восстановления
  private logger: LoggerService;

  constructor() {
    this.logger = LoggerService.getInstance();
    this.loadProxies();
    this.loadGeoIPCache();
    
    // Start cache cleanup timer (clean every 6 hours)
    setInterval(() => this.cleanupGeoIPCache(), 6 * 60 * 60 * 1000);
    
    // Save cache every 10 minutes
    setInterval(() => this.saveGeoIPCache(), 10 * 60 * 1000);
  }

  private loadProxies = (): void => {
    try {
      const proxyFilePath = path.join(process.cwd(), '..', 'data', 'proxy.txt');
      
      if (!fs.existsSync(proxyFilePath)) {
        this.logger.warn('Файл data/proxy.txt не найден. Прокси не будут использоваться.');
        return;
      }

      const proxyContent = fs.readFileSync(proxyFilePath, 'utf-8');
      const proxyLines = proxyContent.split('\n')
        .filter(line => line.trim() && !line.trim().startsWith('#'));

      this.proxies = proxyLines.map(line => this.parseProxyLine(line.trim()));
      
      this.logger.info(`Загружено ${this.proxies.length} прокси`);
    } catch (error) {
      this.logger.error('Ошибка при загрузке прокси', error);
    }
  };

  private parseProxyLine = (line: string): ProxyConfig => {
    // Поддержка различных форматов прокси
    // http://user:pass@host:port
    // socks5://user:pass@host:port
    // host:port
    // user:pass@host:port
    // host:port:user:pass

    let protocol = 'http';
    let host = '';
    let port = 80;
    let username = '';
    let password = '';

    // Подсчитываем количество двоеточий для определения формата
    const colonCount = (line.match(/:/g) || []).length;

    if (line.includes('://')) {
      // Форматы с протоколом: http://user:pass@host:port или socks5://host:port
      const [protocolPart, rest] = line.split('://');
      protocol = protocolPart as 'http' | 'https' | 'socks4' | 'socks5';
      
      if (rest.includes('@')) {
        const [auth, hostPort] = rest.split('@');
        const [user, pass] = auth.split(':');
        username = user;
        password = pass;
        
        const [hostPart, portPart] = hostPort.split(':');
        host = hostPart;
        port = parseInt(portPart) || (protocol === 'https' ? 443 : 80);
      } else {
        const [hostPart, portPart] = rest.split(':');
        host = hostPart;
        port = parseInt(portPart) || (protocol === 'https' ? 443 : 80);
      }
    } else if (line.includes('@')) {
      // Формат: user:pass@host:port
      const [auth, hostPort] = line.split('@');
      const [user, pass] = auth.split(':');
      username = user;
      password = pass;
      
      const [hostPart, portPart] = hostPort.split(':');
      host = hostPart;
      port = parseInt(portPart) || 80;
    } else if (colonCount === 3) {
      // Новый формат: host:port:user:pass
      const parts = line.split(':');
      host = parts[0];
      port = parseInt(parts[1]) || 80;
      username = parts[2];
      password = parts[3];
    } else {
      // Простой формат: host:port
      const [hostPart, portPart] = line.split(':');
      host = hostPart;
      port = parseInt(portPart) || 80;
    }

    return {
      host,
      port,
      protocol: protocol as 'http' | 'https' | 'socks4' | 'socks5',
      username: username || undefined,
      password: password || undefined
    };
  };

  public getNextProxy = (): ProxyConfig | null => {
    if (this.proxies.length === 0) {
      return null;
    }

    // Фильтруем только прокси с авторизацией
    const authProxies = this.proxies.filter(proxy => proxy.username && proxy.password);
    
    if (authProxies.length === 0) {
      this.logger.debug('Нет прокси с авторизацией, используем без прокси');
      return null;
    }

    // Сортируем прокси по надежности (работающие прокси в приоритете)
    const sortedProxies = authProxies.sort((a, b) => {
      const aKey = `${a.protocol}://${a.host}:${a.port}`;
      const bKey = `${b.protocol}://${b.host}:${b.port}`;
      
      const aWorking = this.workingProxies.has(aKey);
      const bWorking = this.workingProxies.has(bKey);
      
      const aFailed = this.failedProxies.has(aKey);
      const bFailed = this.failedProxies.has(bKey);
      
      // Работающие прокси в приоритете
      if (aWorking && !bWorking) return -1;
      if (!aWorking && bWorking) return 1;
      
      // Неудачные прокси в конце
      if (aFailed && !bFailed) return 1;
      if (!aFailed && bFailed) return -1;
      
      // По статистике успешности
      const aStats = this.proxyStats.get(aKey) || { success: 0, fails: 0, lastUsed: 0, responseTime: undefined };
      const bStats = this.proxyStats.get(bKey) || { success: 0, fails: 0, lastUsed: 0, responseTime: undefined };
      
      const aRatio = aStats.success / (aStats.success + aStats.fails) || 0;
      const bRatio = bStats.success / (bStats.success + bStats.fails) || 0;
      
      if (aRatio !== bRatio) return bRatio - aRatio;
      
      // По времени последнего использования (менее используемые в приоритете)
      return aStats.lastUsed - bStats.lastUsed;
    });

    // Берем первый доступный прокси с проверкой circuit breaker
    for (const proxy of sortedProxies) {
      const proxyKey = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      
      // Проверяем circuit breaker
      const breaker = this.circuitBreakers.get(proxyKey);
      if (breaker && breaker.isOpen) {
        // Проверяем, можно ли попробовать снова (прошло достаточно времени)
        if (Date.now() - breaker.lastFailure < this.CIRCUIT_BREAKER_TIMEOUT) {
          this.logger.debug(`Прокси ${proxyKey} пропущен - circuit breaker открыт`);
          continue;
        } else {
          // Переводим в полуоткрытое состояние
          breaker.isOpen = false;
          this.circuitBreakers.set(proxyKey, breaker);
          this.logger.debug(`Circuit breaker для ${proxyKey} переведен в полуоткрытое состояние`);
        }
      }
      
      // Update statistics использования
      const stats = this.proxyStats.get(proxyKey) || { success: 0, fails: 0, lastUsed: 0, responseTime: undefined };
      stats.lastUsed = Date.now();
      this.proxyStats.set(proxyKey, stats);
      
      this.logger.debug(`Выбран прокси: ${proxy.host}:${proxy.port} (работающий: ${this.workingProxies.has(proxyKey)}, неудачный: ${this.failedProxies.has(proxyKey)})`);
      return proxy;
    }

    // Если все прокси неработающие, сбрасываем список и пробуем снова
    this.failedProxies.clear();
    this.logger.debug('Все прокси неработающие, сбрасываем список неудачных');
    return sortedProxies[0] || null;
  };

  public markProxyAsFailed = (proxy: ProxyConfig): void => {
    const proxyKey = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
    this.failedProxies.add(proxyKey);
    this.workingProxies.delete(proxyKey);
    
    // Update statistics
    const stats = this.proxyStats.get(proxyKey) || { success: 0, fails: 0, lastUsed: 0, responseTime: undefined };
    stats.fails++;
    this.proxyStats.set(proxyKey, stats);
    
    // Обновляем circuit breaker
    const breaker = this.circuitBreakers.get(proxyKey) || { failures: 0, lastFailure: 0, isOpen: false };
    breaker.failures++;
    breaker.lastFailure = Date.now();
    if (breaker.failures >= this.CIRCUIT_BREAKER_THRESHOLD) {
      breaker.isOpen = true;
      this.logger.warn(`Circuit breaker открыт для прокси ${proxyKey} после ${breaker.failures} ошибок`);
    }
    this.circuitBreakers.set(proxyKey, breaker);
    
    this.logger.debug(`Прокси ${proxyKey} помечен как неработающий (успехов: ${stats.success}, неудач: ${stats.fails})`);
  };

  public markProxyAsWorking = (proxy: ProxyConfig): void => {
    const proxyKey = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
    this.failedProxies.delete(proxyKey);
    this.workingProxies.add(proxyKey);
    
    // Update statistics
    const stats = this.proxyStats.get(proxyKey) || { success: 0, fails: 0, lastUsed: 0, responseTime: undefined };
    stats.success++;
    this.proxyStats.set(proxyKey, stats);
    
    // Сбрасываем circuit breaker при успешном использовании
    const breaker = this.circuitBreakers.get(proxyKey) || { failures: 0, lastFailure: 0, isOpen: false };
    breaker.failures = 0;
    breaker.isOpen = false;
    this.circuitBreakers.set(proxyKey, breaker);
    
    this.logger.debug(`Прокси ${proxyKey} помечен как работающий (успехов: ${stats.success}, неудач: ${stats.fails})`);
  };

  public getProxyCount = (): number => {
    const authProxies = this.proxies.filter(proxy => proxy.username && proxy.password);
    return authProxies.length;
  };

  public getWorkingProxyCount = (): number => {
    const authProxies = this.proxies.filter(proxy => proxy.username && proxy.password);
    return authProxies.filter(proxy => {
      const proxyKey = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      return this.workingProxies.has(proxyKey) && !this.failedProxies.has(proxyKey);
    }).length;
  };

  public reloadProxies = (): void => {
    this.proxies = [];
    this.failedProxies.clear();
    this.workingProxies.clear();
    this.proxyStats.clear();
    this.currentIndex = 0;
    this.loadProxies();
    
    // Keep GeoIP cache - don't clear it on proxy reload
    this.logger.debug('Proxies reloaded, keeping GeoIP cache intact');
  };

  public getProxyStats = () => {
    const authProxies = this.proxies.filter(proxy => proxy.username && proxy.password);
    const stats = authProxies.map(proxy => {
      const proxyKey = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      const proxyStats = this.proxyStats.get(proxyKey) || { success: 0, fails: 0, lastUsed: 0 };
      const successRate = proxyStats.success + proxyStats.fails > 0 
        ? (proxyStats.success / (proxyStats.success + proxyStats.fails) * 100).toFixed(1)
        : '0.0';
      
      return {
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol,
        isWorking: this.workingProxies.has(proxyKey),
        isFailed: this.failedProxies.has(proxyKey),
        success: proxyStats.success,
        fails: proxyStats.fails,
        successRate: `${successRate}%`,
        lastUsed: proxyStats.lastUsed > 0 ? new Date(proxyStats.lastUsed).toISOString() : 'never'
      };
    });

    return {
      total: authProxies.length,
      working: this.getWorkingProxyCount(),
      failed: authProxies.length - this.getWorkingProxyCount(),
      details: stats
    };
  };

  // Get country from cached data or return undefined (no pattern matching)
  private getCountryFromIP = (ip: string): string | undefined => {
    // Check if we have cached GeoIP data
    if (this.geoIPCache.has(ip)) {
      const cached = this.geoIPCache.get(ip)!;
      const now = Date.now();
      
      // Check if cache entry is still valid
      if (now - cached.timestamp < this.GEOIP_CACHE_TTL) {
        return cached.country || undefined;
      } else {
        // Remove expired entry and trigger fresh lookup
        this.geoIPCache.delete(ip);
      }
    }
    
    // If no cache, trigger async lookup in background
    this.getCountryFromGeoIP(ip).catch(() => {});
    return undefined;
  };

  // Cache for GeoIP lookups to avoid repeated API calls
  private geoIPCache = new Map<string, { country: string | null; timestamp: number }>();
  private readonly GEOIP_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
  private lastGeoIPRequest = 0;
  private readonly GEOIP_REQUEST_INTERVAL = 5000; // 5 seconds between requests
  private pendingGeoIPRequests = new Set<string>(); // Track pending requests
  private isCheckingProxies = false; // Track proxy checking state

  // Get country from external GeoIP services with fallback and caching
  private getCountryFromGeoIP = async (ip: string): Promise<string | undefined> => {
    // Check cache first with TTL
    if (this.geoIPCache.has(ip)) {
      const cached = this.geoIPCache.get(ip)!;
      const now = Date.now();
      
      // Check if cache entry is still valid
      if (now - cached.timestamp < this.GEOIP_CACHE_TTL) {
        return cached.country || undefined;
      } else {
        // Remove expired entry
        this.geoIPCache.delete(ip);
      }
    }

    // Skip if request is already pending for this IP
    if (this.pendingGeoIPRequests.has(ip)) {
      this.logger.debug(`GeoIP request for ${ip} already pending, skipping`);
      return undefined;
    }

    // Mark as pending
    this.pendingGeoIPRequests.add(ip);

    try {
      // Rate limiting - ensure minimum interval between requests
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastGeoIPRequest;
      if (timeSinceLastRequest < this.GEOIP_REQUEST_INTERVAL) {
        await new Promise(resolve => setTimeout(resolve, this.GEOIP_REQUEST_INTERVAL - timeSinceLastRequest));
      }
      this.lastGeoIPRequest = Date.now();

      const axios = require('axios');
      const services = [
        {
          name: 'ip-api.com',
          url: `http://ip-api.com/json/${ip}?fields=country,status`,
          parseResponse: (data: any) => data?.status === 'success' ? data.country : null
        },
        {
          name: 'ipapi.co',  
          url: `https://ipapi.co/${ip}/country_name/`,
          parseResponse: (data: any) => {
            if (typeof data === 'string' && data !== 'Undefined' && !data.includes('rapid requests') && !data.includes('pricing')) {
              return data;
            }
            return null;
          }
        },
        {
          name: 'ipwhois.app',
          url: `http://ipwhois.app/json/${ip}?fields=country`,
          parseResponse: (data: any) => data?.country || null
        }
      ];

      for (const service of services) {
        try {
          this.logger.debug(`Trying GeoIP service: ${service.name} for IP ${ip}`);
          
          const response = await axios.get(service.url, {
            timeout: 10000,
            headers: { 'User-Agent': 'EVManager/1.0' },
            validateStatus: (status: number) => status < 500 // Accept 4xx but retry on 5xx
          });

          const country = service.parseResponse(response.data);
          if (country && country.trim()) {
            this.logger.debug(`✓ Got country '${country}' for IP ${ip} from ${service.name}`);
            this.geoIPCache.set(ip, { country, timestamp: Date.now() });
            
            // Save cache immediately after successful lookup
            this.saveGeoIPCache();
            
            return country;
          }
        } catch (error: any) {
          this.logger.debug(`✗ Failed to get country for IP ${ip} from ${service.name}: ${error.message}`);
          
          // If rate limited (429), wait longer before next service but don't cache the error
          if (error.response?.status === 429) {
            this.logger.debug(`Rate limited by ${service.name}, waiting 10 seconds`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            continue;
          }
          
          // If server error (5xx), try next service
          if (error.response?.status >= 500) {
            continue;
          }
        }
        
        // Longer delay between service attempts to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      this.logger.debug(`Failed to get country for IP ${ip} from all services`);
      // Don't cache rate limiting errors - allow retry later
      // Only cache true failures (not rate limits)
      
      return undefined;
    } finally {
      // Always remove from pending requests
      this.pendingGeoIPRequests.delete(ip);
    }
  };

  // Получить статус всех прокси с подробной информацией
  public getProxiesStatus = () => {
    const authProxies = this.proxies.filter(proxy => proxy.username && proxy.password);
    return authProxies.map((proxy, index) => {
      const proxyKey = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      const proxyStats = this.proxyStats.get(proxyKey) || { success: 0, fails: 0, lastUsed: 0, responseTime: undefined };
      
      let status: 'working' | 'failed' | 'unknown' = 'unknown';
      if (this.workingProxies.has(proxyKey)) {
        status = 'working';
      } else if (this.failedProxies.has(proxyKey)) {
        status = 'failed';
      }

      return {
        id: `proxy-${index}`,
        host: proxy.host,
        port: proxy.port,
        protocol: proxy.protocol as 'http' | 'https' | 'socks4' | 'socks5',
        username: proxy.username,
        status,
        responseTime: proxyStats.responseTime, // Используем сохраненное время отклика
        lastChecked: proxyStats.lastUsed > 0 ? new Date(proxyStats.lastUsed).toISOString() : undefined,
        errorMessage: this.failedProxies.has(proxyKey) ? 'Прокси не отвечает' : undefined,
        errorMessageKey: this.failedProxies.has(proxyKey) ? 'notification.proxyNotResponding' : undefined,
        country: this.getCountryFromIP(proxy.host)
      };
    });
  };

  // Проверить все прокси
  public checkAllProxies = async () => {
    if (this.isCheckingProxies) {
      this.logger.info('Proxy check already in progress, skipping request');
      return;
    }

    this.isCheckingProxies = true;
    
    try {
      const authProxies = this.proxies.filter(proxy => proxy.username && proxy.password);
      this.logger.info(`Starting check of ${authProxies.length} proxies`);

    // Сортируем прокси по приоритету: 1. Непроверенные, 2. Неработающие, 3. Работающие
    const sortedProxies = authProxies.sort((a, b) => {
      const aKey = `${a.protocol}://${a.host}:${a.port}`;
      const bKey = `${b.protocol}://${b.host}:${b.port}`;
      
      const aIsWorking = this.workingProxies.has(aKey);
      const bIsWorking = this.workingProxies.has(bKey);
      const aIsFailed = this.failedProxies.has(aKey);
      const bIsFailed = this.failedProxies.has(bKey);
      
      // Определяем статус каждого прокси
      const getStatus = (isWorking: boolean, isFailed: boolean) => {
        if (!isWorking && !isFailed) return 0; // Непроверенный
        if (isFailed && !isWorking) return 1;  // Неработающий
        if (isWorking && !isFailed) return 2;  // Работающий
        return 3; // Неопределенный статус
      };
      
      const aStatus = getStatus(aIsWorking, aIsFailed);
      const bStatus = getStatus(bIsWorking, bIsFailed);
      
      return aStatus - bStatus;
    });

    // Подсчитываем количество прокси в каждой категории
    const unchecked = sortedProxies.filter(proxy => {
      const key = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      return !this.workingProxies.has(key) && !this.failedProxies.has(key);
    }).length;
    
    const failed = sortedProxies.filter(proxy => {
      const key = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      return this.failedProxies.has(key) && !this.workingProxies.has(key);
    }).length;
    
    const working = sortedProxies.filter(proxy => {
      const key = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      return this.workingProxies.has(key) && !this.failedProxies.has(key);
    }).length;

    this.logger.info(`Prioritization: ${unchecked} unchecked → ${failed} failed → ${working} working`);

    for (const proxy of sortedProxies) {
      const proxyKey = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      
      try {
        this.logger.debug(`Проверяем прокси: ${proxy.host}:${proxy.port}`);
        const startTime = Date.now();
        
        // Проверка доступности прокси через axios
        const axios = require('axios');
        const proxyUrl = `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
        
        const response = await axios.get('http://httpbin.org/ip', {
          httpsAgent: this.getProxyAgent(proxy),
          httpAgent: this.getProxyAgent(proxy),
          timeout: 10000, // 10 секунд таймаут
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });

        const responseTime = Date.now() - startTime;
        
        if (response.status === 200) {
          this.workingProxies.add(proxyKey);
          this.failedProxies.delete(proxyKey);
          const stats = this.proxyStats.get(proxyKey) || { success: 0, fails: 0, lastUsed: 0, responseTime: undefined };
          stats.success++;
          stats.lastUsed = Date.now();
          stats.responseTime = responseTime; // Сохраняем время отклика
          this.proxyStats.set(proxyKey, stats);
          
          // Trigger GeoIP lookup in background for better country detection (with delay)
          setTimeout(() => {
            this.getCountryFromGeoIP(proxy.host).catch(() => {});
          }, Math.random() * 10000); // Random delay up to 10 seconds
          
          this.logger.debug(`✓ Прокси ${proxy.host}:${proxy.port} работает (${responseTime}ms)`);
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        this.failedProxies.add(proxyKey);
        this.workingProxies.delete(proxyKey);
        const stats = this.proxyStats.get(proxyKey) || { success: 0, fails: 0, lastUsed: 0, responseTime: undefined };
        stats.fails++;
        stats.lastUsed = Date.now();
        stats.responseTime = undefined; // Сбрасываем время отклика при ошибке
        this.proxyStats.set(proxyKey, stats);
        this.logger.debug(`✗ Прокси ${proxy.host}:${proxy.port} не работает: ${error}`);
      }

      // Увеличенная задержка между проверками прокси для предотвращения блокировок и rate limiting
      const proxyCheckDelay = 3000 + Math.random() * 5000; // 3-8 секунд
      await new Promise(resolve => setTimeout(resolve, proxyCheckDelay));
    }

      const workingCount = this.getWorkingProxyCount();
      this.logger.info(`Проверка завершена. Работающих прокси: ${workingCount}/${authProxies.length}`);
    } catch (error) {
      this.logger.error('Ошибка при проверке прокси:', error);
    } finally {
      this.isCheckingProxies = false;
    }
  };

  // Получить прокси агент для HTTP запросов
  private getProxyAgent = (proxy: ProxyConfig) => {
    try {
      if (proxy.protocol === 'http' || proxy.protocol === 'https') {
        const { HttpsProxyAgent } = require('https-proxy-agent');
        const { HttpProxyAgent } = require('http-proxy-agent');
        const proxyUrl = `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
        return proxy.protocol === 'https' ? new HttpsProxyAgent(proxyUrl) : new HttpProxyAgent(proxyUrl);
      } else {
        const { SocksProxyAgent } = require('socks-proxy-agent');
        const proxyUrl = `${proxy.protocol}://${proxy.username}:${proxy.password}@${proxy.host}:${proxy.port}`;
        return new SocksProxyAgent(proxyUrl);
      }
    } catch (error) {
      this.logger.error(`Ошибка создания прокси агента для ${proxy.host}:${proxy.port}`, error);
      throw error;
    }
  };

  // Get proxy checking status
  public isProxyCheckingInProgress = (): boolean => {
    return this.isCheckingProxies;
  };

  // Check only unchecked proxies in background
  public checkUncheckedProxies = async (): Promise<void> => {
    if (this.isCheckingProxies) {
      this.logger.debug('Proxy checking already in progress, skipping unchecked proxy check');
      return;
    }

    const authProxies = this.proxies.filter(proxy => proxy.username && proxy.password);
    const uncheckedProxies = authProxies.filter(proxy => {
      const key = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
      return !this.workingProxies.has(key) && !this.failedProxies.has(key);
    });

    if (uncheckedProxies.length === 0) {
      this.logger.debug('No unchecked proxies found');
      return;
    }

    this.logger.info(`Background check: ${uncheckedProxies.length} unchecked proxies`);
    this.isCheckingProxies = true;

    try {
      // Check only a few unchecked proxies at a time to avoid overwhelming
      const batchSize = Math.min(5, uncheckedProxies.length);
      const batch = uncheckedProxies.slice(0, batchSize);

      for (const proxy of batch) {
        const proxyKey = `${proxy.protocol}://${proxy.host}:${proxy.port}`;
        
        try {
          this.logger.debug(`Background checking proxy: ${proxy.host}:${proxy.port}`);
          const startTime = Date.now();
          
          const axios = require('axios');
          const response = await axios.get('http://httpbin.org/ip', {
            httpsAgent: this.getProxyAgent(proxy),
            httpAgent: this.getProxyAgent(proxy),
            timeout: 10000,
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });

          const responseTime = Date.now() - startTime;
          
          if (response.status === 200) {
            this.workingProxies.add(proxyKey);
            this.failedProxies.delete(proxyKey);
            const stats = this.proxyStats.get(proxyKey) || { success: 0, fails: 0, lastUsed: 0, responseTime: undefined };
            stats.success++;
            stats.lastUsed = Date.now();
            stats.responseTime = responseTime;
            this.proxyStats.set(proxyKey, stats);
            
            // Background GeoIP lookup
            setTimeout(() => {
              this.getCountryFromGeoIP(proxy.host).catch(() => {});
            }, Math.random() * 5000);
            
            this.logger.debug(`✓ Background proxy check: ${proxy.host}:${proxy.port} working (${responseTime}ms)`);
          } else {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
        } catch (error) {
          this.failedProxies.add(proxyKey);
          this.workingProxies.delete(proxyKey);
          const stats = this.proxyStats.get(proxyKey) || { success: 0, fails: 0, lastUsed: 0, responseTime: undefined };
          stats.fails++;
          stats.lastUsed = Date.now();
          stats.responseTime = undefined;
          this.proxyStats.set(proxyKey, stats);
          this.logger.debug(`✗ Background proxy check: ${proxy.host}:${proxy.port} failed: ${error}`);
        }

        // Delay between background checks (longer than manual checks)
        const backgroundDelay = 5000 + Math.random() * 5000; // 5-10 seconds
        await new Promise(resolve => setTimeout(resolve, backgroundDelay));
      }
    } catch (error) {
      this.logger.error('Error during background proxy check:', error);
    } finally {
      this.isCheckingProxies = false;
    }
  };

  // Clean up expired GeoIP cache entries
  private cleanupGeoIPCache = (): void => {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [ip, entry] of this.geoIPCache.entries()) {
      if (now - entry.timestamp >= this.GEOIP_CACHE_TTL) {
        this.geoIPCache.delete(ip);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired GeoIP cache entries`);
    }
  };

  // Load GeoIP cache from persistent storage
  private loadGeoIPCache = (): void => {
    try {
      const geoIPCacheFilePath = path.join(process.cwd(), '..', 'data', 'geoip_cache.json');
      
      if (!fs.existsSync(geoIPCacheFilePath)) {
        this.logger.debug('GeoIP cache file not found, starting with empty cache');
        return;
      }

      const cacheContent = fs.readFileSync(geoIPCacheFilePath, 'utf-8');
      const cacheData = JSON.parse(cacheContent);
      
      // Convert back to Map with timestamp validation
      const now = Date.now();
      let loadedCount = 0;
      let expiredCount = 0;
      
      for (const [ip, entry] of Object.entries(cacheData)) {
        const cacheEntry = entry as { country: string | null; timestamp: number };
        
        // Only load non-expired entries
        if (now - cacheEntry.timestamp < this.GEOIP_CACHE_TTL) {
          this.geoIPCache.set(ip, cacheEntry);
          loadedCount++;
        } else {
          expiredCount++;
        }
      }
      
      this.logger.info(`Loaded ${loadedCount} GeoIP cache entries (${expiredCount} expired entries skipped)`);
    } catch (error) {
      this.logger.error('Error loading GeoIP cache', error);
    }
  };

  // Save GeoIP cache to persistent storage
  private saveGeoIPCache = (): void => {
    try {
      const geoIPCacheFilePath = path.join(process.cwd(), '..', 'data', 'geoip_cache.json');
      
      // Convert Map to Object for JSON serialization
      const cacheData: Record<string, { country: string | null; timestamp: number }> = {};
      
      for (const [ip, entry] of this.geoIPCache.entries()) {
        cacheData[ip] = entry;
      }
      
      // Ensure data directory exists
      const dataDir = path.join(process.cwd(), '..', 'data');
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
      
      fs.writeFileSync(geoIPCacheFilePath, JSON.stringify(cacheData, null, 2));
      this.logger.debug(`Saved ${Object.keys(cacheData).length} GeoIP cache entries`);
    } catch (error) {
      this.logger.error('Error saving GeoIP cache', error);
    }
  };
} 