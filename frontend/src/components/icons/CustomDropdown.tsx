import React, { useState, useRef, useEffect } from 'react';
import { useTheme } from '../../contexts/ThemeContext';
import { cn } from '../../utils/helpers';

interface DropdownOption {
  value: string;
  label: string;
  logo?: string;
}

interface CustomDropdownProps {
  value: string | string[];
  onChange: (value: string | string[]) => void;
  options: DropdownOption[];
  placeholder: string;
  className?: string;
  multiple?: boolean;
}

const CustomDropdown: React.FC<CustomDropdownProps> = ({
  value,
  onChange,
  options,
  placeholder,
  className = '',
  multiple = false
}) => {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleOptionClick = (optionValue: string) => {
    if (multiple) {
      const currentValues = Array.isArray(value) ? value : (value ? [value] : []);
      const newValues = currentValues.includes(optionValue)
        ? currentValues.filter(v => v !== optionValue)
        : [...currentValues, optionValue];
      onChange(newValues);
    } else {
      onChange(optionValue);
      setIsOpen(false);
    }
  };

  const getSelectedOptions = () => {
    if (multiple) {
      const selectedValues = Array.isArray(value) ? value : (value ? [value] : []);
      return options.filter(option => selectedValues.includes(option.value));
    } else {
      return options.filter(option => option.value === value);
    }
  };

  const getDisplayText = () => {
    const selectedOptions = getSelectedOptions();
    if (selectedOptions.length === 0) {
      return placeholder;
    }
    if (multiple) {
      if (selectedOptions.length === 1) {
        return selectedOptions[0].label;
      }
      return `${selectedOptions.length} выбрано`;
    }
    return selectedOptions[0].label;
  };

  const selectedOptions = getSelectedOptions();

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Кнопка dropdown */}
      <button
        type="button"
        onClick={handleToggle}
        className={cn(
          "w-full px-3 py-2 border rounded-lg text-sm flex items-center justify-between transition-colors",
          theme === 'dark'
            ? "border-slate-600 bg-slate-800 text-slate-100 hover:border-slate-500"
            : "border-gray-300 bg-white text-gray-900 hover:border-gray-400"
        )}
      >
        <div className="flex items-center space-x-2 min-w-0">
          {selectedOptions.length > 0 && selectedOptions[0].logo && (
            <img
              src={selectedOptions[0].logo}
              alt={selectedOptions[0].label}
              className="w-4 h-4 rounded-full flex-shrink-0"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          )}
          <span className="truncate">{getDisplayText()}</span>
        </div>
        <svg
          className={cn(
            "w-4 h-4 transition-transform",
            isOpen ? 'rotate-180' : '',
            theme === 'dark' ? "text-slate-400" : "text-gray-500"
          )}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Выпадающий список */}
      {isOpen && (
        <div className={cn(
          "absolute z-50 w-full mt-1 rounded-lg shadow-lg max-h-60 overflow-y-auto",
          theme === 'dark'
            ? "bg-slate-800 border border-slate-600"
            : "bg-white border border-gray-200"
        )}>
          {options.map((option) => {
            const isSelected = multiple
              ? Array.isArray(value) && value.includes(option.value)
              : value === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => handleOptionClick(option.value)}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors flex items-center space-x-2",
                  theme === 'dark'
                    ? `hover:bg-slate-700 ${isSelected ? 'bg-slate-700 text-slate-100' : 'text-slate-300'}`
                    : `hover:bg-gray-100 ${isSelected ? 'bg-gray-100 text-gray-900' : 'text-gray-700'}`
                )}
              >
                {option.logo && (
                  <img
                    src={option.logo}
                    alt={option.label}
                    className="w-4 h-4 rounded-full flex-shrink-0"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none';
                    }}
                  />
                )}
                <span className="truncate">{option.label}</span>
                {isSelected && (
                  <svg className={cn(
                    "w-4 h-4 ml-auto",
                    theme === 'dark' ? "text-slate-400" : "text-gray-500"
                  )} fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CustomDropdown; 