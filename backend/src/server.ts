import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import fs from 'fs';
import path from 'path';
import { DeBankService } from './services/debankService';
import { DataProcessor } from './services/dataProcessor';
import { WalletData } from './types';
import { LoggerService } from './services/loggerService';
import { CacheService } from './services/cacheService';
import { ProgressBar } from './utils/progressBar';
import { Logo } from './utils/logo';
import { securityManager } from './config/security';
import { configManager } from './config';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: 'http://localhost:5001', // React app
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  const origin = req.headers.origin || '';
  logger.info(`HTTP ${req.method} ${req.url}`, { origin });
  next();
});

// Services
const debankService = new DeBankService();
const dataProcessor = new DataProcessor();
const logger = LoggerService.getInstance();
const cacheService = CacheService.getInstance();

// Data file paths
const DATA_DIR = path.join(__dirname, '../../data');
const WALLETS_DATA_FILE = path.join(DATA_DIR, 'wallets_data.json');
const PROCESSING_STATE_FILE = path.join(DATA_DIR, 'processing_state.json');

// Create data directory if it doesn't exist
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Function to load wallets from file
const loadWalletsFromFile = (): string[] => {
  try {
    const walletsPath = path.join(__dirname, '../../data/wallets.txt');
    logger.debug('Wallet file path', { path: walletsPath });
    
    if (!fs.existsSync(walletsPath)) {
      logger.warn('File data/wallets.txt not found, creating empty file');
      fs.writeFileSync(walletsPath, '');
      return [];
    }
    
    const content = fs.readFileSync(walletsPath, 'utf8');
    const addresses = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0 && line.startsWith('0x'));
    
    logger.info(`Loaded ${addresses.length} wallet addresses from file`);
    logger.debug('Wallet addresses', { addresses });
    
    return addresses;
  } catch (error) {
    logger.error('Error loading wallets from file', error);
    return [];
  }
};

// Function to save wallet data to JSON file
const saveWalletsData = (walletsData: WalletData[]): void => {
  try {
    const dataToSave = {
      timestamp: Date.now(),
      totalWallets: walletsData.length,
      wallets: walletsData
    };
    
    fs.writeFileSync(WALLETS_DATA_FILE, JSON.stringify(dataToSave, null, 2));
    logger.info(`Data for ${walletsData.length} wallets saved to file`);
  } catch (error) {
    logger.error('Error saving wallet data', error);
  }
};

// Function to load wallet data from JSON file (used only at startup)
const loadWalletsData = (): WalletData[] => {
  try {
    if (!fs.existsSync(WALLETS_DATA_FILE)) {
      logger.info('Wallet data file not found, starting with empty state');
      return [];
    }
    
    const fileContent = fs.readFileSync(WALLETS_DATA_FILE, 'utf8');
    const data = JSON.parse(fileContent);
    
    logger.info(`Loaded ${data.wallets.length} wallets from data file`);
    return data.wallets || [];
  } catch (error) {
    logger.error('Error loading wallet data', error);
    return [];
  }
};

// Function to get current wallet data from DB (fast)
const getCurrentWalletsData = (): WalletData[] => {
  const dbWallets = cacheService.getAllWallets();
  if (dbWallets.length > 0) {
    // IDs are now stored directly in DB, no need to assign dynamically
    return dbWallets;
  }
  // If DB is empty, load from file as fallback
  return loadWalletsData();
};

// Function to cleanup old data on startup
const cleanupOldData = (): void => {
  try {
    // Remove old data files
    if (fs.existsSync(WALLETS_DATA_FILE)) {
      fs.unlinkSync(WALLETS_DATA_FILE);
      logger.info('Old wallet data removed');
    }
    
    if (fs.existsSync(PROCESSING_STATE_FILE)) {
      fs.unlinkSync(PROCESSING_STATE_FILE);
      logger.info('Old processing state removed');
    }
    
    logger.info('Old data cleanup completed');
  } catch (error) {
    logger.error('Error cleaning up old data', error);
  }
};

// Function to save processing state
const saveProcessingState = (state: { isProcessing: boolean; progress: { current: number; total: number } | null }): void => {
  try {
    const stateToSave = {
      ...state,
      timestamp: Date.now()
    };
    
    fs.writeFileSync(PROCESSING_STATE_FILE, JSON.stringify(stateToSave, null, 2));
  } catch (error) {
    logger.error('Error saving processing state', error);
  }
};

// In-memory storage
let walletsData: WalletData[] = [];
let isProcessing = false;
let processingProgress: { 
  current: number; 
  total: number; 
  startTime?: string;
  estimatedFinish?: string;
  averageTimePerWallet?: number;
} | null = null;

// API Routes

// Root route for service health and to avoid 404 when requesting /
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'DeBank-Pro backend running',
    api: '/api/status'
  });
});

// Favicon stub to avoid 404 spam
app.get('/favicon.ico', (req, res) => res.status(204).end());

// Cache wallet file data for status (updated once per minute)
let statusCacheWallets: { count: number; lastUpdate: number } | null = null;

// Get server status
app.get('/api/status', (req, res) => {
  const proxyStatus = debankService.getProxyStatus();
  const proxyStats = debankService.getProxyStats();
  const loggerStats = logger.getStats();
  const cacheStats = debankService.getCacheStats();
  const dbStats = cacheService.getStats();
  
  // Get total wallet count with caching (updated once per minute)
  let totalWallets: number;
  const now = Date.now();
  if (!statusCacheWallets || (now - statusCacheWallets.lastUpdate) > 60000) { // 60 seconds
    const rawWallets = loadWalletsFromFile();
    const normalizedWallets = rawWallets
      .map(addr => normalizeAddress(addr))
      .filter((addr, index, arr) => arr.indexOf(addr) === index);
    statusCacheWallets = {
      count: normalizedWallets.length,
      lastUpdate: now
    };
  }
  totalWallets = statusCacheWallets.count;
  
  // Check for data files
  const hasDataFile = fs.existsSync(WALLETS_DATA_FILE);
  const hasStateFile = fs.existsSync(PROCESSING_STATE_FILE);
  
  // Get data file size
  let dataFileSize = 0;
  if (hasDataFile) {
    try {
      const stats = fs.statSync(WALLETS_DATA_FILE);
      dataFileSize = stats.size;
    } catch (error) {
      logger.error('Error getting data file size', error);
    }
  }
  
  // Check internet availability (simple check)
  const hasInternetConnection = true; // Assume available, could add real check
  
  // Get wallet count in DB (cache)
  const walletsInDatabase = cacheService.getAllWallets().length;
  
  res.json({
    status: 'running',
    walletsCount: totalWallets, // Total count from file
    processedWalletsCount: walletsData.length, // Count in memory (current session)
    walletsInDatabase: walletsInDatabase, // Count in DB/cache
    isProcessing,
    processingProgress, // Add processing progress
    dataFiles: {
      hasDataFile,
      hasStateFile,
      dataFileSize: `${(dataFileSize / 1024 / 1024).toFixed(2)} MB`
    },
    database: {
      total: dbStats.total,
      lastFetch: dbStats.lastFetch,
      size: dbStats.dbSize
    },
    offlineMode: !hasInternetConnection,
    proxyStatus,
    proxyStats,
    loggerStats,
    cacheStats
  });
});

// Get all wallet data
// Get all wallets - changed to GET for REST compliance
app.get('/api/wallets', (req, res) => {
  try {
    const { sortBy = 'totalValue', sortOrder = 'desc', limit, offset } = req.query;
    
    // Get data from DB (cache) - faster than from file
    walletsData = cacheService.getAllWallets();
    
    let sortedWallets = dataProcessor.sortWallets(
      walletsData, 
      sortBy as string, 
      sortOrder as 'asc' | 'desc'
    );

    // Pagination support for large datasets
    if (limit && typeof limit === 'string') {
      const limitNum = parseInt(limit, 10);
      const offsetNum = offset && typeof offset === 'string' ? parseInt(offset, 10) : 0;
      const startIndex = offsetNum;
      const endIndex = startIndex + limitNum;
      sortedWallets = sortedWallets.slice(startIndex, endIndex);
    }

    res.json({
      wallets: sortedWallets,
      total: walletsData.length, // total count
      returned: sortedWallets.length // number returned
    });
  } catch (error) {
    logger.error('Error getting wallets', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get aggregated data for all wallets
app.get('/api/aggregated', (req, res) => {
  try {
    // Get current data from DB (faster than from file)
    walletsData = getCurrentWalletsData();
    
    const aggregated = dataProcessor.aggregateWalletsData(walletsData);
    res.json(aggregated);
  } catch (error) {
    logger.error('Error getting aggregated data', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get aggregated data for selected wallets
app.post('/api/aggregated', (req, res) => {
  try {
    // Get current data from DB (faster than from file)
    walletsData = getCurrentWalletsData();
    
    let filteredWallets = walletsData;
    
    // Filter wallets if selected addresses are passed in request body
    const { wallets: selectedWallets } = req.body;
    if (selectedWallets && Array.isArray(selectedWallets) && selectedWallets.length > 0) {
      const selectedAddresses = selectedWallets.map(addr => addr.trim().toLowerCase());
      filteredWallets = walletsData.filter(wallet => 
        selectedAddresses.includes(wallet.address.toLowerCase())
      );
      logger.info(`Filtering by ${selectedAddresses.length} selected wallets, found ${filteredWallets.length} matches`);
    }
    
    const aggregated = dataProcessor.aggregateWalletsData(filteredWallets);
    res.json(aggregated);
  } catch (error) {
    logger.error('Error getting aggregated data', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get statistics
app.post('/api/stats', (req, res) => {
  try {
    const { selectedWallets } = req.body;
    
    // Get current data from DB (faster than from file)
    walletsData = getCurrentWalletsData();
    
    // If selected wallets are passed, filter by them
    let filteredWallets = walletsData;
    if (selectedWallets && Array.isArray(selectedWallets) && selectedWallets.length > 0) {
      const selectedAddresses = selectedWallets.map(addr => addr.trim().toLowerCase());
      filteredWallets = walletsData.filter(wallet => 
        selectedAddresses.includes(wallet.address.toLowerCase())
      );
    }
    
    const stats = dataProcessor.getWalletStats(filteredWallets);
    res.json(stats);
  } catch (error) {
    logger.error('Error getting statistics', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Filter wallets
app.post('/api/wallets/filter', (req, res) => {
  try {
    const filters = req.body;
    
    // Получаем актуальные данные из БД если в памяти пусто
    if (walletsData.length === 0) {
      walletsData = getCurrentWalletsData();
    }
    
    const filteredWallets = dataProcessor.filterWallets(walletsData, filters);
    
    res.json({
      wallets: filteredWallets,
      total: filteredWallets.length
    });
  } catch (error) {
    logger.error('Error filtering wallets', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Filter tokens by value
app.post('/api/tokens/filter', (req, res) => {
  try {
    const filters = req.body;
    
    // Получаем актуальные данные из БД если в памяти пусто
    if (walletsData.length === 0) {
      walletsData = getCurrentWalletsData();
    }
    
    const filteredTokens = dataProcessor.filterTokensByValue(walletsData, filters);
    
    res.json({
      tokens: filteredTokens,
      total: filteredTokens.length
    });
  } catch (error) {
    logger.error('Error filtering tokens', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Filter protocols by value
app.post('/api/protocols/filter', (req, res) => {
  try {
    const filters = req.body;
    
    // Получаем актуальные данные из БД если в памяти пусто
    if (walletsData.length === 0) {
      walletsData = getCurrentWalletsData();
    }
    
    const filteredProtocols = dataProcessor.filterProtocolsByValue(walletsData, filters);
    
    res.json({
      protocols: filteredProtocols,
      total: filteredProtocols.length
    });
  } catch (error) {
    logger.error('Error filtering protocols', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Export to CSV
app.post('/api/export/csv', async (req, res) => {
  try {
    const { selectedWallets, format = 'csv', batchSize = 1000 } = req.body;
    
    // Получаем актуальные данные из БД если в памяти пусто
    if (walletsData.length === 0) {
      walletsData = getCurrentWalletsData();
    }
    
    // Filter by selected wallets if provided
    let dataToExport = walletsData;
    if (selectedWallets && Array.isArray(selectedWallets) && selectedWallets.length > 0) {
      const selectedAddresses = selectedWallets.map(addr => addr.trim().toLowerCase());
      dataToExport = walletsData.filter(wallet => 
        selectedAddresses.includes(wallet.address.toLowerCase())
      );
      logger.info(`Exporting data for ${selectedAddresses.length} selected wallets`);
    }
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `wallets_data_${timestamp}_${dataToExport.length}_wallets.csv`;
    
    // Для больших объемов используем потоковый экспорт
    if (dataToExport.length > batchSize) {
      logger.info(`Потоковый экспорт ${dataToExport.length} кошельков`);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.setHeader('Transfer-Encoding', 'chunked');
      
      // Отправляем заголовки CSV
      const headers = 'Address,Total Value,Chains Count,Tokens Count,Protocols Count,Last Updated\n';
      res.write(headers);
      
      // Отправляем данные батчами
      for (let i = 0; i < dataToExport.length; i += batchSize) {
        const batch = dataToExport.slice(i, i + batchSize);
        const batchCsv = batch.map(wallet => 
          `"${wallet.address}",${wallet.totalValue},"${wallet.chains?.length || 0}","${wallet.tokens?.length || 0}","${wallet.protocols?.length || 0}","${wallet.lastUpdated}"`
        ).join('\n') + '\n';
        
        res.write(batchCsv);
        
        // Делаем небольшую паузу между батчами чтобы не блокировать event loop
        if (i + batchSize < dataToExport.length) {
          await new Promise(resolve => setImmediate(resolve));
        }
      }
      
      res.end();
    } else {
      // Для малых объемов используем обычный экспорт
      const csvContent = dataProcessor.exportToCSV(dataToExport);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
      res.send(csvContent);
    }
  } catch (error) {
    logger.error('Ошибка при экспорте CSV', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Очистить все данные
app.delete('/api/wallets', (req, res) => {
  try {
    // Очищаем данные в памяти
    walletsData = [];
    
    // Удаляем файл с данными
    if (fs.existsSync(WALLETS_DATA_FILE)) {
      fs.unlinkSync(WALLETS_DATA_FILE);
      logger.info('Файл с данными кошельков удален');
    }
    
    // Сохраняем пустой массив в файл данных
    saveWalletsData([]);
    
    // Очищаем кеш БД
    cacheService.clearAll();
    logger.info('Кеш БД очищен');
    
    // Очищаем состояние обработки
    isProcessing = false;
    processingProgress = null;
    
    logger.info('Все данные кошельков очищены');
    res.json({ message: 'All data cleared', walletsCount: 0 });
  } catch (error) {
    logger.error('Ошибка при очистке данных', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete specific wallets from database
app.delete('/api/wallets/delete', (req, res) => {
  try {
    const { addresses } = req.body;
    
    if (!addresses || !Array.isArray(addresses) || addresses.length === 0) {
      return res.status(400).json({ error: 'Invalid addresses array' });
    }

    logger.info(`Deleting ${addresses.length} wallets from database`);

    // Remove wallets from memory
    const initialCount = walletsData.length;
    walletsData = walletsData.filter(wallet => !addresses.includes(wallet.address));
    const deletedCount = initialCount - walletsData.length;

    // Save updated data to file
    saveWalletsData(walletsData);

    // Remove from cache
    addresses.forEach(address => {
      cacheService.removeWallet(address);
    });

    logger.info(`Successfully deleted ${deletedCount} wallets from database`);
    
    res.json({ 
      message: `Successfully deleted ${deletedCount} wallets`,
      deletedCount,
      remainingCount: walletsData.length 
    });
  } catch (error) {
    logger.error('Error deleting wallets', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить данные конкретного кошелька
app.get('/api/wallets/:address', (req, res) => {
  try {
    const { address } = req.params;
    
    // Получаем актуальные данные из БД если в памяти пусто
    if (walletsData.length === 0) {
      walletsData = getCurrentWalletsData();
    }
    
    const normalizedSearchAddress = normalizeAddress(address);
    const wallet = walletsData.find(w => normalizeAddress(w.address) === normalizedSearchAddress);
    
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }
    
    res.json(wallet);
  } catch (error) {
    logger.error('Ошибка при получении кошелька', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить логи системы
app.post('/api/logs', (req, res) => {
  try {
    const { level, limit, walletAddress } = req.body;
    const logs = logger.getLogs(level, limit);
    
    // Фильтруем логи по адресу кошелька если указан
    let filteredLogs = logs;
    if (walletAddress) {
      filteredLogs = logs.filter(log => 
        log.message && log.message.includes(walletAddress)
      );
    }
    
    res.json({ 
      logs: filteredLogs,
      total: logs.length,
      filtered: filteredLogs.length
    });
  } catch (error) {
    logger.error('Ошибка при получении логов', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить отладочную информацию
app.post('/api/debug', (req, res) => {
  try {
    const { walletAddress, includeSystemInfo = false } = req.body;
    const debugData = logger.getDebugData(walletAddress);
    
    // Добавляем системную информацию если запрошена
    let result: any = { debugData };
    if (includeSystemInfo) {
      result.systemInfo = {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        memoryUsage: process.memoryUsage(),
        walletsInMemory: walletsData.length,
        isProcessing
      };
    }
    
    res.json(result);
  } catch (error) {
    logger.error('Ошибка при получении отладочной информации', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Управление режимом отладки
app.post('/api/debug/mode', (req, res) => {
  try {
    const { enabled } = req.body;
    logger.setDebugMode(enabled);
    res.json({ message: `Режим отладки ${enabled ? 'включен' : 'выключен'}` });
  } catch (error) {
    logger.error('Ошибка при изменении режима отладки', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Очистить логи
app.delete('/api/logs', (req, res) => {
  try {
    const { walletAddress } = req.query;
    if (walletAddress) {
      logger.clearDebugData(walletAddress as string);
    } else {
      logger.clearLogs();
      logger.clearDebugData();
    }
    res.json({ message: 'Логи очищены' });
  } catch (error) {
    logger.error('Ошибка при очистке логов', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Очистить кэш
app.delete('/api/cache', (req, res) => {
  try {
    debankService.clearCache();
    res.json({ message: 'Кэш очищен' });
  } catch (error) {
    logger.error('Ошибка при очистке кэша', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Проверить и удалить дубликаты в БД
app.post('/api/database/deduplicate', (req, res) => {
  try {
    logger.info('Запуск ручной дедупликации БД...');
    const result = cacheService.deduplicateWallets();
    
    // Обновляем данные в памяти после дедупликации
    if (result.removed > 0 || result.updated > 0) {
      walletsData = getCurrentWalletsData();
    }
    
    res.json({
      message: result.removed > 0 || result.updated > 0 
        ? `Дедупликация завершена: удалено ${result.removed} дубликатов, обновлено ${result.updated} записей`
        : 'Дубликаты не найдены',
      removed: result.removed,
      updated: result.updated,
      totalWallets: cacheService.getStats().total
    });
  } catch (error) {
    logger.error('Ошибка при дедупликации БД', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Очистить все данные и файлы
app.delete('/api/data', (req, res) => {
  try {
    walletsData = [];
    
    // Удаляем файлы данных
    if (fs.existsSync(WALLETS_DATA_FILE)) {
      fs.unlinkSync(WALLETS_DATA_FILE);
      logger.info('Файл с данными кошельков удален');
    }
    
    if (fs.existsSync(PROCESSING_STATE_FILE)) {
      fs.unlinkSync(PROCESSING_STATE_FILE);
      logger.info('Файл состояния обработки удален');
    }
    
    // Очищаем кэш
    debankService.clearCache();
    
    res.json({ message: 'Все данные и файлы очищены' });
  } catch (error) {
    logger.error('Ошибка при очистке данных', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Обновить ID всех кошельков в БД
app.post('/api/database/update-ids', (req, res) => {
  try {
    logger.info('Запуск ручного обновления ID кошельков...');
    
    const originalWallets = loadWalletsFromFile();
    const walletIdMapping = new Map<string, number>();
    
    // Get maximum ID from existing wallets in database
    const existingWallets = cacheService.getAllWallets();
    const maxExistingId = existingWallets.length > 0 ? Math.max(...existingWallets.map(w => w.id || 0)) : 0;
    logger.info(`Maximum existing ID in database: ${maxExistingId}`);
    
    // Assign IDs to new wallets, starting from maxExistingId + 1
    let nextId = maxExistingId + 1;
    originalWallets.forEach((address) => {
      const normalizedAddress = normalizeAddress(address);
      // Check if wallet with this address already exists in database
      const existingWallet = existingWallets.find(w => normalizeAddress(w.address) === normalizedAddress);
      
      if (existingWallet) {
        // Use existing ID
        walletIdMapping.set(normalizedAddress, existingWallet.id);
      } else {
        // Assign new ID
        walletIdMapping.set(normalizedAddress, nextId);
        nextId++;
      }
    });
    
    const result = cacheService.updateWalletIds(walletIdMapping);
    
    // Обновляем данные в памяти после обновления ID
    if (result.updated > 0) {
      walletsData = getCurrentWalletsData();
    }
    
    res.json({
      message: result.updated > 0 
        ? `ID update completed: updated ${result.updated} wallets`
        : 'All wallet IDs are already correct',
      updated: result.updated,
      totalWallets: cacheService.getStats().total
    });
  } catch (error) {
    logger.error('Error updating wallet IDs', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Получить кошельки, хранящие конкретный протокол
app.get('/api/protocols/:id/wallets', (req, res) => {
  try {
    const { id: protocolId } = req.params;
    const { chain, selectedWallets, offset, limit } = req.query;
    
    if (!protocolId || !chain) {
      return res.status(400).json({ error: 'Не указаны protocolId или chain' });
    }
    
    // Получаем актуальные данные из БД
    walletsData = getCurrentWalletsData();
    let walletsToAnalyze = walletsData;
    
    // Filter by selected wallets if provided
    if (selectedWallets && Array.isArray(JSON.parse(selectedWallets as string))) {
      const selectedAddresses = JSON.parse(selectedWallets as string).map((addr: string) => addr.trim().toLowerCase());
      walletsToAnalyze = walletsData.filter(wallet => 
        selectedAddresses.includes(wallet.address.toLowerCase())
      );
    }
    
    const protocolWallets = dataProcessor.getProtocolWallets(walletsToAnalyze, protocolId, chain as string);
    
    // Пагинация для больших объемов данных
    const offsetNum = parseInt(offset as string || '0');
    const limitNum = parseInt(limit as string || '100'); // По умолчанию 100 кошельков
    const paginatedWallets = protocolWallets.slice(offsetNum, offsetNum + limitNum);
    
    res.json({
      success: true,
      protocol: { id: protocolId, chain },
      wallets: paginatedWallets,
      total: protocolWallets.length,
      offset: offsetNum,
      limit: limitNum,
      hasMore: offsetNum + limitNum < protocolWallets.length
    });
  } catch (error) {
    console.error('Ошибка получения кошельков протокола:', error);
    res.status(500).json({ error: 'Ошибка получения данных' });
  }
});

// Получить кошельки, хранящие конкретный токен
app.get('/api/tokens/:symbol/wallets', (req, res) => {
  try {
    const { symbol: tokenSymbol } = req.params;
    const { chain, selectedWallets, offset, limit } = req.query;
    
    if (!tokenSymbol || !chain) {
      return res.status(400).json({ error: 'Не указаны tokenSymbol или chain' });
    }
    
    // Получаем актуальные данные из БД
    walletsData = getCurrentWalletsData();
    let walletsToAnalyze = walletsData;
    
    // Filter by selected wallets if provided
    if (selectedWallets && Array.isArray(JSON.parse(selectedWallets as string))) {
      const selectedAddresses = JSON.parse(selectedWallets as string).map((addr: string) => addr.trim().toLowerCase());
      walletsToAnalyze = walletsData.filter(wallet => 
        selectedAddresses.includes(wallet.address.toLowerCase())
      );
    }
    
    const tokenWallets = dataProcessor.getTokenWallets(walletsToAnalyze, tokenSymbol, chain as string);
    
    // Пагинация для больших объемов данных
    const offsetNum = parseInt(offset as string || '0');
    const limitNum = parseInt(limit as string || '100'); // По умолчанию 100 кошельков
    const paginatedWallets = tokenWallets.slice(offsetNum, offsetNum + limitNum);
    
    res.json({
      success: true,
      token: { symbol: tokenSymbol, chain },
      wallets: paginatedWallets,
      total: tokenWallets.length,
      offset: offsetNum,
      limit: limitNum,
      hasMore: offsetNum + limitNum < tokenWallets.length
    });
  } catch (error) {
    console.error('Ошибка получения кошельков токена:', error);
    res.status(500).json({ error: 'Ошибка получения данных' });
  }
});

// Назначить тиры кошелькам по диапазонам ID
app.post('/api/assign-tiers', (req, res) => {
  try {
    const { tier1, tier2, tier3 } = req.body;
    
    if (!tier1 || !tier2 || !tier3) {
      return res.status(400).json({ error: 'Не указаны диапазоны тиров' });
    }

    console.log('📊 Starting tier assignment by ranges:');
    console.log(`🥇 Tier 1: ${tier1.from}-${tier1.to}`);
    console.log(`🥈 Tier 2: ${tier2.from}-${tier2.to}`);
    console.log(`🥉 Tier 3: ${tier3.from}-${tier3.to}`);
    
    let updated = 0;
    const allWallets = cacheService.getAllWallets();
    const batchUpdates: Array<{ address: string; data: WalletData }> = [];
    
    console.log(`Found ${allWallets.length} total wallets in database`);
    
    allWallets.forEach(wallet => {
      let newTier: number | undefined = undefined;
      
      if (wallet.id >= tier1.from && wallet.id <= tier1.to) {
        newTier = 1;
      } else if (wallet.id >= tier2.from && wallet.id <= tier2.to) {
        newTier = 2;
      } else if (wallet.id >= tier3.from && wallet.id <= tier3.to) {
        newTier = 3;
      }
      
      // Debug log for first few wallets
      if (allWallets.indexOf(wallet) < 5) {
        console.log(`Wallet ID ${wallet.id} (${wallet.address.substring(0,8)}...): current tier = ${wallet.tier}, new tier = ${newTier}`);
      }
      
      // Add wallet to batch update if tier needs to be assigned or changed
      if (wallet.tier !== newTier) {
        const updatedWallet = { ...wallet, tier: newTier };
        batchUpdates.push({ address: wallet.address, data: updatedWallet });
        updated++;
        
        if (updated <= 5) {
          console.log(`Will update wallet ID ${wallet.id}: tier ${wallet.tier} -> ${newTier}`);
        }
      }
    });
    
    // Perform batch update only once
    if (batchUpdates.length > 0) {
      cacheService.batchUpdateWallets(batchUpdates);
    }

    console.log(`✅ Tiers updated for ${updated} wallets`);
    
    res.json({
      success: true,
      updated,
      messageKey: 'notification.tiersUpdated',
      message: `Тиры успешно назначены для ${updated} кошельков`,
      count: updated.toString()
    });
  } catch (error) {
    console.error('Ошибка назначения тиров:', error);
    res.status(500).json({ error: 'Ошибка назначения тиров' });
  }
});

// Назначить тир одному кошельку
app.post('/api/wallets/assign-tier', (req, res) => {
  try {
    const { address, tier } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    const wallet = cacheService.getWallet(address);
    if (!wallet) {
      return res.status(404).json({ error: 'Wallet not found' });
    }

    // Update the wallet with new tier
    const updatedWallet = { ...wallet, tier: tier || undefined };
    cacheService.setWallet(address, updatedWallet);

    console.log(`Updated wallet ${address} tier: ${wallet.tier} -> ${tier}`);
    
    res.json({
      success: true,
      message: `Wallet tier updated to ${tier}`,
      wallet: updatedWallet
    });
  } catch (error) {
    console.error('Error assigning wallet tier:', error);
    res.status(500).json({ error: 'Error assigning wallet tier' });
  }
});

// Error handler
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: any, res: any, _next: any) => {
  logger.error('Unhandled error', { message: err?.message, stack: err?.stack });
  res.status(500).json({ error: 'Internal server error' });
});

// Перезапустить обработку кошельков
app.post('/api/wallets/process', async (req, res) => {
  try {
    if (isProcessing) {
      return res.status(400).json({ error: 'Обработка уже выполняется' });
    }
    
    const addresses = loadWalletsFromFile();
    if (addresses.length === 0) {
      return res.status(400).json({ error: 'Нет кошельков для обработки' });
    }
    
    Logo.showProcessingStart(addresses.length);
    await processWallets(addresses);
    
    res.json({ 
      message: `Processing completed. Processed ${addresses.length} wallets`,
      walletsCount: walletsData.length
    });
  } catch (error) {
    logger.error('Ошибка при перезапуске обработки кошельков', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Новый endpoint для принудительного обновления выбранных кошельков
app.post('/api/wallets/refresh', async (req, res) => {
  try {
    if (isProcessing) {
      return res.status(400).json({ error: 'Обработка уже выполняется' });
    }
    
    const { wallets } = req.body;
    if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
      return res.status(400).json({ error: 'Не указаны кошельки для обновления' });
    }
    
    logger.info(`Forced update of ${wallets.length} selected wallets`);
    
    // Сразу отвечаем клиенту, что обработка запущена
    res.json({ 
      message: `Started processing ${wallets.length} wallets`,
      walletsCount: wallets.length,
      status: 'processing_started'
    });
    
    // Запускаем обработку в фоне
    setImmediate(async () => {
      try {
        isProcessing = true;
        Logo.showProcessingStart(wallets.length);
        
        // Принудительно обновляем выбранные кошельки
        await processWallets(wallets, true);
        
        logger.info(`Forced update of ${wallets.length} wallets completed`);
      } catch (error) {
        logger.error('Ошибка при обновлении выбранных кошельков:', error);
      } finally {
        isProcessing = false;
      }
    });
    
  } catch (error) {
    logger.error('Ошибка при запуске обновления кошельков:', error);
    res.status(500).json({ 
      error: 'Ошибка при запуске обновления кошельков',
      details: error instanceof Error ? error.message : 'Неизвестная ошибка'
    });
  }
});

// Добавить кошельки
app.post('/api/wallets/add', async (req, res) => {
  try {
    const { addresses } = req.body;
    
    if (!addresses || !Array.isArray(addresses)) {
      return res.status(400).json({ error: 'Неверный формат данных' });
    }
    
    // Сохраняем адреса в файл
    const walletsPath = path.join(__dirname, '../../data/wallets.txt');
    const existingAddresses = loadWalletsFromFile();
    const newAddresses = addresses.filter(addr => !existingAddresses.includes(addr));
    
    if (newAddresses.length > 0) {
      const allAddresses = [...existingAddresses, ...newAddresses];
      fs.writeFileSync(walletsPath, allAddresses.join('\n'));
      logger.info(`Добавлено ${newAddresses.length} новых кошельков`);
    }
    
    res.json({ 
      message: `Добавлено ${newAddresses.length} новых кошельков`,
      totalWallets: existingAddresses.length + newAddresses.length
    });
  } catch (error) {
    logger.error('Ошибка при добавлении кошельков', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Функция для обработки кошельков
// Нормализация адреса кошелька
const normalizeAddress = (address: string): string => {
  if (!address) return address;
  
  // Убираем пробелы и приводим к нижнему регистру
  let normalized = address.trim().toLowerCase();
  
  // Если адрес начинается с 0x
  if (normalized.startsWith('0x')) {
    // Убираем все ведущие нули после 0x (включая 0x001234 -> 0x1234)
    let hex = normalized.slice(2); // убираем 0x
    hex = hex.replace(/^0+/, ''); // убираем все ведущие нули
    
    // Если после удаления нулей ничего не осталось, ставим один ноль
    if (hex === '') {
      hex = '0';
    }
    
    // Для Ethereum адресов стандартизируем до 40 символов
    // Но сначала проверим, что это похоже на Ethereum адрес
    if (hex.length <= 40 && /^[0-9a-f]*$/.test(hex)) {
      // Добиваем до 40 символов нулями слева только если длина меньше 40
      hex = hex.padStart(40, '0');
    }
    
    normalized = '0x' + hex;
  }
  
  return normalized;
};

const processWallets = async (addresses: string[], forceUpdate = false) => {
  // Нормализуем и удаляем дубликаты адресов
  const normalizedAddresses = addresses
    .map(addr => normalizeAddress(addr))
    .filter((addr, index, arr) => arr.indexOf(addr) === index); // удаляем дубликаты
  
  logger.info(`Source addresses: ${addresses.length}, after normalization and duplicate removal: ${normalizedAddresses.length}`);
  
  // Создаем маппинг адресов на их ID (продолжая от максимального существующего ID)
  const originalWallets = loadWalletsFromFile();
  const walletIdMapping = new Map<string, number>();
  
  // Получаем максимальный ID из существующих кошельков в БД
  const existingWallets = cacheService.getAllWallets();
  const maxExistingId = existingWallets.length > 0 ? Math.max(...existingWallets.map(w => w.id || 0)) : 0;
  logger.info(`Maximum existing ID in database: ${maxExistingId}`);
  
  // Присваиваем ID новым кошелькам, начиная с maxExistingId + 1
  let nextId = maxExistingId + 1;
  originalWallets.forEach((address) => {
    const normalizedAddress = normalizeAddress(address);
    // Проверяем, есть ли уже кошелек с таким адресом в БД
    const existingWallet = existingWallets.find(w => normalizeAddress(w.address) === normalizedAddress);
    
    if (existingWallet) {
      // Используем существующий ID
      walletIdMapping.set(normalizedAddress, existingWallet.id);
    } else {
      // Назначаем новый ID
      walletIdMapping.set(normalizedAddress, nextId);
      nextId++;
    }
  });
  
  // Загружаем уже сохраненные кошельки
  const storedWallets = cacheService.getAllWallets().map(wallet => {
    // Если у кошелька нет ID, назначаем его на основе порядка в файле
    if (!wallet.id) {
      const walletId = walletIdMapping.get(normalizeAddress(wallet.address)) || 0;
      return { ...wallet, id: walletId };
    }
    return wallet;
  });
  const storedAddresses = cacheService.getCachedAddresses().map(addr => normalizeAddress(addr));
  
  // Определяем какие кошельки нужно обработать
  const addressesToProcess = forceUpdate ? normalizedAddresses : normalizedAddresses.filter(addr => !storedAddresses.includes(addr));
  
  logger.info(`Total wallets: ${normalizedAddresses.length}`);
  logger.info(`Already in database: ${storedAddresses.length}`);
  logger.info(`To process: ${addressesToProcess.length}`);
  const newWalletsData: WalletData[] = [];
  const failedAddresses: string[] = [];
  
  // Инициализируем прогресс
  const startTime = new Date().toISOString();
  processingProgress = { 
    current: 0, // Всегда начинаем с нуля для отображения
    total: addressesToProcess.length, // Количество кошельков к обработке (не общее!)
    startTime: startTime,
    averageTimePerWallet: 0
  };
  isProcessing = true;
  
  // Создаем прогресс бар
  const progressBar = new ProgressBar(addressesToProcess.length);
  
  // Максимальное количество одновременных запросов (снижено для стабильности)
  const maxConcurrent = 1;
  const batchSize = 1; // Последовательная обработка для максимальной стабильности
  
  // Функция для обработки одного кошелька с повторными попытками
  const processWalletWithRetry = async (address: string, retryCount = 0): Promise<WalletData | null> => {
    const maxRetries = 3;
    
    try {
      const walletId = walletIdMapping.get(address) || 0;
      const walletData = await debankService.getWalletData(address, forceUpdate, walletId);
      
      if (walletData) {
        logger.info(`Successfully retrieved data for ${address}: $${walletData.totalValue.toFixed(2)}`);
        return walletData;
      } else {
        logger.warn(`Не удалось получить данные для ${address} (попытка ${retryCount + 1}/${maxRetries})`);
        return null;
      }
    } catch (error) {
      logger.error(`Ошибка при обработке кошелька ${address} (попытка ${retryCount + 1}/${maxRetries})`, error);
      
      if (retryCount < maxRetries - 1) {
        // Экспоненциальная задержка с jitter для повторных попыток
        const baseDelay = (retryCount + 1) * 10000; // 10, 20, 30 секунд
        const jitter = Math.random() * 5000; // до 5 секунд случайной задержки
        const delay = baseDelay + jitter;
        logger.info(`Повторная попытка для ${address} через ${delay}мс...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return processWalletWithRetry(address, retryCount + 1);
      } else {
        logger.error(`Исчерпаны все попытки для кошелька ${address}`);
        return null;
      }
    }
  };
  
  // Add saved data to results only if not forced update
  // При принудительном обновлении мы хотим заменить данные, а не накапливать
  if (!forceUpdate) {
    newWalletsData.push(...storedWallets);
  } else {
    // При принудительном обновлении добавляем только те кошельки, которые не обновляются
    const addressesToProcessSet = new Set(addressesToProcess);
    const walletsNotBeingUpdated = storedWallets.filter(wallet => 
      !addressesToProcessSet.has(normalizeAddress(wallet.address))
    );
    newWalletsData.push(...walletsNotBeingUpdated);
    logger.info(`Force update: preserved ${walletsNotBeingUpdated.length} wallets, updating ${addressesToProcess.length}`);
  }
  
  // Если нет новых кошельков для обработки, завершаем корректно и сбрасываем флаги
  if (addressesToProcess.length === 0) {
    logger.info('Все кошельки уже в БД, новых для обработки нет');
    walletsData = newWalletsData;
    // Сохраняем актуальные данные на диск
    saveWalletsData(newWalletsData);
    // Показываем что обработка завершена (все кошельки уже обработаны)
    processingProgress.current = addressesToProcess.length; // All 0 wallets "processed"
    processingProgress.total = addressesToProcess.length; // Из 0 кошельков
    // Сбрасываем состояние обработки сразу, т.к. нечего обрабатывать
    isProcessing = false;
    processingProgress = null;
    saveProcessingState({ isProcessing, progress: processingProgress });
    progressBar.complete();
    return;
  }

  for (let i = 0; i < addressesToProcess.length; i += batchSize) {
    const batch = addressesToProcess.slice(i, i + batchSize);
    logger.info(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(addressesToProcess.length / batchSize)}: ${batch.length} wallets`);
    
    // Создаем промисы для параллельной обработки
    const promises = batch.map(async (address, index) => {
      const globalIndex = i + index;
      logger.info(`Processing wallet ${globalIndex + 1}/${addressesToProcess.length}: ${address}`);
      
      const walletData = await processWalletWithRetry(address);
      return { address, walletData };
    });
    
    // Обрабатываем батч с ограничением параллелизма
    const batchResults = await Promise.allSettled(promises);
    
    // Собираем успешные результаты и неудачные адреса
    let successCount = 0;
    batchResults.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.walletData) {
        newWalletsData.push(result.value.walletData);
        successCount++;
      } else if (result.status === 'fulfilled' && !result.value.walletData) {
        failedAddresses.push(result.value.address);
      }
    });
    
    // Обновляем прогресс и рассчитываем время
    processingProgress.current = i + batch.length; // Просто номер текущего обработанного кошелька
    progressBar.update(i + batch.length);
    
    // Рассчитываем среднее время и оценку завершения только для новых кошельков
    const processedNewWallets = i + batch.length;
    if (processedNewWallets > 0 && processingProgress.startTime) {
      const elapsedMs = Date.now() - new Date(processingProgress.startTime).getTime();
      processingProgress.averageTimePerWallet = elapsedMs / processedNewWallets;
      
      const remainingNewWallets = addressesToProcess.length - processedNewWallets;
      const estimatedRemainingMs = remainingNewWallets * processingProgress.averageTimePerWallet;
      processingProgress.estimatedFinish = new Date(Date.now() + estimatedRemainingMs).toISOString();
    }
    
    logger.info(`Batch ${Math.floor(i / batchSize) + 1} completed: ${successCount}/${batch.length} successful`);
    
    // Увеличенная пауза между запросами для предотвращения блокировок
    if (i + batchSize < addressesToProcess.length) {
      const batchDelay = 15000 + Math.random() * 10000; // 15-25 second random delay
      logger.info(`Pause between batches: ${(batchDelay/1000).toFixed(1)}s...`);
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }
  
  // Обрабатываем неудачные кошельки еще раз с увеличенными задержками
  if (failedAddresses.length > 0) {
    logger.info(`Повторная обработка ${failedAddresses.length} неудачных кошельков...`);
    
    // Создаем отдельный прогресс бар для повторной обработки
    const retryProgressBar = new ProgressBar(failedAddresses.length);
    
    for (let i = 0; i < failedAddresses.length; i++) {
      const address = failedAddresses[i];
      logger.info(`Финальная попытка для ${address}...`);
      
      try {
        // Значительно увеличиваем задержку перед финальной попыткой
        const finalRetryDelay = 30000 + Math.random() * 15000; // 30-45 секунд
        logger.info(`Ожидание перед финальной попыткой: ${(finalRetryDelay/1000).toFixed(1)}с...`);
        await new Promise(resolve => setTimeout(resolve, finalRetryDelay));
        
        const walletId = walletIdMapping.get(address) || 0;
        const walletData = await debankService.getWalletData(address, forceUpdate, walletId);
        if (walletData) {
          newWalletsData.push(walletData);
          logger.info(`Successfully retrieved data for ${address} on final attempt`);
        } else {
          logger.error(`Не удалось получить данные для ${address} даже в финальной попытке`);
        }
      } catch (error) {
        logger.error(`Ошибка при финальной попытке для ${address}`, error);
      }
      
      // Обновляем прогресс повторной обработки
      retryProgressBar.update(i + 1);
    }
    
    retryProgressBar.complete();
  }
  
  // Обновляем данные и сохраняем в файл
  walletsData = newWalletsData;
  saveWalletsData(newWalletsData);
  
  isProcessing = false;
  processingProgress = null;
  saveProcessingState({ isProcessing, progress: processingProgress });
  
  // Завершаем прогресс бар
  progressBar.complete();
  
  const successRate = Math.min(((newWalletsData.length / addresses.length) * 100), 100).toFixed(1);
  logger.info(`Processing completed. Retrieved data for ${newWalletsData.length}/${addresses.length} wallets (${successRate}%)`);
  logger.debug('Данные кошельков после обновления', { walletsData });
};

// Получить список прокси
app.post('/api/proxies', (req, res) => {
  try {
    const { limit, offset, status } = req.body;
    let proxies = debankService.getProxiesStatus();
    
    // Получаем состояние проверки прокси
    const proxyService = debankService.getProxyService();
    const isChecking = proxyService.isProxyCheckingInProgress();
    
    // Фильтруем по статусу если указан
    if (status && status !== 'all') {
      proxies = proxies.filter(proxy => proxy.status === status);
    }
    
    const total = proxies.length;
    
    // Пагинация
    if (limit && typeof limit === 'number') {
      const startIndex = offset && typeof offset === 'number' ? offset : 0;
      const endIndex = startIndex + limit;
      proxies = proxies.slice(startIndex, endIndex);
    }
    
    res.json({
      proxies,
      total,
      returned: proxies.length,
      isChecking // Добавляем информацию о состоянии проверки
    });
  } catch (error) {
    logger.error('Ошибка при получении списка прокси', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Проверить прокси
app.post('/api/proxies/check', async (req, res) => {
  try {
    logger.info('Starting proxy check');
    const proxyService = debankService.getProxyService();
    
    // Запускаем проверку в фоне, не блокируем ответ
    proxyService.checkAllProxies().catch(error => {
      logger.error('Ошибка при проверке прокси:', error);
    });
    
    // Сразу возвращаем текущий статус
    const proxies = debankService.getProxiesStatus();
    res.json({
      message: 'Проверка прокси запущена',
      status: 'started',
      proxies,
      total: proxies.length
    });
  } catch (error) {
    logger.error('Ошибка при проверке прокси', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Подгрузить новые прокси и кошельки из txt файлов
app.post('/api/reload', async (_req, res) => {
  try {
    // Перезагружаем прокси
    debankService.reloadProxies();

    // Перечитываем data/wallets.txt и перезапускаем обработку, если нужно
    const addresses = loadWalletsFromFile();
    if (addresses.length === 0) {
      return res.json({ 
        messageKey: 'notification.filesReloadedNoWallets', 
        message: 'Файлы перечитаны. Кошельков не найдено в data/wallets.txt', 
        wallets: 0, 
        proxies: debankService.getProxiesStatus().length 
      });
    }

    if (!isProcessing) {
      Logo.showProcessingStart(addresses.length);
      await processWallets(addresses);
    }

    // После обработки обязательно обновим walletsData из БД для согласованности ответа
    walletsData = getCurrentWalletsData();

    res.json({ 
      messageKey: 'notification.filesReloaded',
      message: 'Файлы перечитаны. Прокси и кошельки обновлены',
      wallets: walletsData.length,
      proxies: debankService.getProxiesStatus().length
    });
  } catch (error) {
    logger.error('Ошибка при перезагрузке данных из файлов', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Управление системой безопасности
app.get('/api/security/status', (req, res) => {
  try {
    const config = securityManager.getConfig();
    const isActive = securityManager.isActive();
    
    res.json({
      isActive,
      config,
      message: isActive ? 'Система безопасности активна' : 'Система безопасности отключена'
    });
  } catch (error) {
    logger.error('Ошибка при получении статуса безопасности', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/security/toggle', (req, res) => {
  try {
    const { enabled } = req.body;
    
    if (enabled && !securityManager.isActive()) {
      securityManager.initialize();
    } else if (!enabled && securityManager.isActive()) {
      securityManager.disable();
    }
    
    const isActive = securityManager.isActive();
    logger.info(`Система безопасности ${isActive ? 'включена' : 'отключена'}`);
    
    res.json({
      isActive,
      message: `Система безопасности ${isActive ? 'включена' : 'отключена'}`
    });
  } catch (error) {
    logger.error('Ошибка при переключении системы безопасности', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.put('/api/security/config', (req, res) => {
  try {
    const newConfig = req.body;
    
    // Обновляем конфигурацию в менеджере конфигурации
    configManager.updateSecurityConfig(newConfig);
    
    // Применяем изменения в менеджере безопасности
    securityManager.updateConfig(configManager.getSecurityConfig());
    
    const config = securityManager.getConfig();
    logger.info('Конфигурация безопасности обновлена', config);
    
    res.json({
      config,
      message: 'Конфигурация безопасности обновлена и сохранена'
    });
  } catch (error) {
    logger.error('Ошибка при обновлении конфигурации безопасности', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// Graceful shutdown
const gracefulShutdown = (signal: string) => {
  logger.info(`Received signal ${signal}, starting graceful shutdown...`);
  
  // Временно отключаем защиту для корректного завершения
  securityManager.disable();
  
  // Завершаем текущую обработку
  if (isProcessing) {
    logger.info('Waiting for current processing to complete...');
    isProcessing = false;
  }
  
  // Закрываем сервер
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
  
  // Force termination after 10 seconds
  setTimeout(() => {
    logger.error('Force terminating process');
    process.exit(1);
  }, 10000);
};

// Get server reference
const server = app.listen(PORT, async () => {
  // Initialize security system with configuration
  securityManager.updateConfig(configManager.getSecurityConfig());
  securityManager.initialize();
  
  // Show beautiful startup logo
  Logo.showLogo();
  Logo.showStartupStatus(Number(PORT));
  
  logger.info(`Backend server started on port ${PORT}`);
  logger.info(`API available at: http://localhost:${PORT}/api`);
  
  // Clean old data on startup
  logger.info('Cleaning old data on startup...');
  cleanupOldData();
  
  // Load data from database if available
  logger.info('Loading wallet data from database...');
  walletsData = getCurrentWalletsData();
  
  // Automatic duplicate check and removal on startup
  logger.info('Checking for duplicates in database...');
  try {
    const result = cacheService.deduplicateWallets();
    if (result.removed > 0 || result.updated > 0) {
      logger.info(`Database deduplication: removed ${result.removed} duplicates, updated ${result.updated} records`);
    }
  } catch (error) {
    logger.error('Error during automatic deduplication:', error);
  }

  // Update IDs of all wallets in database based on wallets.txt file
  logger.info('Updating wallet IDs in database...');
  try {
    const originalWallets = loadWalletsFromFile();
    const walletIdMapping = new Map<string, number>();
    
    // Get maximum ID from existing wallets in database
    const existingWallets = cacheService.getAllWallets();
    const maxExistingId = existingWallets.length > 0 ? Math.max(...existingWallets.map(w => w.id || 0)) : 0;
    logger.info(`Maximum existing ID in database: ${maxExistingId}`);
    
    // Assign IDs to new wallets, starting from maxExistingId + 1
    let nextId = maxExistingId + 1;
    originalWallets.forEach((address) => {
      const normalizedAddress = normalizeAddress(address);
      // Check if wallet with this address already exists in database
      const existingWallet = existingWallets.find(w => normalizeAddress(w.address) === normalizedAddress);
      
      if (existingWallet) {
        // Use existing ID
        walletIdMapping.set(normalizedAddress, existingWallet.id);
      } else {
        // Assign new ID
        walletIdMapping.set(normalizedAddress, nextId);
        nextId++;
      }
    });
    
    const updateResult = cacheService.updateWalletIds(walletIdMapping);
    if (updateResult.updated > 0) {
      logger.info(`Updated IDs for ${updateResult.updated} wallets in database`);
    }
  } catch (error) {
    logger.error('Error updating wallet IDs:', error);
  }

  // Reload data after all updates
  walletsData = getCurrentWalletsData();
  
  if (walletsData.length > 0) {
    logger.info(`Loaded ${walletsData.length} wallets from data file`);
  } else {
    // Automatically load and process wallets on startup if no saved data exists
    logger.info('Automatic wallet loading from file...');
    const addresses = loadWalletsFromFile();
    
    if (addresses.length > 0) {
      logger.info(`Found ${addresses.length} wallets in data/wallets.txt file`);
      logger.info('Starting automatic processing...');
      Logo.showProcessingStart(addresses.length);
      
      await processWallets(addresses);
      
      logger.info('Automatic processing completed');
    } else {
      logger.warn('File data/wallets.txt is empty or contains no valid addresses');
    }
  }
  
  // Automatic proxy check on background startup
  logger.info('Starting automatic proxy check...');
  setTimeout(async () => {
    try {
      const proxyService = debankService.getProxyService();
      await proxyService.checkAllProxies();
      logger.info('Automatic proxy check completed');
    } catch (error) {
      logger.error('Error during automatic proxy check:', error);
    }
  }, 3000); // Start 3 seconds after server startup

  // Background check of unchecked proxies every 10 minutes
  logger.info('Starting background check of unchecked proxies...');
  setInterval(async () => {
    try {
      const proxyService = debankService.getProxyService();
      await proxyService.checkUncheckedProxies();
    } catch (error) {
      logger.error('Error during background proxy check:', error);
    }
  }, 10 * 60 * 1000); // Every 10 minutes

  // Automatic token price updates every 4 hours
  const startTokenPriceUpdates = () => {
    logger.info('Starting automatic token price update system...');
    
    const updateTokenPrices = async () => {
      try {
        logger.info('Starting automatic token price update...');
        
        // Get all wallets with tokens
        const wallets = getCurrentWalletsData();
        if (wallets.length === 0) {
          logger.info('No wallets to update prices for');
          return;
        }

        // Extract unique tokens for update
        const uniqueTokens = new Set<string>();
        wallets.forEach(wallet => {
          wallet.tokens.forEach(token => {
            if (token.symbol) {
              uniqueTokens.add(token.symbol);
            }
          });
        });

        logger.info(`Found ${uniqueTokens.size} unique tokens for price update`);

        // Update several tokens at once to save resources
        const tokensArray = Array.from(uniqueTokens);
        const batchSize = 5; // Обновляем по 5 кошельков за раз для получения актуальных цен
        
        for (let i = 0; i < Math.min(batchSize, wallets.length); i++) {
          const wallet = wallets[i];
          try {
            // Обновляем данные кошелька для получения свежих цен
            await debankService.getWalletData(wallet.address);
            logger.info(`Updated prices for wallet ${wallet.address.slice(0, 8)}...`);
            
            // Делаем небольшую паузу между запросами
            await new Promise(resolve => setTimeout(resolve, 2000));
          } catch (error) {
            logger.error(`Error updating prices for wallet ${wallet.address}:`, error);
          }
        }

        logger.info('Automatic token price update completed');
      } catch (error) {
        logger.error('Error during automatic token price update:', error);
      }
    };

    // Запускаем первое обновление через 10 минут после старта
    setTimeout(updateTokenPrices, 10 * 60 * 1000);
    
    // Затем обновляем каждые 4 часа
    setInterval(updateTokenPrices, 4 * 60 * 60 * 1000);
  };

  startTokenPriceUpdates();
});

// Обработка сигналов завершения
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2')); // nodemon

export default app; 