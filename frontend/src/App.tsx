import React, { useState, useEffect } from 'react';
import { TrendingUp, Wallet, BarChart3, PieChart, Bug, RefreshCw, Shield, Users, RotateCcw, Heart, Send, Copy, Languages, Menu, X } from 'lucide-react';
import QRCode from 'qrcode';
import { TabType, ServerStatus } from './types';
import { apiService } from './services/api';
import { cn } from './utils/helpers';
import OverviewTab from './components/OverviewTab';
import WalletsTab from './components/WalletsTab';
import TokensTab from './components/TokensTab';
import ProtocolsTab from './components/ProtocolsTab';
import ProxiesTab from './components/ProxiesTab';
import DebugPanel from './components/DebugPanel';
import StatusBar from './components/StatusBar';
import RefreshButton from './components/RefreshButton';
import LoadNewButton from './components/LoadNewButton';
import ThemeToggle from './components/ThemeToggle';
import TierAssignmentModal from './components/TierAssignmentModal';
import { WalletSelectionProvider } from './contexts/WalletSelectionContext';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import { NotificationProvider, useNotification } from './contexts/NotificationContext';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';

const AppInner: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTierModalOpen, setIsTierModalOpen] = useState(false);
  const [isAutoRefreshEnabled, setIsAutoRefreshEnabled] = useState(() => {
    const saved = localStorage.getItem('autoRefreshEnabled');
    return saved === 'true' ? true : false;
  });
  const [isDonateModalOpen, setIsDonateModalOpen] = useState(false);
  const [qrCodeDataURL, setQrCodeDataURL] = useState<string>('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme } = useTheme();
  const { showNotification } = useNotification();
  const { language, setLanguage, t } = useLanguage();

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const statusData = await apiService.getStatus();
        setStatus(statusData);
        setError(null);
      } catch (err) {
        setError(t('status.connectionError'));
        setStatus({
          status: 'offline',
          walletsCount: 0,
          processedWalletsCount: 0,
          walletsInDatabase: 0,
          isProcessing: false,
          database: {
            total: 0,
            lastFetch: 'Unknown',
            size: '0 MB'
          },
          offlineMode: true,
          proxyStatus: {
            currentProxy: 'None',
            working: 0,
            failed: 0,
            checking: false
          }
        } as ServerStatus);
        console.error('Error fetching status:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStatus();
    
    // Smart status updates with single interval
    let intervalId: NodeJS.Timeout;
    
    const createInterval = () => {
      intervalId = setInterval(async () => {
        try {
          const currentStatus = await apiService.getStatus();
          setStatus(currentStatus);
          setError(null);
          
          // Adaptive frequency: more frequent during processing
          if (currentStatus.isProcessing !== status?.isProcessing) {
            // Processing status changed - recreate interval with new frequency
            clearInterval(intervalId);
            createInterval();
          }
        } catch (err) {
          setError(t('status.connectionError'));
          console.error('Error fetching status:', err);
        }
      }, status?.isProcessing ? 3000 : 15000); // 3 sec during processing, 15 sec in normal mode
    };
    
    createInterval();

    return () => clearInterval(intervalId);
  }, []); // Create interval only once on mount

  // Auto-refresh wallets
  useEffect(() => {
    // If auto refresh is disabled, don't create any interval
    if (!isAutoRefreshEnabled) {
      return;
    }

    const autoRefreshWallets = async () => {
      // Double-check that auto-refresh is still enabled when the interval fires
      if (!isAutoRefreshEnabled) {
        console.log('Auto-refresh disabled, skipping wallet update');
        return;
      }

      try {
        // Получаем все кошельки
        const walletsData = await apiService.getWallets();
        const wallets = walletsData.wallets || [];
        
        // Фильтруем кошельки, которые не обновлялись больше 24 часов
        const now = new Date().getTime();
        const dayInMs = 24 * 60 * 60 * 1000;
        
        const staleWallets = wallets.filter(wallet => {
          if (!wallet.lastUpdated) return true;
          const lastUpdated = new Date(wallet.lastUpdated).getTime();
          return (now - lastUpdated) > dayInMs;
        });

        if (staleWallets.length > 0 && !status?.isProcessing) {
          // Сортируем кошельки по дате последнего обновления (самые старые в начале)
          const sortedStaleWallets = staleWallets.sort((a, b) => {
            const aTime = a.lastUpdated ? new Date(a.lastUpdated).getTime() : 0;
            const bTime = b.lastUpdated ? new Date(b.lastUpdated).getTime() : 0;
            return aTime - bTime; // Возрастающий порядок - самые старые первыми
          });
          
          // Берем самый старый кошелек для обновления
          const walletToUpdate = sortedStaleWallets[0];
          const lastUpdateText = walletToUpdate.lastUpdated 
            ? `last updated ${Math.round((now - new Date(walletToUpdate.lastUpdated).getTime()) / (60 * 60 * 1000))}h ago`
            : 'never updated';
          
          console.log(`Auto-refresh: updating oldest wallet ${walletToUpdate.address} (${lastUpdateText})`);
          
          await apiService.refreshWallets([walletToUpdate.address]);
          showNotification(`${t('notification.autoRefreshWallet')} ${walletToUpdate.address.slice(0, 6)}...`, 'info');
        }
      } catch (error) {
        console.error('Auto-refresh error:', error);
      }
    };

    // Запускаем автообновление каждую минуту
    const autoRefreshInterval = setInterval(autoRefreshWallets, 60000);
    
    return () => {
      console.log('Clearing auto-refresh interval');
      clearInterval(autoRefreshInterval);
    };
  }, [isAutoRefreshEnabled, status?.isProcessing, showNotification, t]);

  const toggleAutoRefresh = () => {
    const newState = !isAutoRefreshEnabled;
    setIsAutoRefreshEnabled(newState);
    localStorage.setItem('autoRefreshEnabled', newState.toString());
    showNotification(
      `${t('notification.autoRefresh' + (newState ? 'Enabled' : 'Disabled'))}`, 
      'info'
    );
  };

  const donateAddress = '0x47d65daa4a24b60262eb3de244f934d535776f22';
  
  const copyDonateAddress = () => {
    navigator.clipboard.writeText(donateAddress);
    showNotification(t('notification.addressCopied'), 'success');
  };

  // Generate QR code when modal opens
  useEffect(() => {
    if (isDonateModalOpen && !qrCodeDataURL) {
      const generateQRCode = async () => {
        try {
          // Generate QR code using proper EVM wallet format
          const qrData = `ethereum:${donateAddress}`;
          const qrDataURL = await QRCode.toDataURL(qrData, {
            width: 192,
            margin: 2,
            color: {
              dark: '#000000',
              light: '#FFFFFF'
            }
          });
          setQrCodeDataURL(qrDataURL);
        } catch (error) {
          console.error('Error generating QR code:', error);
          // Fallback to plain address
          try {
            const qrDataURL = await QRCode.toDataURL(donateAddress, {
              width: 192,
              margin: 2,
              color: {
                dark: '#000000',
                light: '#FFFFFF'
              }
            });
            setQrCodeDataURL(qrDataURL);
          } catch (fallbackError) {
            console.error('Fallback QR generation failed:', fallbackError);
          }
        }
      };
      generateQRCode();
    }
  }, [isDonateModalOpen, donateAddress, qrCodeDataURL]);

  // Проверяем режим разработки
  const isDevelopment = import.meta.env.DEV;

  const tabs = [
    { id: 'overview', label: t('nav.overview'), icon: TrendingUp },
    { id: 'wallets', label: t('nav.wallets'), icon: Wallet },
    { id: 'tokens', label: t('nav.tokens'), icon: BarChart3 },
    { id: 'protocols', label: t('nav.protocols'), icon: PieChart },
    // Show debug tab only in development mode
    ...(isDevelopment ? [{ id: 'debug', label: t('status.debug'), icon: Bug }] : []),
  ];

  const renderTabContent = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'wallets':
        return <WalletsTab status={status} />;
      case 'tokens':
        return <TokensTab />;
      case 'protocols':
        return <ProtocolsTab />;
      case 'proxies':
        return <ProxiesTab />;
      case 'debug':
        return isDevelopment ? <DebugPanel /> : <OverviewTab />;
      default:
        return <OverviewTab />;
    }
  };

  if (isLoading) {
    return (
      <div className={cn(
        "min-h-screen flex items-center justify-center",
        theme === 'dark' 
          ? "bg-gradient-to-br from-slate-900 to-slate-800" 
          : "bg-gradient-to-br from-gray-50 to-gray-100"
      )}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className={theme === 'dark' ? "text-slate-300" : "text-gray-600"}>{t('header.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
        "min-h-screen",
        theme === 'dark' 
          ? "bg-gradient-to-br from-slate-900 to-slate-800" 
          : "bg-gradient-to-br from-gray-50 to-gray-100"
      )}>
      {/* Header */}
      <header className={cn(
        "shadow-lg border-b",
        theme === 'dark' 
          ? "bg-slate-800 border-slate-700" 
          : "bg-gray-50 border-gray-200"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo and Title */}
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs font-bold">EVM</span>
              </div>
              <div className="flex flex-col">
                <h1 className={cn(
                  "text-xl font-bold leading-tight",
                  theme === 'dark' ? "text-slate-100" : "text-gray-900"
                )}>{t('header.title')}</h1>
                
                {/* Server status */}
                {status && (
                  <div className="flex items-center space-x-1 mt-0.5">
                    {status.status === 'running' ? (
                      <div className="w-1.5 h-1.5 bg-green-400 rounded-full"></div>
                    ) : (
                      <div className="w-1.5 h-1.5 bg-red-400 rounded-full"></div>
                    )}
                    <span className={cn(
                      "text-xs font-medium",
                      status.status === 'running' ? "text-green-400" : "text-red-400"
                    )}>
                      {status.status === 'running' ? t('header.online') : t('header.offline')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center space-x-2">
              <button
                onClick={() => setIsTierModalOpen(true)}
                className={cn(
                  "flex items-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors h-9",
                  theme === 'dark' 
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-200" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-700"
                )}
                title={t('header.assignTiers')}
              >
                <Users className="w-4 h-4" />
                <span>{t('header.assignTiers')}</span>
              </button>
              <button
                onClick={toggleAutoRefresh}
                className={cn(
                  "flex items-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors h-9",
                  isAutoRefreshEnabled
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : theme === 'dark' 
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-200" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-700"
                )}
                title={isAutoRefreshEnabled 
                  ? t('header.autoRefreshEnabled')
                  : t('header.autoRefreshDisabled')
                }
              >
                <RotateCcw className={cn("w-4 h-4", isAutoRefreshEnabled && "animate-spin")} />
                <span>{t('header.autoRefresh')}</span>
              </button>
              <button
                onClick={async () => {
                  try {
                    console.log('Checking proxies...');
                    setActiveTab('proxies'); // Переключаемся на вкладку сразу
                    await apiService.checkProxies();
                    console.log('Proxies check completed');
                  } catch (error) {
                    console.error('Error checking proxies:', error);
                    const errorMsg = (error as any)?.response?.data?.error || (error as any)?.message || 'Неизвестная ошибка';
                    showNotification('Ошибка проверки прокси: ' + errorMsg, 'error');
                  }
                }}
                className={cn(
                  "flex items-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors h-9",
                  theme === 'dark' 
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-200" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-700"
                )}
                title={t('header.checkProxies')}
              >
                <Shield className="w-4 h-4" />
                <span>{t('header.checkProxies')}</span>
              </button>
              <RefreshButton />
              <LoadNewButton />
              <a
                href="https://t.me/IdeaMint"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  "flex items-center justify-center p-2 rounded-lg transition-colors h-9 w-9",
                  theme === 'dark' 
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-200" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-700"
                )}
                title={t('header.telegramTitle')}
              >
                <Send className="w-4 h-4" />
              </a>
              <button
                onClick={() => setIsDonateModalOpen(true)}
                className={cn(
                  "flex items-center justify-center p-2 rounded-lg transition-colors h-9 w-9",
                  theme === 'dark' 
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-200" 
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-700"
                )}
                title={t('header.donateTitle')}
              >
                <Heart className="w-4 h-4" />
              </button>
            </div>

            {/* Mobile menu button and basic controls */}
            <div className="flex items-center space-x-2">
              {/* Language and theme toggle - always visible */}
              <button
                onClick={() => setLanguage(language === 'ru' ? 'en' : 'ru')}
                className={cn(
                  "px-2 py-1 rounded-lg border transition-colors duration-200 h-9 flex items-center justify-center",
                  theme === 'dark'
                    ? "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-slate-200"
                    : "bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 hover:text-gray-800"
                )}
                title={language === 'ru' ? 'Switch to English' : 'Переключить на русский'}
              >
                <div className="flex items-center space-x-1">
                  <Languages className="w-4 h-4" />
                  <span className="text-xs font-medium">{language.toUpperCase()}</span>
                </div>
              </button>
              <ThemeToggle />
              
              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className={cn(
                  "lg:hidden p-2 rounded-lg transition-colors h-9 w-9 flex items-center justify-center",
                  theme === 'dark'
                    ? "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-200"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-700"
                )}
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className={cn(
            "lg:hidden border-t",
            theme === 'dark' ? "border-slate-700 bg-slate-800" : "border-gray-200 bg-gray-50"
          )}>
            <div className="px-4 py-3 space-y-3">
              {/* Mobile action buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    setIsTierModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors justify-center",
                    theme === 'dark' 
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-200" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-700"
                  )}
                >
                  <Users className="w-4 h-4" />
                  <span>{t('header.assignTiers')}</span>
                </button>
                <button
                  onClick={() => {
                    toggleAutoRefresh();
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors justify-center",
                    isAutoRefreshEnabled
                      ? "bg-green-600 text-white hover:bg-green-700"
                      : theme === 'dark' 
                        ? "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-200" 
                        : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-700"
                  )}
                >
                  <RotateCcw className={cn("w-4 h-4", isAutoRefreshEnabled && "animate-spin")} />
                  <span>{t('header.autoRefresh')}</span>
                </button>
                <button
                  onClick={async () => {
                    try {
                      setActiveTab('proxies');
                      await apiService.checkProxies();
                      setIsMobileMenuOpen(false);
                    } catch (error) {
                      console.error('Error checking proxies:', error);
                      const errorMsg = (error as any)?.response?.data?.error || (error as any)?.message || 'Неизвестная ошибка';
                      showNotification('Ошибка проверки прокси: ' + errorMsg, 'error');
                    }
                  }}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors justify-center",
                    theme === 'dark' 
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-200" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-700"
                  )}
                >
                  <Shield className="w-4 h-4" />
                  <span>{t('header.checkProxies')}</span>
                </button>
                <button
                  onClick={() => {
                    setIsDonateModalOpen(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex items-center space-x-2 px-3 py-2 rounded-lg font-medium text-sm transition-colors justify-center",
                    theme === 'dark' 
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-200" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-700"
                  )}
                >
                  <Heart className="w-4 h-4" />
                  <span>{t('header.donate')}</span>
                </button>
              </div>
              
              <div className="flex space-x-2">
                <RefreshButton />
                <LoadNewButton />
                <a
                  href="https://t.me/IdeaMint"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center justify-center p-2 rounded-lg transition-colors h-9 w-9",
                    theme === 'dark' 
                      ? "bg-slate-700 text-slate-300 hover:bg-slate-600 hover:text-slate-200" 
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-700"
                  )}
                  title={t('header.telegramTitle')}
                >
                  <Send className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Navigation Tabs */}
      <nav className={cn(
        "border-b",
        theme === 'dark' 
          ? "bg-slate-800 border-slate-700" 
          : "bg-gray-50 border-gray-200"
      )}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-4 lg:space-x-8 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as TabType);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex items-center space-x-2 py-4 px-2 lg:px-1 font-medium text-sm transition-colors whitespace-nowrap",
                    activeTab === tab.id
                      ? "text-blue-400"
                      : theme === 'dark' 
                        ? "text-slate-400 hover:text-slate-300"
                        : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Status Bar */}
      {status && <StatusBar status={status} />}

      {/* Error Message */}
      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <div className="bg-red-900/20 border border-red-700 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-white text-xs">!</span>
                </div>
              </div>
              <div className="ml-3">
                <p className="text-sm text-red-300">{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {renderTabContent()}
      </main>

      {/* Tier Assignment Modal */}
      <TierAssignmentModal 
        isOpen={isTierModalOpen} 
        onClose={() => setIsTierModalOpen(false)} 
      />

      {/* Donate Modal */}
      {isDonateModalOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setIsDonateModalOpen(false)}
        >
          <div 
            className={cn(
              "relative rounded-xl shadow-lg max-w-md w-full p-6",
              theme === 'dark' ? "bg-slate-800" : "bg-gray-50"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              onClick={() => setIsDonateModalOpen(false)}
              className={cn(
                "absolute top-4 right-4 p-1 rounded-lg transition-colors",
                theme === 'dark' ? "hover:bg-slate-700" : "hover:bg-gray-100"
              )}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal content */}
            <div className="text-center">
              <Heart className="w-12 h-12 text-pink-500 mx-auto mb-4" />
              <h3 className={cn(
                "text-xl font-bold mb-2",
                theme === 'dark' ? "text-white" : "text-gray-900"
              )}>
                {t('donate.title')}
              </h3>
              <p className={cn(
                "text-sm mb-6",
                theme === 'dark' ? "text-slate-300" : "text-gray-600"
              )}>
                {t('donate.description')}
              </p>

              {/* QR Code */}
              <div className="w-48 h-48 mx-auto mb-4 border border-gray-300 rounded-lg overflow-hidden flex items-center justify-center">
                {qrCodeDataURL ? (
                  <img 
                    src={qrCodeDataURL} 
                    alt={t('donate.qrCode')}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gray-100">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                )}
              </div>

              {/* Wallet address */}
              <div className={cn(
                "p-3 rounded-lg mb-4",
                theme === 'dark' ? "bg-slate-700" : "bg-gray-100"
              )}>
                <p className="text-xs text-gray-500 mb-1">{t('donate.walletAddress')}</p>
                <p className={cn(
                  "font-mono text-sm break-all",
                  theme === 'dark' ? "text-white" : "text-gray-900"
                )}>
                  {donateAddress}
                </p>
              </div>

              {/* Copy button */}
              <button
                onClick={copyDonateAddress}
                className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Copy className="w-4 h-4" />
                <span>{t('donate.copyAddress')}</span>
              </button>

              {/* Thank you message */}
              <p className={cn(
                "text-xs mt-4",
                theme === 'dark' ? "text-slate-400" : "text-gray-500"
              )}>
                {t('donate.thankYou')}<br />
                <span className="font-medium">vlgalib</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const AppContent: React.FC = () => {
  return (
    <LanguageProvider>
      <NotificationProvider>
        <WalletSelectionProvider>
          <AppInner />
        </WalletSelectionProvider>
      </NotificationProvider>
    </LanguageProvider>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
};

export default App; 