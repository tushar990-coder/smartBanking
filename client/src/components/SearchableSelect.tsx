import React, { useState, useEffect, useRef } from 'react';

const convertMarathiDigits = (val: string): string => {
  if (!val) return val;
  return val.replace(/[०-९]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0966 + 48));
};

interface SearchableSelectProps {
  id?: string;
  options?: Array<{ value: string | number; label: string }>;
  value?: string | number;
  onChange?: (e: { target: { name?: string; value: string | number } }) => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  options = [],
  value,
  onChange,
  name,
  placeholder = "- निवडा -",
  disabled = false,
  className
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  const inputId = id ? `${id}-input` : (name ? `${name}-input` : 'searchable-select-input');
  const inputName = name ? `${name}Search` : 'searchableSelectSearch';

  const safeOptions = Array.isArray(options) ? options : [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = safeOptions.find((o: any) => String(o.value) === String(value));
  const normalizedSearch = convertMarathiDigits(searchTerm).toLowerCase().trim();
  const filteredOptions = safeOptions.filter((o: any) => {
    const normLabel = convertMarathiDigits(o.label || '').toLowerCase();
    const normVal = convertMarathiDigits(String(o.value || '')).toLowerCase();
    return normLabel.includes(normalizedSearch) || normVal === normalizedSearch || normVal.includes(normalizedSearch);
  });

  const triggerChange = (selectedVal: string | number) => {
    if (!onChange) return;
    const syntheticEvent = {
      target: { name, value: selectedVal },
      currentTarget: { name, value: selectedVal },
      name,
      value: selectedVal,
      toString: () => String(selectedVal),
      valueOf: () => selectedVal
    };
    onChange(syntheticEvent as any);
  };

  const defaultWrapperClass = `w-full border border-slate-300 px-3 py-2 rounded-lg flex justify-between items-center transition duration-150 text-xs font-medium ${
    disabled
      ? 'bg-slate-100 border-slate-200 cursor-not-allowed opacity-70 text-slate-400'
      : 'bg-white cursor-pointer hover:border-slate-400 focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-500/20 text-slate-900'
  }`;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        id={id}
        className={className || defaultWrapperClass}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
      >
        <span className="truncate text-slate-800 text-xs font-medium" title={selectedOption ? selectedOption.label : ''}>
          {selectedOption ? selectedOption.label : <span className="text-slate-400 font-normal">{placeholder}</span>}
        </span>
        <span className="text-slate-400 ml-1.5 shrink-0 text-[10px]">▼</span>
      </div>

      {isOpen && (
        <div className="absolute z-50 min-w-full w-max max-w-[520px] left-0 mt-1 bg-white border border-slate-300 shadow-xl rounded-xl max-h-60 overflow-y-auto">
          <div className="sticky top-0 bg-slate-50 p-2 border-b border-slate-200 z-10">
            <input
              id={inputId}
              name={inputName}
              aria-label={placeholder || "शोधा..."}
              type="text"
              className="w-full border border-slate-300 px-2.5 py-1.5 text-xs rounded-lg focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 bg-white"
              placeholder="नाव, कोड किंवा नंबरने शोधा..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredOptions.length > 0) {
                    triggerChange(filteredOptions[0].value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }
                } else if (e.key === 'Escape') {
                  setIsOpen(false);
                }
              }}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
          </div>
          <div
            className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-xs text-slate-500 border-b border-slate-100 font-medium"
            onClick={() => {
              triggerChange('');
              setIsOpen(false);
              setSearchTerm('');
            }}
          >
            {placeholder}
          </div>
          {filteredOptions.map((option: any, idx: number) => (
            <div
              key={`${option.value}-${idx}`}
              title={option.label}
              className={`px-3 py-2 hover:bg-indigo-50 cursor-pointer text-xs whitespace-nowrap transition duration-100 ${
                String(value) === String(option.value)
                  ? 'bg-indigo-100 font-bold text-indigo-900'
                  : 'text-slate-700'
              }`}
              onClick={() => {
                triggerChange(option.value);
                setIsOpen(false);
                setSearchTerm('');
              }}
            >
              {option.label}
            </div>
          ))}
          {filteredOptions.length === 0 && (
            <div className="px-3 py-4 text-slate-400 text-xs text-center">माहिती आढळली नाही</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
