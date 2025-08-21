import React, { useState } from 'react';
import { Download, FileSpreadsheet, Users, Clock } from 'lucide-react';
import { apiService } from '../services/api';
import { useWalletSelection } from '../contexts/WalletSelectionContext';

interface ExportOptions {
  selectedWallets?: string[];
  format: 'csv' | 'json';
  batchSize: number;
  includeDetails: boolean;
}

export const AdvancedExport: React.FC = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<string>('');
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
    format: 'csv',
    batchSize: 1000,
    includeDetails: false
  });
  
  const { selectedWallets } = useWalletSelection();

  const handleExport = async (exportType: 'selected' | 'all') => {
    setIsExporting(true);
    setExportProgress('Подготовка экспорта...');
    
    try {
      const walletsToExport = exportType === 'selected' ? Array.from(selectedWallets) : undefined;
      
      if (exportType === 'selected' && (!walletsToExport || walletsToExport.length === 0)) {
        alert('Не выбрано кошельков для экспорта');
        return;
      }

      setExportProgress(`Экспорт ${exportType === 'selected' ? walletsToExport?.length : 'всех'} кошельков...`);

      const blob = await apiService.exportCSV(walletsToExport, exportOptions.format);
      
      // Создаем ссылку для скачивания
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      
      const timestamp = new Date().toISOString().split('T')[0];
      const count = exportType === 'selected' ? walletsToExport?.length : 'all';
      a.download = `wallets_${exportType}_${count}_${timestamp}.${exportOptions.format}`;
      
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setExportProgress('Экспорт завершен успешно!');
      setTimeout(() => setExportProgress(''), 3000);
      
    } catch (error) {
      console.error('Export error:', error);
      setExportProgress('Ошибка при экспорте');
      setTimeout(() => setExportProgress(''), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  const handleBatchExport = async () => {
    setIsExporting(true);
    setExportProgress('Подготовка батчевого экспорта...');
    
    try {
      // Получаем статистику для расчета батчей
      const stats = await apiService.getStats();
      const totalWallets = stats.totalWallets || 0;
      const batchCount = Math.ceil(totalWallets / exportOptions.batchSize);
      
      for (let i = 0; i < batchCount; i++) {
        setExportProgress(`Экспорт батча ${i + 1} из ${batchCount}...`);
        
        // Получаем кошельки для текущего батча
        const offset = i * exportOptions.batchSize;
        const walletsResponse = await apiService.getWallets('totalValue', 'desc', exportOptions.batchSize, offset);
        const walletAddresses = walletsResponse.wallets.map(w => w.address);
        
        // Экспортируем батч
        const blob = await apiService.exportCSV(walletAddresses, exportOptions.format);
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        
        const timestamp = new Date().toISOString().split('T')[0];
        a.download = `wallets_batch_${i + 1}_of_${batchCount}_${timestamp}.${exportOptions.format}`;
        
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        // Небольшая пауза между батчами
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      setExportProgress(`Батчевый экспорт завершен! Создано ${batchCount} файлов.`);
      setTimeout(() => setExportProgress(''), 5000);
      
    } catch (error) {
      console.error('Batch export error:', error);
      setExportProgress('Ошибка при батчевом экспорте');
      setTimeout(() => setExportProgress(''), 5000);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <FileSpreadsheet className="w-5 h-5" />
        Продвинутый экспорт
      </h3>

      {/* Настройки экспорта */}
      <div className="space-y-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Формат
          </label>
          <select
            value={exportOptions.format}
            onChange={(e) => setExportOptions(prev => ({ ...prev, format: e.target.value as 'csv' | 'json' }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={isExporting}
          >
            <option value="csv">CSV</option>
            <option value="json">JSON</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Размер батча для больших экспортов
          </label>
          <select
            value={exportOptions.batchSize}
            onChange={(e) => setExportOptions(prev => ({ ...prev, batchSize: Number(e.target.value) }))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            disabled={isExporting}
          >
            <option value={500}>500 кошельков на файл</option>
            <option value={1000}>1000 кошельков на файл</option>
            <option value={2000}>2000 кошельков на файл</option>
            <option value={5000}>5000 кошельков на файл</option>
          </select>
        </div>

        <div className="flex items-center">
          <input
            type="checkbox"
            id="includeDetails"
            checked={exportOptions.includeDetails}
            onChange={(e) => setExportOptions(prev => ({ ...prev, includeDetails: e.target.checked }))}
            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            disabled={isExporting}
          />
          <label htmlFor="includeDetails" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
            Включить детальную информацию (токены, протоколы)
          </label>
        </div>
      </div>

      {/* Кнопки экспорта */}
      <div className="space-y-3">
        <button
          onClick={() => handleExport('selected')}
          disabled={isExporting || selectedWallets.size === 0}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Users className="w-4 h-4" />
          Экспорт выбранных ({selectedWallets.size})
        </button>

        <button
          onClick={() => handleExport('all')}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Экспорт всех кошельков
        </button>

        <button
          onClick={handleBatchExport}
          disabled={isExporting}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Clock className="w-4 h-4" />
          Батчевый экспорт (по {exportOptions.batchSize})
        </button>
      </div>

      {/* Прогресс */}
      {(isExporting || exportProgress) && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md">
          <div className="flex items-center gap-2">
            {isExporting && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            )}
            <span className="text-sm text-blue-800 dark:text-blue-200">{exportProgress}</span>
          </div>
        </div>
      )}

      {/* Информация */}
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-700 rounded-md">
        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-2">Рекомендации для больших объемов:</h4>
        <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
          <li>• Для 1000+ кошельков используйте батчевый экспорт</li>
          <li>• CSV формат быстрее для больших объемов</li>
          <li>• Детальная информация значительно увеличивает размер файла</li>
          <li>• Экспорт выполняется в фоне, можно продолжать работу</li>
        </ul>
      </div>
    </div>
  );
};