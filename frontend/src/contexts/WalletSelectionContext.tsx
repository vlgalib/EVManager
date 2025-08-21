import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface WalletSelectionContextType {
  selectedWallets: Set<string>;
  tempSelectedWallets: Set<string>;
  setSelectedWallets: (wallets: Set<string>) => void;
  toggleWallet: (address: string) => void;
  selectAll: (addresses: string[]) => void;
  deselectAll: () => void;
  clearSelection: () => void;
  isWalletSelected: (address: string) => boolean;
  saveChanges: () => void;
  discardChanges: () => void;
  hasUnsavedChanges: boolean;
}

const WalletSelectionContext = createContext<WalletSelectionContextType | undefined>(undefined);

interface WalletSelectionProviderProps {
  children: ReactNode;
}

export const WalletSelectionProvider: React.FC<WalletSelectionProviderProps> = ({ children }) => {
  const [selectedWallets, setSelectedWalletsState] = useState<Set<string>>(new Set());
  const [tempSelectedWallets, setTempSelectedWallets] = useState<Set<string>>(new Set());

  // Загрузка сохранённых выбранных кошельков из localStorage при инициализации
  useEffect(() => {
    const savedSelected = localStorage.getItem('selectedWallets');
    if (savedSelected) {
      try {
        const parsed = JSON.parse(savedSelected);
        const walletsSet = new Set(parsed as string[]);
        setSelectedWalletsState(walletsSet);
        setTempSelectedWallets(walletsSet);
      } catch (err) {
        console.error('Error parsing saved wallets:', err);
      }
    }
  }, []);

  // Автосохранение отключено, теперь сохраняем только по кнопке

  const setSelectedWallets = (wallets: Set<string>) => {
    setSelectedWalletsState(wallets);
    setTempSelectedWallets(wallets);
  };

  const toggleWallet = (address: string) => {
    const newSelected = new Set(tempSelectedWallets);
    if (newSelected.has(address)) {
      newSelected.delete(address);
    } else {
      newSelected.add(address);
    }
    setTempSelectedWallets(newSelected);
  };

  const selectAll = (addresses: string[]) => {
    setTempSelectedWallets(new Set(addresses));
  };

  const deselectAll = () => {
    setTempSelectedWallets(new Set());
  };

  const clearSelection = () => {
    const emptySet = new Set<string>();
    setSelectedWalletsState(emptySet);
    setTempSelectedWallets(emptySet);
    localStorage.setItem('selectedWallets', JSON.stringify([]));
  };

  const saveChanges = () => {
    const newSelection = new Set(tempSelectedWallets);
    setSelectedWalletsState(newSelection);
    localStorage.setItem('selectedWallets', JSON.stringify(Array.from(newSelection)));
  };

  const discardChanges = () => {
    setTempSelectedWallets(selectedWallets);
  };

  const isWalletSelected = (address: string) => {
    return tempSelectedWallets.has(address);
  };

  const hasUnsavedChanges = () => {
    if (selectedWallets.size !== tempSelectedWallets.size) return true;
    for (const wallet of Array.from(selectedWallets)) {
      if (!tempSelectedWallets.has(wallet)) return true;
    }
    return false;
  };

  const value: WalletSelectionContextType = {
    selectedWallets,
    tempSelectedWallets,
    setSelectedWallets,
    toggleWallet,
    selectAll,
    deselectAll,
    clearSelection,
    isWalletSelected,
    saveChanges,
    discardChanges,
    hasUnsavedChanges: hasUnsavedChanges(),
  };

  return (
    <WalletSelectionContext.Provider value={value}>
      {children}
    </WalletSelectionContext.Provider>
  );
};

export const useWalletSelection = (): WalletSelectionContextType => {
  const context = useContext(WalletSelectionContext);
  if (!context) {
    throw new Error('useWalletSelection must be used within a WalletSelectionProvider');
  }
  return context;
};