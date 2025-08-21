import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../utils/helpers';

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLanguage();

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "p-2 rounded-lg border transition-colors duration-200 h-9 w-9 flex items-center justify-center",
        theme === 'dark' 
          ? "bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600 hover:text-slate-200"
          : "bg-gray-50 border-gray-300 text-gray-600 hover:bg-gray-100 hover:text-gray-700"
      )}
      title={theme === 'dark' ? t('theme.switchToLight') : t('theme.switchToDark')}
    >
      {theme === 'dark' ? (
        <Sun className="w-5 h-5" />
      ) : (
        <Moon className="w-5 h-5" />
      )}
    </button>
  );
};

export default ThemeToggle;