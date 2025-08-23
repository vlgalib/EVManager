import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Language = 'ru' | 'en';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translation dictionaries
const translations = {
  en: {
    // Header
    'header.title': 'EVManager',
    'header.online': 'Online',
    'header.offline': 'Offline',
    'header.loading': 'Loading EVManager...',
    'header.assignTiers': 'Assign Tiers',
    'header.autoRefresh': 'Auto Refresh',
    'header.autoRefreshEnabled': 'Auto refresh enabled (1 wallet per minute, older than 24 hours)',
    'header.autoRefreshDisabled': 'Enable auto refresh for wallets',
    'header.telegram': 'Telegram',
    'header.telegramTitle': 'Author\'s Telegram channel',
    'header.donate': 'Donate',
    'header.donateTitle': 'Support the author',
    'header.checkProxies': 'Check Proxies',
    'header.refresh': 'Refresh',
    'header.loadNew': 'Load New',

    // Navigation
    'nav.overview': 'Overview',
    'nav.wallets': 'Wallets',
    'nav.tokens': 'Tokens',
    'nav.protocols': 'Protocols',
    'nav.proxiesCheck': 'Proxies (check)',

    // Overview Tab
    'overview.totalValue': 'Total Value',
    'overview.wallets': 'Wallets',
    'overview.activeAddresses': 'active addresses',
    'overview.topToken': 'Top Token',
    'overview.topChain': 'Top Chain',
    'overview.chainDistribution': 'Chain Distribution',
    'overview.topTokens': 'Top Tokens',
    'overview.topProtocols': 'Top Protocols',
    'overview.protocol': 'Protocol',
    'overview.chain': 'Chain',
    'overview.category': 'Category',
    'overview.value': 'Value',
    'overview.aggregated': 'Aggregated',
    'tokens.ofTopTen': 'of top-10',
    'tokens.aggregatedAcrossNetworks': 'Aggregated across all networks',
    'overview.for24h': 'for 24h',

    // Wallets Tab
    'wallets.title': 'Wallets',
    'wallets.selected': 'Selected',
    'wallets.total': 'Total wallets',
    'wallets.page': 'Page',
    'wallets.of': 'of',
    'wallets.id': 'ID',
    'wallets.address': 'Address',
    'wallets.balance': 'Balance',
    'wallets.chains': 'Chains',
    'wallets.tokens': 'Tokens',
    'wallets.protocols': 'Protocols',
    'wallets.inProtocols': 'In Protocols',
    'wallets.updated': 'Updated',
    'wallets.actions': 'Actions',
    'wallets.copyAddress': 'Copy address',
    'wallets.openInDeBank': 'Open in DeBank',
    'wallets.includeInCalculations': 'Include in calculations',
    'wallets.deselectAll': 'Deselect all wallets',
    'wallets.selectAllVisible': 'Select all visible',
    'wallets.deselectAllVisible': 'Deselect all visible',
    'wallets.searchPlaceholder': 'Search by address or ID...',
    'wallets.hideUnder': 'Don\'t show < $0.5',
    'wallets.all': 'All',
    'wallets.tier1': 'Tier 1',
    'wallets.tier2': 'Tier 2',
    'wallets.tier3': 'Tier 3',
    'wallets.noTier': 'No tier',
    'wallets.addToTier': 'To Tier ▾',
    'wallets.addToTier1': 'Add to Tier 1',
    'wallets.addToTier2': 'Add to Tier 2',
    'wallets.addToTier3': 'Add to Tier 3',
    'wallets.removeFromTier': 'Remove from Tier',
    'wallets.noWalletsFound': 'No wallets found',
    'wallets.noWalletsDescription': 'No available wallets to display',
    'wallets.perPage': 'per page',
    'wallets.first': 'First',
    'wallets.previous': 'Previous',
    'wallets.next': 'Next',
    'wallets.last': 'Last',
    'wallets.showing': 'Showing',

    // Tokens Tab
    'tokens.title': 'Tokens',
    'tokens.chainDistribution': 'Token Distribution by Chains',
    'tokens.topTokensByValue': 'Top Tokens by Value',
    'tokens.token': 'Token',
    'tokens.chain': 'Chain',
    'tokens.balance': 'Balance',
    'tokens.symbol': 'Symbol',
    'tokens.price': 'Price',
    'tokens.value': 'Value',
    'tokens.groups': 'groups',
    'tokens.showing': 'Showing',
    'tokens.groupsOf': 'groups of',
    'tokens.tokensTotal': 'tokens',
    'tokens.walletsWithToken': 'Wallets with this token:',

    // Protocols Tab
    'protocols.title': 'Protocols',
    'protocols.topProtocolsByValue': 'Top Protocols by Value',
    'protocols.protocolDistribution': 'Protocol Distribution',
    'protocols.protocol': 'Protocol',
    'protocols.chain': 'Chain',
    'protocols.category': 'Category',
    'protocols.value': 'Value',
    'protocols.actions': 'Actions',
    'protocols.showing': 'Showing',
    'protocols.of': 'of',
    'protocols.walletsWithFunds': 'Wallets with funds in protocol:',

    // Proxies Tab
    'proxies.title': 'Proxies',
    'proxies.status': 'Status',
    'proxies.url': 'URL',
    'proxies.responseTime': 'Response Time',
    'proxies.lastCheck': 'Last Check',
    'proxies.working': 'Working',
    'proxies.failed': 'Failed',
    'proxies.checking': 'Checking',
    'proxies.total': 'Total',
    'proxies.checkAll': 'Check All',
    'proxies.ms': 'ms',
    'proxies.protocol': 'Protocol',
    'proxies.address': 'Address',
    'proxies.port': 'Port',
    'proxies.error': 'Error',
    'proxies.successRate': 'Success Rate',
    'proxies.country': 'Country',
    'proxies.notFound': 'No proxies found',
    'proxies.addToFile': 'Add proxies to proxy.txt file',

    // Tier Assignment Modal
    'tiers.title': 'Assign Tiers',
    'tiers.description': 'Specify wallet ID ranges for each tier. Wallets outside these ranges will be unassigned.',
    'tiers.tier1': 'Tier 1',
    'tiers.tier2': 'Tier 2',
    'tiers.tier3': 'Tier 3',
    'tiers.from': 'From',
    'tiers.to': 'To',
    'tiers.cancel': 'Cancel',
    'tiers.apply': 'Apply Tiers',
    'tiers.applying': 'Applying...',
    'tiers.validationFromTo': 'Start ID cannot be greater than end ID',
    'tiers.validationOverlap': 'Ranges {tier1} and {tier2} overlap',
    'tiers.errorAssigning': 'Error assigning tiers',
    'tiers.successMessage': 'Tiers successfully assigned! Updated wallets: {count}',

    // Donate Modal
    'donate.title': 'Support the Project',
    'donate.description': 'If EVManager has been useful, support the development!',
    'donate.walletAddress': 'Wallet address:',
    'donate.copyAddress': 'Copy address',
    'donate.qrCode': 'QR code for donations',
    'donate.thankYou': 'Thank you for your support! ❤️',

    // Notifications
    'notification.autoRefreshEnabled': 'Auto refresh enabled',
    'notification.autoRefreshDisabled': 'Auto refresh disabled',
    'notification.autoRefreshWallet': 'Auto refresh: updated wallet',
    'notification.addressCopied': 'Address copied!',
    'notification.noWalletsSelected': 'No wallets selected for refresh',
    'notification.serverBusy': 'Server is already processing wallets. Please wait and try again.',
    'notification.refreshStarted': 'Started processing {count} wallets. Track progress in the status bar in real time.',
    'notification.refreshError': 'Error refreshing wallets: {error}',
    'notification.proxyError': 'Proxy check error: {error}',
    'notification.filesReloaded': 'Files reloaded. Proxies and wallets updated',
    'notification.filesReloadedNoWallets': 'Files reloaded. No wallets found in data/wallets.txt',
    'notification.proxyNotResponding': 'Proxy not responding',
    'notification.tiersUpdated': 'Tiers updated for {count} wallets',

    // Refresh Button
    'refresh.updating': 'Updating...',
    'refresh.busy': 'Busy...',
    'refresh.update': 'Update',
    'refresh.selectWallets': 'Select wallets to refresh',
    'refresh.serverBusy': 'Server is busy processing',
    'refresh.updateSelected': 'Update {count} selected wallets',

    // Load New Button
    'loadNew.loading': 'Loading...',
    'loadNew.loadNew': 'Load New',
    'loadNew.title': 'Reload wallets.txt and proxy.txt',

    // Status Messages
    'status.connectionError': 'Server connection error',
    'status.loadingError': 'Failed to load data',
    'status.walletsLoadError': 'Error loading wallets',

    // Theme Toggle
    'theme.switchToLight': 'Switch to light theme',
    'theme.switchToDark': 'Switch to dark theme',

    // Time
    'time.ago': 'ago',
    'time.seconds': 's',
    'time.minutes': 'm',
    'time.hours': 'h',
    'time.days': 'd',
    
    // Common
    'common.wallets': 'wallets',
    'common.loading': 'Loading...',
    'common.error': 'Error',
    'common.noData': 'No data available',
    'common.showMore': 'Show more',
    'common.viewDetails': 'View details',
    'common.cancel': 'Cancel',
    'common.save': 'Save',
    
    // Filters
    'filters.filters': 'Filters',
    'filters.export': 'Export',
    'filters.searchTokens': 'Search tokens...',
    'filters.searchProtocols': 'Search protocols...',
    'filters.valueRange': 'Value Range',
    'filters.from': 'From',
    'filters.to': 'To',
    'filters.chain': 'Chain',
    'filters.allChains': 'All chains',
    'filters.token': 'Token',
    'filters.allTokens': 'All tokens',
    'filters.protocol': 'Protocol',
    'filters.allProtocols': 'All protocols',
    'filters.reset': 'Reset Filters',
    
    // Debug Panel
    'debug.title': 'Debug Panel',
    'debug.loadData': 'Load Data',
    'debug.restartProcessing': 'Restart Processing',
    'debug.processing': 'Processing...',
    'debug.debugEnabled': 'Debug On',
    'debug.debugDisabled': 'Debug Off',
    'debug.clearLogs': 'Clear Logs',
    'debug.totalLogs': 'Total Logs',
    'debug.debugData': 'Debug Data',
    'debug.debugMode': 'Debug Mode',
    'debug.enabled': 'Enabled',
    'debug.disabled': 'Disabled',
    'debug.logs': 'Logs',
    'debug.debugging': 'Debugging',
    'debug.logoTest': 'Logo Test',
    'debug.systemLogs': 'System Logs',
    'debug.allLevels': 'All Levels',
    'debug.errors': 'Errors',
    'debug.warnings': 'Warnings',
    'debug.info': 'Info',
    'debug.update': 'Update',
    'debug.wallet': 'Wallet',
    'debug.data': 'Data',
    'debug.debugDataTitle': 'Debug Data',
    'debug.walletPlaceholder': 'Wallet address (optional)',
    'debug.steps': 'steps',
    'debug.processingSteps': 'Processing Steps',
    'debug.networkRequests': 'Network Requests',
    'debug.rawData': 'Raw Data',
    'debug.processedData': 'Processed Data',
    'debug.logoTestRemoved': 'Logo test component was removed to clean up code.',
    
    // Status Bar
    'status.proxies': 'Proxies',
    'status.debug': 'Debug',
    'status.wallets': 'wallets',
    'status.processed': 'processed',
    'status.processing': 'Processing',
    'status.idle': 'Idle',
    'status.errors': 'errors',
    'status.database': 'DB',
    'status.mb': 'MB',
    'status.connectionError': 'Connection error. Backend server is not available.',
    
    // Error messages
    'errors.proxyCheck': 'Proxy check error: ',
    'errors.unknown': 'Unknown error'
  },
  ru: {
    // Header
    'header.title': 'EVManager',
    'header.online': 'Онлайн',
    'header.offline': 'Оффлайн',
    'header.loading': 'Загрузка EVManager...',
    'header.assignTiers': 'Назначить тиры',
    'header.autoRefresh': 'Авто обновление',
    'header.autoRefreshEnabled': 'Автообновление включено (1 кошелек в минуту, старше 24 часов)',
    'header.autoRefreshDisabled': 'Включить автообновление кошельков',
    'header.telegram': 'Telegram',
    'header.telegramTitle': 'Telegram канал автора',
    'header.donate': 'Donate',
    'header.donateTitle': 'Поддержать автора',
    'header.checkProxies': 'Проверка прокси',
    'header.refresh': 'Обновить',
    'header.loadNew': 'Загрузить новое',

    // Navigation
    'nav.overview': 'Обзор',
    'nav.wallets': 'Кошельки',
    'nav.tokens': 'Токены',
    'nav.protocols': 'Протоколы',
    'nav.proxiesCheck': 'Прокси (проверка)',

    // Overview Tab
    'overview.totalValue': 'Общая стоимость',
    'overview.wallets': 'Кошельков',
    'overview.activeAddresses': 'активных адресов',
    'overview.topToken': 'Топ токен',
    'overview.topChain': 'Топ цепочка',
    'overview.chainDistribution': 'Распределение по цепочкам',
    'overview.topTokens': 'Топ токены',
    'overview.topProtocols': 'Топ протоколы',
    'overview.protocol': 'Протокол',
    'overview.chain': 'Цепочка',
    'overview.category': 'Категория',
    'overview.value': 'Стоимость',
    'overview.aggregated': 'Агрегировано',
    'tokens.ofTopTen': 'от топ-10',
    'tokens.aggregatedAcrossNetworks': 'Агрегированно по всем сетям',
    'overview.for24h': 'за 24ч',

    // Wallets Tab
    'wallets.title': 'Кошельки',
    'wallets.selected': 'Выбрано',
    'wallets.total': 'Всего кошельков',
    'wallets.page': 'Страница',
    'wallets.of': 'из',
    'wallets.id': 'ID',
    'wallets.address': 'Адрес',
    'wallets.balance': 'Баланс',
    'wallets.chains': 'Цепочки',
    'wallets.tokens': 'Токены',
    'wallets.protocols': 'Протоколы',
    'wallets.inProtocols': 'В протоколах',
    'wallets.updated': 'Обновлено',
    'wallets.actions': 'Действия',
    'wallets.copyAddress': 'Копировать адрес',
    'wallets.openInDeBank': 'Открыть в DeBank',
    'wallets.includeInCalculations': 'Включить в расчеты',
    'wallets.deselectAll': 'Снять выделение со всех кошельков',
    'wallets.selectAllVisible': 'Выбрать все отображаемые',
    'wallets.deselectAllVisible': 'Снять выделение со всех отображаемых',
    'wallets.searchPlaceholder': 'Поиск по адресу или ID...',
    'wallets.hideUnder': 'Не показывать < $0.5',
    'wallets.all': 'Все',
    'wallets.tier1': 'Tier 1',
    'wallets.tier2': 'Tier 2',
    'wallets.tier3': 'Tier 3',
    'wallets.noTier': 'Без тира',
    'wallets.addToTier': 'В Tier ▾',
    'wallets.addToTier1': 'Добавить в Tier 1',
    'wallets.addToTier2': 'Добавить в Tier 2',
    'wallets.addToTier3': 'Добавить в Tier 3',
    'wallets.removeFromTier': 'Удалить из Tier',
    'wallets.noWalletsFound': 'Кошельки не найдены',
    'wallets.noWalletsDescription': 'Нет доступных кошельков для отображения',
    'wallets.perPage': 'на странице',
    'wallets.first': 'Первая',
    'wallets.previous': 'Назад',
    'wallets.next': 'Вперед',
    'wallets.last': 'Последняя',
    'wallets.showing': 'Показано',

    // Tokens Tab
    'tokens.title': 'Токены',
    'tokens.chainDistribution': 'Распределение токенов по цепочкам',
    'tokens.topTokensByValue': 'Топ токены по стоимости',
    'tokens.token': 'Токен',
    'tokens.chain': 'Цепочка',
    'tokens.balance': 'Баланс',
    'tokens.symbol': 'Символ',
    'tokens.price': 'Цена',
    'tokens.value': 'Стоимость',
    'tokens.groups': 'групп',
    'tokens.showing': 'Показано',
    'tokens.groupsOf': 'групп из',
    'tokens.tokensTotal': 'токенов',
    'tokens.walletsWithToken': 'Кошельки с этим токеном:',

    // Protocols Tab
    'protocols.title': 'Протоколы',
    'protocols.topProtocolsByValue': 'Топ протоколы по стоимости',
    'protocols.protocolDistribution': 'Распределение по протоколам',
    'protocols.protocol': 'Протокол',
    'protocols.chain': 'Цепочка',
    'protocols.category': 'Категория',
    'protocols.value': 'Стоимость',
    'protocols.actions': 'Действия',
    'protocols.showing': 'Показано',
    'protocols.of': 'из',
    'protocols.walletsWithFunds': 'Кошельки с средствами в протоколе:',

    // Proxies Tab
    'proxies.title': 'Прокси',
    'proxies.status': 'Статус',
    'proxies.url': 'URL',
    'proxies.responseTime': 'Время отклика',
    'proxies.lastCheck': 'Последняя проверка',
    'proxies.working': 'Работает',
    'proxies.failed': 'Не работает',
    'proxies.checking': 'Проверка',
    'proxies.total': 'Всего',
    'proxies.checkAll': 'Проверить все',
    'proxies.ms': 'мс',
    'proxies.protocol': 'Протокол',
    'proxies.address': 'Адрес',
    'proxies.port': 'Порт',
    'proxies.error': 'Ошибка',
    'proxies.successRate': 'Успешность',
    'proxies.country': 'Страна',
    'proxies.notFound': 'Прокси не найдены',
    'proxies.addToFile': 'Добавьте прокси в файл proxy.txt',

    // Tier Assignment Modal
    'tiers.title': 'Назначить тиры',
    'tiers.description': 'Назначьте кошельки в тиры для лучшей организации',
    'tiers.tier1': 'Tier 1',
    'tiers.tier2': 'Tier 2',
    'tiers.tier3': 'Tier 3',
    'tiers.unassigned': 'Без тира',
    'tiers.assign': 'Назначить',
    'tiers.remove': 'Удалить',
    'tiers.close': 'Закрыть',
    'tiers.cancel': 'Отменить',
    'tiers.apply': 'Применить тиры',
    'tiers.selectWallets': 'Выберите кошельки для назначения',
    'tiers.noWallets': 'Нет выбранных кошельков',

    // Donate Modal
    'donate.title': 'Поддержать проект',
    'donate.description': 'Если EVManager оказался полезен, поддержите разработку!',
    'donate.walletAddress': 'Адрес кошелька:',
    'donate.copyAddress': 'Копировать адрес',
    'donate.qrCode': 'QR код для донатов',
    'donate.thankYou': 'Спасибо за поддержку! ❤️',

    // Notifications
    'notification.autoRefreshEnabled': 'Автообновление включено',
    'notification.autoRefreshDisabled': 'Автообновление выключено',
    'notification.autoRefreshWallet': 'Автообновление: обновлен кошелек',
    'notification.addressCopied': 'Адрес скопирован!',
    'notification.noWalletsSelected': 'Не выбраны кошельки для обновления',
    'notification.serverBusy': 'Сервер уже обрабатывает кошельки. Дождитесь завершения и попробуйте снова.',
    'notification.refreshStarted': 'Запущена обработка {count} кошельков. Отслеживайте прогресс в статусной строке в реальном времени.',
    'notification.refreshError': 'Ошибка при обновлении кошельков: {error}',
    'notification.proxyError': 'Ошибка проверки прокси: {error}',
    'notification.filesReloaded': 'Файлы перечитаны. Прокси и кошельки обновлены',
    'notification.filesReloadedNoWallets': 'Файлы перечитаны. Кошельков не найдено в data/wallets.txt',
    'notification.proxyNotResponding': 'Прокси не отвечает',
    'notification.tiersUpdated': 'Тиры обновлены для {count} кошельков',

    // Refresh Button
    'refresh.updating': 'Обновление...',
    'refresh.busy': 'Занято...',
    'refresh.update': 'Обновить',
    'refresh.selectWallets': 'Выберите кошельки для обновления',
    'refresh.serverBusy': 'Сервер занят обработкой',
    'refresh.updateSelected': 'Обновить {count} выбранных кошельков',

    // Load New Button
    'loadNew.loading': 'Загрузка...',
    'loadNew.loadNew': 'Загрузить новое',
    'loadNew.title': 'Перечитать wallets.txt и proxy.txt',

    // Status Messages
    'status.connectionError': 'Ошибка подключения к серверу',
    'status.loadingError': 'Не удалось загрузить данные',
    'status.walletsLoadError': 'Ошибка загрузки кошельков',

    // Theme Toggle
    'theme.switchToLight': 'Переключить на светлую тему',
    'theme.switchToDark': 'Переключить на тёмную тему',

    // Time
    'time.ago': 'назад',
    'time.seconds': 'с',
    'time.minutes': 'м',
    'time.hours': 'ч',
    'time.days': 'д',
    
    // Common
    'common.wallets': 'кошельков',
    'common.loading': 'Загрузка...',
    'common.error': 'Ошибка',
    'common.noData': 'Нет данных',
    'common.showMore': 'Показать больше',
    'common.viewDetails': 'Подробнее',
    'common.cancel': 'Отменить',
    'common.save': 'Сохранить',
    
    // Filters
    'filters.filters': 'Фильтры',
    'filters.export': 'Экспорт',
    'filters.searchTokens': 'Поиск токенов...',
    'filters.searchProtocols': 'Поиск протоколов...',
    'filters.valueRange': 'Диапазон стоимости',
    'filters.from': 'От',
    'filters.to': 'До',
    'filters.chain': 'Цепочка',
    'filters.allChains': 'Все цепочки',
    'filters.token': 'Токен',
    'filters.allTokens': 'Все токены',
    'filters.protocol': 'Протокол',
    'filters.allProtocols': 'Все протоколы',
    'filters.reset': 'Сбросить фильтры',
    
    // Debug Panel
    'debug.title': 'Панель отладки',
    'debug.loadData': 'Загрузить данные',
    'debug.restartProcessing': 'Перезапустить обработку',
    'debug.processing': 'Обработка...',
    'debug.debugEnabled': 'Отладка включена',
    'debug.debugDisabled': 'Отладка отключена',
    'debug.clearLogs': 'Очистить логи',
    'debug.totalLogs': 'Всего логов',
    'debug.debugData': 'Данные отладки',
    'debug.debugMode': 'Режим отладки',
    'debug.enabled': 'Включено',
    'debug.disabled': 'Отключено',
    'debug.logs': 'Логи',
    'debug.debugging': 'Отладка',
    'debug.logoTest': 'Тест логотипа',
    'debug.systemLogs': 'Системные логи',
    'debug.allLevels': 'Все уровни',
    'debug.errors': 'Ошибки',
    'debug.warnings': 'Предупреждения',
    'debug.info': 'Информация',
    'debug.update': 'Обновить',
    'debug.wallet': 'Кошелек',
    'debug.data': 'Данные',
    'debug.debugDataTitle': 'Данные отладки',
    'debug.walletPlaceholder': 'Адрес кошелька (необязательно)',
    'debug.steps': 'шагов',
    'debug.processingSteps': 'Шаги обработки',
    'debug.networkRequests': 'Сетевые запросы',
    'debug.rawData': 'Сырые данные',
    'debug.processedData': 'Обработанные данные',
    'debug.logoTestRemoved': 'Компонент тестирования логотипа был удален для очистки кода.',
    
    // Status Bar  
    'status.proxies': 'Прокси',
    'status.debug': 'Отладка',
    'status.wallets': 'кошельков',
    'status.processed': 'обработано',
    'status.processing': 'Обработка',
    'status.idle': 'Ожидание',
    'status.errors': 'ошибок',
    'status.database': 'БД',
    'status.mb': 'МБ',
    'status.connectionError': 'Ошибка подключения. Сервер не доступен.',
    
    // Error messages
    'errors.proxyCheck': 'Ошибка проверки прокси: ',
    'errors.unknown': 'Неизвестная ошибка'
  }
};

interface LanguageProviderProps {
  children: ReactNode;
}

export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('language');
    return (saved === 'en' || saved === 'ru') ? saved : 'ru';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string, params?: Record<string, string>): string => {
    const translation = translations[language][key as keyof typeof translations[Language]];
    if (!translation) return key;
    
    if (params) {
      return Object.entries(params).reduce((str, [paramKey, paramValue]) => {
        return str.replace(`{${paramKey}}`, paramValue);
      }, translation);
    }
    
    return translation;
  };

  const value: LanguageContextType = {
    language,
    setLanguage,
    t
  };

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};