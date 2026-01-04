
import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface Option {
  value: string;
  label: string;
}

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  icon?: React.ReactNode;
  className?: string;
}

export const CustomSelect: React.FC<CustomSelectProps> = ({ 
  value, 
  onChange, 
  options, 
  placeholder = 'Select...', 
  icon,
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find(o => o.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative min-w-[200px] ${className}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between
          pl-12 pr-4 py-3 bg-white border border-slate-200 
          rounded-2xl text-sm font-bold text-slate-700 
          shadow-sm transition-all duration-200
          hover:border-indigo-300 hover:shadow-md
          focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500
          ${isOpen ? 'ring-4 ring-indigo-500/10 border-indigo-500' : ''}
        `}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronDown 
          size={16} 
          className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180 text-indigo-500' : ''}`} 
        />
      </button>

      {/* Leading Icon */}
      {icon && (
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
          {icon}
        </div>
      )}

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-[60] animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="bg-white/80 backdrop-blur-xl border border-white/40 rounded-2xl shadow-2xl ring-1 ring-black/5 overflow-hidden max-h-60 overflow-y-auto custom-scrollbar p-1.5">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`
                  w-full text-left px-4 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center justify-between group
                  ${option.value === value 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm' 
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}
                `}
              >
                <span className="truncate">{option.label}</span>
                {option.value === value && <Check size={14} className="text-indigo-600 shrink-0 ml-2" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
