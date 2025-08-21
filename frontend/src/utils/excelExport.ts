import * as ExcelJS from 'exceljs';

export const exportToExcel = async (data: any[], filename: string, sheetName: string = 'Data') => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  if (data.length > 0) {
    const headers = Object.keys(data[0]);
    worksheet.addRow(headers);
    data.forEach(row => {
      const rowData = headers.map(header => row[header]);
      worksheet.addRow(rowData);
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

// Функция для экспорта токенов - простая и линейная без учета фильтров
export const exportTokensToExcel = (allWallets: any[] = [], selectedWallets: Set<string>) => {
  const exportData: any[] = [];
  
  // Если никакие кошельки не выбраны, экспортируем все
  const shouldExportAll = selectedWallets.size === 0;
  
  allWallets.forEach(wallet => {
    const shouldInclude = shouldExportAll || selectedWallets.has(wallet.address);
    
    if (shouldInclude && wallet.tokens && wallet.tokens.length > 0) {
      wallet.tokens.forEach((token: any) => {
        exportData.push({
          'Symbol': token.symbol,
          'Chain': token.chain,
          'Balance': token.balance,
          'Price_USD': token.price,
          'Value_USD': token.value,
          'Wallet_Address': wallet.address
        });
      });
    }
  });
  
  // Создаем осмысленное имя файла с датой
  const date = new Date().toISOString().split('T')[0];
  const filename = `EVManager_Tokens_Export_${date}`;
  
  exportToExcel(exportData, filename, 'Tokens');
};

// Функция для экспорта протоколов - простая и линейная без учета фильтров
export const exportProtocolsToExcel = (allWallets: any[] = [], selectedWallets: Set<string>) => {
  const exportData: any[] = [];
  
  // Если никакие кошельки не выбраны, экспортируем все
  const shouldExportAll = selectedWallets.size === 0;
  
  allWallets.forEach(wallet => {
    const shouldInclude = shouldExportAll || selectedWallets.has(wallet.address);
    
    if (shouldInclude && wallet.protocols && wallet.protocols.length > 0) {
      wallet.protocols.forEach((protocol: any) => {
        exportData.push({
          'Protocol_Name': protocol.name,
          'Chain': protocol.chain,
          'Category': protocol.category || 'defi',
          'Value_USD': protocol.value,
          'Wallet_Address': wallet.address
        });
      });
    }
  });
  
  // Создаем осмысленное имя файла с датой
  const date = new Date().toISOString().split('T')[0];
  const filename = `EVManager_Protocols_Export_${date}`;
  
  exportToExcel(exportData, filename, 'Protocols');
};

// Функция для экспорта кошельков
export const exportWalletsToExcel = (wallets: any[]) => {
  const exportData = wallets.map(wallet => ({
    'Wallet_Address': wallet.address,
    'Total_Value_USD': wallet.totalValue,
    'Token_Count': wallet.tokens?.length || 0,
    'Protocol_Count': wallet.protocols?.length || 0,
    'Chains': wallet.chains?.map((chain: any) => chain.name).join(', ') || '',
    'Last_Updated': wallet.lastUpdated
  }));
  
  // Создаем осмысленное имя файла с датой
  const date = new Date().toISOString().split('T')[0];
  const filename = `EVManager_Wallets_Export_${date}`;
  
  exportToExcel(exportData, filename, 'Wallets');
}; 