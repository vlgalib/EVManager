import fs from 'fs';
import path from 'path';
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

export class CacheService {
  private static instance: CacheService;
  private dbPath: string;
  private database: WalletDatabase = {};

  constructor() {
    this.dbPath = path.join(process.cwd(), 'data', 'wallet_database.json');
    this.loadDatabase();
  }

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  private loadDatabase(): void {
    try {
      // Создаем папку data если не существует
      const dataDir = path.dirname(this.dbPath);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      if (fs.existsSync(this.dbPath)) {
        const data = fs.readFileSync(this.dbPath, 'utf8');
        this.database = JSON.parse(data);
        const walletCount = Object.keys(this.database).filter(key => key !== '_metadata').length;
        console.log(`Loaded ${walletCount} wallets from persistent database`);
      } else {
        // Инициализируем новую БД с метаданными
        this.database = {
          _metadata: {
            totalWallets: 0,
            lastFetch: new Date().toISOString(),
            version: '1.0.0'
          }
        } as WalletDatabase;
        this.saveDatabase();
      }
    } catch (error) {
      console.error('Ошибка загрузки базы данных:', error);
      this.database = {};
    }
  }

  private saveDatabase(): void {
    try {
      // Обновляем метаданные перед сохранением
      const walletAddresses = Object.keys(this.database).filter(key => key !== '_metadata');
      this.database._metadata = {
        totalWallets: walletAddresses.length,
        lastFetch: new Date().toISOString(),
        version: '1.0.0'
      };
      
      fs.writeFileSync(this.dbPath, JSON.stringify(this.database, null, 2));
      console.log(`Saved ${walletAddresses.length} wallets to persistent database`);
    } catch (error) {
      console.error('Ошибка сохранения базы данных:', error);
    }
  }

  private normalizeAddress(address: string): string {
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
  }

  public getWallet(address: string): WalletData | null {
    const normalizedAddress = this.normalizeAddress(address);
    const stored = this.database[normalizedAddress];
    if (!stored || normalizedAddress === '_metadata') {
      return null;
    }

    // Возвращаем данные без служебных полей
    const { fetchedAt, ...walletData } = stored as StoredWalletData;
    return walletData;
  }

  public setWallet(address: string, data: WalletData): void {
    const normalizedAddress = this.normalizeAddress(address);
    
    // Если есть старые данные под другим форматом адреса, удаляем их
    this.removeOldDuplicateAddresses(normalizedAddress, address);
    
    // Проверяем, есть ли уже кошелек в БД и сохраняем его ID
    const existingWallet = this.database[normalizedAddress];
    const preservedId = existingWallet?.id || data.id;
    
    this.database[normalizedAddress] = {
      ...data,
      id: preservedId, // Сохраняем ID
      fetchedAt: new Date().toISOString()
    };
    this.saveDatabase();
  }

  // Batch update method for updating multiple wallets efficiently
  public batchUpdateWallets(updates: Array<{ address: string; data: WalletData }>): void {
    updates.forEach(({ address, data }) => {
      const normalizedAddress = this.normalizeAddress(address);
      
      // Remove old duplicate addresses
      this.removeOldDuplicateAddresses(normalizedAddress, address);
      
      // Check if wallet already exists in DB and preserve its ID
      const existingWallet = this.database[normalizedAddress];
      const preservedId = existingWallet?.id || data.id;
      
      this.database[normalizedAddress] = {
        ...data,
        id: preservedId, // Preserve ID
        fetchedAt: new Date().toISOString()
      };
    });
    
    // Save only once after all updates
    this.saveDatabase();
  }

  private removeOldDuplicateAddresses(normalizedAddress: string, originalAddress: string): void {
    // Ищем и удаляем возможные дубликаты с разными форматами адреса
    const addressesToCheck = new Set<string>();
    
    // Основные варианты
    addressesToCheck.add(originalAddress.toLowerCase());
    addressesToCheck.add(originalAddress.toUpperCase());
    addressesToCheck.add(originalAddress);
    addressesToCheck.add(normalizedAddress);
    
    // Варианты с разным количеством ведущих нулей
    if (originalAddress.startsWith('0x') || originalAddress.startsWith('0X')) {
      const hex = originalAddress.slice(2);
      
      // Добавляем варианты с разным количеством ведущих нулей
      for (let i = 0; i <= 10; i++) {
        const withZeros = '0x' + '0'.repeat(i) + hex.replace(/^0+/, '');
        addressesToCheck.add(withZeros.toLowerCase());
        addressesToCheck.add(withZeros.toUpperCase());
      }
      
      // Добавляем полную длину (40 символов после 0x)
      if (hex.length <= 40) {
        const fullLength = '0x' + hex.replace(/^0+/, '').padStart(40, '0');
        addressesToCheck.add(fullLength.toLowerCase());
        addressesToCheck.add(fullLength.toUpperCase());
      }
    }

    // Удаляем все найденные дубликаты
    for (const addr of addressesToCheck) {
      if (addr !== normalizedAddress && this.database[addr]) {
        console.log(`Removing wallet duplicate: ${addr} -> ${normalizedAddress}`);
        delete this.database[addr];
      }
    }
  }

  public removeWallet(address: string): void {
    const normalizedAddress = this.normalizeAddress(address);
    delete this.database[normalizedAddress];
    this.saveDatabase();
  }

  public getAllWallets(): WalletData[] {
    const wallets: WalletData[] = [];
    
    for (const [address, stored] of Object.entries(this.database)) {
      // Skip metadata
      if (address === '_metadata') continue;
      
      const { fetchedAt, ...walletData } = stored as StoredWalletData;
      wallets.push(walletData);
    }
    
    return wallets;
  }

  public getCachedAddresses(): string[] {
    return Object.keys(this.database).filter(key => key !== '_metadata');
  }

  public clearOldData(): number {
    // Метод для очистки старых данных (если потребуется в будущем)
    // В постоянной БД данные храним всегда
    return 0;
  }

  public clearAll(): void {
    this.database = {
      _metadata: {
        totalWallets: 0,
        lastFetch: new Date().toISOString(),
        version: '1.0.0'
      }
    } as WalletDatabase;
    this.saveDatabase();
  }

  public getStats(): { total: number; lastFetch: string; dbSize: string } {
    const walletCount = Object.keys(this.database).filter(key => key !== '_metadata').length;
    const lastFetch = this.database._metadata?.lastFetch || 'Unknown';
    
    // Получаем размер файла БД
    let dbSize = '0 MB';
    try {
      if (fs.existsSync(this.dbPath)) {
        const stats = fs.statSync(this.dbPath);
        dbSize = `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
      }
    } catch (error) {
      console.error('Ошибка получения размера БД:', error);
    }
    
    return {
      total: walletCount,
      lastFetch,
      dbSize
    };
  }

  // Новый метод для получения информации о кошельке с датами
  public getWalletInfo(address: string): { data: WalletData; fetchedAt: string } | null {
    const normalizedAddress = this.normalizeAddress(address);
    const stored = this.database[normalizedAddress];
    if (!stored || normalizedAddress === '_metadata') {
      return null;
    }

    const { fetchedAt, ...walletData } = stored as StoredWalletData;
    return {
      data: walletData,
      fetchedAt
    };
  }

  // Метод для экспорта всей БД (для бэкапа)
  public exportDatabase(): WalletDatabase {
    return { ...this.database };
  }

  // Метод для импорта БД
  public importDatabase(data: WalletDatabase): void {
    this.database = data;
    this.saveDatabase();
  }

  // Check and remove wallet duplicates
  public deduplicateWallets(): { removed: number; updated: number } {
    console.log('Starting wallet duplicate check...');
    
    // Group wallets by normalized addresses
    const walletsByAddress = new Map<string, { address: string; data: StoredWalletData }[]>();
    
    for (const [address, walletData] of Object.entries(this.database)) {
      // Skip metadata
      if (address === '_metadata') continue;
      
      const normalizedAddress = this.normalizeAddress(address);
      const stored = walletData as StoredWalletData;
      
      if (!walletsByAddress.has(normalizedAddress)) {
        walletsByAddress.set(normalizedAddress, []);
      }
      
      walletsByAddress.get(normalizedAddress)!.push({
        address,
        data: stored
      });
    }
    
    let removed = 0;
    let updated = 0;
    
    // Обрабатываем каждую группу дубликатов
    for (const [normalizedAddress, wallets] of walletsByAddress) {
      if (wallets.length > 1) {
        console.log(`Найдены дубликаты для адреса ${normalizedAddress}: ${wallets.length} записей`);
        
        // Сортируем по ID (меньший ID = более ранний кошелек)
        wallets.sort((a, b) => (a.data.id || 0) - (b.data.id || 0));
        
        // Берем запись с самым маленьким ID
        const keepWallet = wallets[0];
        
        // Находим самые свежие данные (по fetchedAt)
        const latestWallet = wallets.reduce((latest, current) => {
          const latestDate = new Date(latest.data.fetchedAt || latest.data.lastUpdated);
          const currentDate = new Date(current.data.fetchedAt || current.data.lastUpdated);
          return currentDate > latestDate ? current : latest;
        });
        
        console.log(`Оставляем кошелек с ID ${keepWallet.data.id}, обновляем данными от ${latestWallet.data.fetchedAt}`);
        
        // Обновляем данные кошелька с меньшим ID самыми свежими данными
        const updatedData = {
          ...latestWallet.data,
          id: keepWallet.data.id, // Сохраняем исходный ID
          address: keepWallet.data.address // Сохраняем исходный адрес
        };
        
        // Удаляем все старые записи
        for (const wallet of wallets) {
          delete this.database[wallet.address];
          removed++;
        }
        
        // Добавляем обновленную запись под нормализованным адресом
        this.database[normalizedAddress] = updatedData;
        updated++;
        
        console.log(`Дубликат ${normalizedAddress}: удалено ${wallets.length} записей, создана 1 объединенная`);
      }
    }
    
    if (removed > 0 || updated > 0) {
      this.saveDatabase();
      console.log(`Дедупликация завершена: удалено ${removed} дубликатов, обновлено ${updated} записей`);
    } else {
      console.log('No duplicates found');
    }
    
    return { removed, updated };
  }

  // Обновить ID всех кошельков в БД на основе порядка в файле wallets.txt
  public updateWalletIds(walletIdMapping: Map<string, number>): { updated: number } {
    console.log('Updating wallet IDs in database...');
    let updated = 0;

    // Проходим по всем кошелькам в БД
    for (const [address, walletData] of Object.entries(this.database)) {
      // Skip metadata
      if (address === '_metadata') continue;
      
      const normalizedAddress = this.normalizeAddress(address);
      const correctId = walletIdMapping.get(normalizedAddress);
      
      // Приводим к StoredWalletData, так как метаданные уже отфильтрованы
      const wallet = walletData as StoredWalletData;
      
      if (correctId && wallet.id !== correctId) {
        console.log(`Updating wallet ID ${address}: ${wallet.id} -> ${correctId}`);
        this.database[address] = {
          ...wallet,
          id: correctId
        };
        updated++;
      } else if (!wallet.id && correctId) {
        console.log(`Setting wallet ID ${address}: undefined -> ${correctId}`);
        this.database[address] = {
          ...wallet,
          id: correctId
        };
        updated++;
      }
    }

    if (updated > 0) {
      this.saveDatabase();
      console.log(`ID update completed: updated ${updated} wallets`);
    } else {
      console.log('All wallet IDs are already correct');
    }

    return { updated };
  }
}