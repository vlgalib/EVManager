# EVManager ⚡

## English

**Professional cryptocurrency portfolio analytics platform**

EVManager is a powerful fullstack application for tracking and analyzing DeFi wallet portfolios with real-time data from DeBank. Features comprehensive proxy support, mobile-responsive design, and advanced filtering capabilities.

### <img src="https://cdn-icons-png.flaticon.com/128/10647/10647890.png" alt="Features" width="30" height="30" style="vertical-align: baseline; margin-right: 4px;"> Features

- 📊 **Portfolio Analytics** — Complete wallet analysis with token and protocol breakdowns
- 🔍 **Advanced Filtering** — Smart filters for tokens, protocols, and chains
- 📈 **Real-time Data** — Live portfolio updates with DeBank integration
- 📋 **Excel Export** — Export portfolio data to Excel with ExcelJS
- 🌐 **Proxy Support** — Multi-proxy rotation with automatic failover and health checks
- ⚡ **Smart Auto-Refresh** — Prioritizes oldest wallets (1 per minute for wallets >24h old)
- 📱 **Mobile Responsive** — Full mobile support with burger menu and card layouts
- 🌍 **Multi-language** — English and Russian interface
- 🔄 **Persistent Caching** — GeoIP and wallet data caching for improved performance
- 🛡️ **Rate Limiting** — Built-in protection against API abuse

### 🚀 Quick Start

#### Automated Setup (Recommended)
1. **First-time setup:** Double-click `setup.bat`
   - Installs Node.js if missing
   - Installs all dependencies
   - Downloads Chrome for Puppeteer
   - Creates required directories and config files

#### Manual Setup
```bash
git clone <repository-url>
cd EVManager
npm install
```

#### Configuration

**Proxy Setup** (Optional but recommended)
Add your proxy servers to `data/proxy.txt`, one per line. Supported formats:
```
http://user:pass@host:port
socks5://user:pass@host:port
host:port:user:pass
user:pass@host:port
```

**Wallet Addresses**
Add wallet addresses to `data/wallets.txt`, one per line (0x format).

#### Running the Application

**🖱️ Windows GUI Mode (No terminal required):**
- **Start Application:** Double-click `start.bat` (Production mode)

**💻 Command Line:**
```bash
# Development mode (both frontend and backend with hot reload)
npm run dev

# Production mode
npm run build
npm start
```

### <img src="https://cdn-icons-png.flaticon.com/128/2111/2111728.png" alt="Batch Files" width="24" height="24" style="vertical-align: baseline; margin-right: 4px;"> Batch Files (Windows)

| File | Description |
|------|-------------|
| `setup.bat` | Complete system setup - installs Node.js, dependencies, Chrome, creates config |
| `start.bat` | Build and start production servers |
| `clear-database.bat` | Clear all wallet data and cache files |
| `kill-ports.bat` | Kill processes using ports 5000 and 5001 (basic version) |
| `kill-ports-admin.bat` | Kill processes using ports 5000 and 5001 (requires admin rights, more aggressive) |
| `kill-ports.ps1` | PowerShell version for advanced process management |

### <img src="https://cdn-icons-png.flaticon.com/128/16497/16497192.png" alt="Requirements" width="30" height="30" style="vertical-align: baseline; margin-right: 4px;"> System Requirements

- **[Node.js](https://nodejs.org/en/download)** version 18+ (auto-installed by setup.bat)
- **Chrome/Chromium** (auto-installed by setup.bat)
- Modern browser for web interface
- **Windows:** Batch files included for easy setup
- **Linux/Mac:** Use npm commands directly

### 🏗️ Architecture

- **Backend:** Node.js + Express + TypeScript + Puppeteer
- **Frontend:** React + Vite + TypeScript + TailwindCSS
- **Data Processing:** DeBank scraping with proxy rotation
- **Caching:** Persistent file-based + in-memory caching
- **Mobile:** Responsive design with burger menu and card layouts

### <img src="https://cdn-icons-png.flaticon.com/128/2111/2111646.png" alt="Contact" width="24" height="24" style="vertical-align: baseline; margin-right: 4px;"> Contact

**Telegram:** [@IdeaMint](https://t.me/IdeaMint)  
**Author:** **vlgalib**

---

## Русский

**Профессиональная платформа для аналитики криптовалютных портфелей**

EVManager — это мощное fullstack приложение для отслеживания и анализа DeFi портфелей кошельков с данными в реальном времени от DeBank. Включает комплексную поддержку прокси, адаптивный дизайн для мобильных устройств и расширенные возможности фильтрации.

### <img src="https://cdn-icons-png.flaticon.com/128/10647/10647890.png" alt="Возможности" width="30" height="30" style="vertical-align: baseline; margin-right: 4px;"> Возможности

- 📊 **Аналитика портфелей** — Полный анализ кошельков с разбивкой по токенам и протоколам
- 🔍 **Расширенная фильтрация** — Умные фильтры для токенов, протоколов и сетей
- 📈 **Данные в реальном времени** — Живые обновления портфеля с интеграцией DeBank
- 📋 **Экспорт в Excel** — Выгрузка данных портфеля в Excel с помощью ExcelJS
- 🌐 **Поддержка прокси** — Ротация прокси с автоматическим переключением и проверкой здоровья
- ⚡ **Умное автообновление** — Приоритет самых старых кошельков (1 в минуту для кошельков >24ч)
- 📱 **Адаптивный дизайн** — Полная поддержка мобильных устройств с бургер-меню и карточками
- 🌍 **Многоязычность** — Интерфейс на английском и русском языках
- 🔄 **Постоянное кэширование** — Кэширование GeoIP и данных кошельков для улучшения производительности
- 🛡️ **Защита от злоупотреблений** — Встроенная защита от злоупотребления API

### 🚀 Быстрый старт

#### Автоматическая настройка (Рекомендуется)
1. **Первый запуск:** Двойной клик по `setup.bat`
   - Устанавливает Node.js если отсутствует
   - Устанавливает все зависимости
   - Скачивает Chrome для Puppeteer
   - Создает необходимые директории и конфигурационные файлы

#### Ручная настройка
```bash
git clone <repository-url>
cd EVManager
npm install
```

#### Конфигурация

**Настройка прокси** (Необязательно, но рекомендуется)
Добавьте прокси-серверы в `data/proxy.txt`, по одному на строку. Поддерживаемые форматы:
```
http://user:pass@host:port
socks5://user:pass@host:port
host:port:user:pass
user:pass@host:port
```

**Адреса кошельков**
Добавьте адреса кошельков в `data/wallets.txt`, по одному на строку (формат 0x).

#### Запуск приложения

**🖱️ Режим Windows GUI (Терминал не требуется):**
- **Запуск приложения:** Двойной клик по `start.bat` (продакшен режим)

**💻 Командная строка:**
```bash
# Режим разработки (frontend и backend с горячей перезагрузкой)
npm run dev

# Продакшен режим
npm run build
npm start
```

### <img src="https://cdn-icons-png.flaticon.com/128/2111/2111728.png" alt="Пакетные файлы" width="24" height="24" style="vertical-align: baseline; margin-right: 4px;"> Пакетные файлы (Windows)

| Файл | Описание |
|------|----------|
| `setup.bat` | Полная настройка системы - устанавливает Node.js, зависимости, Chrome, создает конфиг |
| `start.bat` | Сборка и запуск продакшен серверов |
| `clear-database.bat` | Очистка всех данных кошельков и файлов кэша |
| `kill-ports.bat` | Завершение процессов на портах 5000 и 5001 (базовая версия) |
| `kill-ports-admin.bat` | Завершение процессов на портах 5000 и 5001 (требует права администратора, более агрессивная) |
| `kill-ports.ps1` | PowerShell версия для продвинутого управления процессами |

### <img src="https://cdn-icons-png.flaticon.com/128/16497/16497192.png" alt="Требования" width="30" height="30" style="vertical-align: baseline; margin-right: 4px;"> Системные требования

- **[Node.js](https://nodejs.org/en/download)** версии 18+ (автоматически устанавливается setup.bat)
- **Chrome/Chromium** (автоматически устанавливается setup.bat)
- Современный браузер для веб-интерфейса
- **Windows:** Включены пакетные файлы для простой настройки
- **Linux/Mac:** Используйте npm команды напрямую

### 🏗️ Архитектура

- **Backend:** Node.js + Express + TypeScript + Puppeteer
- **Frontend:** React + Vite + TypeScript + TailwindCSS
- **Обработка данных:** Скрапинг DeBank с ротацией прокси
- **Кэширование:** Постоянное файловое + кэширование в памяти
- **Мобильные:** Адаптивный дизайн с бургер-меню и карточками

### <img src="https://cdn-icons-png.flaticon.com/128/2111/2111646.png" alt="Контакты" width="24" height="24" style="vertical-align: baseline; margin-right: 4px;"> Контакты

**Telegram:** [@IdeaMint](https://t.me/IdeaMint)  
**Автор:** **vlgalib**

---

## 🙏 Acknowledgments

Special thanks for the idea and template:
- **Telegram:** [@Andrey_PrivateKey](https://t.me/Andrey_PrivateKey)
- **GitHub:** [@privatekey7](https://github.com/privatekey7)

---

**Благодарность за идею и шаблон:**
- **Telegram:** [@Andrey_PrivateKey](https://t.me/Andrey_PrivateKey)
- **GitHub:** [@privatekey7](https://github.com/privatekey7)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.