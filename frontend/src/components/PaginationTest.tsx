import React, { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import { WalletData } from '../types';

export const PaginationTest: React.FC = () => {
  const [wallets, setWallets] = useState<WalletData[]>([]);
  const [totalWallets, setTotalWallets] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(50); // 50 кошельков на страницу
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const loadWallets = async (page: number) => {
    setIsLoading(true);
    setError('');
    
    try {
      const offset = (page - 1) * pageSize;
      const response = await apiService.getWallets('totalValue', 'desc', pageSize, offset);
      
      setWallets(response.wallets);
      setTotalWallets(response.total);
      
      console.log(`Loaded page ${page}: ${response.returned} wallets, total: ${response.total}`);
    } catch (err) {
      setError('Ошибка загрузки кошельков');
      console.error('Error loading wallets:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWallets(currentPage);
  }, [currentPage]);

  const totalPages = Math.ceil(totalWallets / pageSize);

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

  const exportSelected = async () => {
    try {
      const selectedAddresses = wallets.slice(0, 10).map(w => w.address); // Экспорт первых 10
      const blob = await apiService.exportCSV(selectedAddresses);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `wallets_page_${currentPage}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Error exporting CSV:', err);
    }
  };

  const getStatsForCurrent = async () => {
    try {
      const selectedAddresses = wallets.map(w => w.address);
      const stats = await apiService.getStats(selectedAddresses);
      console.log('Stats for current page:', stats);
      alert(`Статистика для страницы ${currentPage}: ${JSON.stringify(stats, null, 2)}`);
    } catch (err) {
      console.error('Error getting stats:', err);
    }
  };

  if (totalWallets === 0 && !isLoading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Тест пагинации
        </h3>
        <p className="text-gray-500">Нет кошельков для отображения</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
        Тест пагинации - {totalWallets} кошельков
      </h3>

      {error && (
        <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
          {error}
        </div>
      )}

      {/* Информация о странице */}
      <div className="mb-4 flex justify-between items-center">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          Страница {currentPage} из {totalPages} 
          ({wallets.length} из {totalWallets} кошельков)
        </span>
        
        <div className="space-x-2">
          <button
            onClick={exportSelected}
            className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
            disabled={wallets.length === 0}
          >
            Экспорт страницы
          </button>
          <button
            onClick={getStatsForCurrent}
            className="px-3 py-1 text-sm bg-green-500 text-white rounded hover:bg-green-600"
            disabled={wallets.length === 0}
          >
            Статистика страницы
          </button>
        </div>
      </div>

      {/* Навигация */}
      <div className="mb-4 flex justify-center space-x-2">
        <button
          onClick={() => goToPage(1)}
          disabled={currentPage === 1 || isLoading}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50"
        >
          Первая
        </button>
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1 || isLoading}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50"
        >
          Назад
        </button>
        
        {/* Номера страниц */}
        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
          const pageNum = Math.max(1, currentPage - 2) + i;
          if (pageNum > totalPages) return null;
          
          return (
            <button
              key={pageNum}
              onClick={() => goToPage(pageNum)}
              disabled={isLoading}
              className={`px-3 py-1 text-sm border rounded ${
                pageNum === currentPage 
                  ? 'bg-blue-500 text-white border-blue-500' 
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {pageNum}
            </button>
          );
        })}
        
        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages || isLoading}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50"
        >
          Вперед
        </button>
        <button
          onClick={() => goToPage(totalPages)}
          disabled={currentPage === totalPages || isLoading}
          className="px-3 py-1 text-sm border rounded disabled:opacity-50"
        >
          Последняя
        </button>
      </div>

      {/* Список кошельков */}
      {isLoading ? (
        <div className="text-center py-8">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <p className="mt-2 text-gray-500">Загрузка кошельков...</p>
        </div>
      ) : (
        <div className="space-y-2">
          {wallets.map((wallet, index) => (
            <div key={wallet.address} className="flex justify-between items-center p-3 border rounded">
              <div>
                <span className="font-mono text-sm">{wallet.address}</span>
                <span className="ml-2 text-xs text-gray-500">
                  #{(currentPage - 1) * pageSize + index + 1}
                </span>
              </div>
              <div className="text-right">
                <div className="font-semibold">${wallet.totalValue.toFixed(2)}</div>
                <div className="text-xs text-gray-500">
                  {wallet.chains?.length || 0} сетей
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};