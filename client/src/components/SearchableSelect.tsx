import React, { useState, useEffect, useRef } from 'react';

const convertMarathiDigits = (val: string): string => {
  if (!val) return val;
  return val.replace(/[०-९]/g, (d) => String.fromCharCode(d.charCodeAt(0) - 0x0966 + 48));
};

export interface SearchableSelectOption {
  value: string | number;
  label: string;
  subLabel?: string;
  badge?: string;
  badgeColor?: string;
}

interface SearchableSelectProps {
  id?: string;
  options?: Array<SearchableSelectOption>;
  value?: string | number;
  onChange?: (e: { target: { name?: string; value: string | number } }) => void;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  required?: boolean;
  tabIndex?: number;
}

const focusNext = (current: HTMLElement | null) => {
  if (!current) return;
  const selector = 'input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]:not([disabled])';
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))
    .filter(el => el.offsetParent !== null && !el.hasAttribute('disabled') && el.getAttribute('tabindex') !== '-1');
  const idx = elements.indexOf(current);
  if (idx !== -1 && idx + 1 < elements.length) {
    elements[idx + 1].focus();
  }
};

const focusPrev = (current: HTMLElement | null) => {
  if (!current) return;
  const selector = 'input:not([disabled]):not([tabindex="-1"]), select:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]):not([tabindex="-1"]), button:not([disabled]):not([tabindex="-1"]), [tabindex="0"]:not([disabled])';
  const elements = Array.from(document.querySelectorAll<HTMLElement>(selector))
    .filter(el => el.offsetParent !== null && !el.hasAttribute('disabled') && el.getAttribute('tabindex') !== '-1');
  const idx = elements.indexOf(current);
  if (idx > 0) {
    elements[idx - 1].focus();
  }
};

const SearchableSelect: React.FC<SearchableSelectProps> = ({
  id,
  options = [],
  value,
  onChange,
  name,
  placeholder = "- निवडा -",
  disabled = false,
  className,
  tabIndex
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

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
    const normSub = convertMarathiDigits(o.subLabel || '').toLowerCase();
    const normBadge = convertMarathiDigits(o.badge || '').toLowerCase();
    const normVal = convertMarathiDigits(String(o.value || '')).toLowerCase();
    return normLabel.includes(normalizedSearch) ||
           normSub.includes(normalizedSearch) ||
           normBadge.includes(normalizedSearch) ||
           normVal === normalizedSearch ||
           normVal.includes(normalizedSearch);
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
      : 'bg-white cursor-pointer hover:border-slate-400 focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 focus:outline-none focus-within:border-indigo-600 focus-within:ring-2 focus-within:ring-indigo-500/20 text-slate-900'
  }`;

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div
        ref={triggerRef}
        id={id}
        tabIndex={disabled ? -1 : (tabIndex ?? 0)}
        role="combobox"
        aria-expanded={isOpen}
        className={className ? `${className} focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600` : defaultWrapperClass}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
        onKeyDown={(e) => {
          if (disabled) return;
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault();
            setIsOpen(true);
          }
        }}
      >
        <span className="truncate text-slate-800 text-xs font-medium" title={selectedOption ? selectedOption.label : ''}>
          {selectedOption ? selectedOption.label : <span className="text-slate-400 font-normal">{placeholder}</span>}
        </span>
        <span className="text-slate-400 ml-1.5 shrink-0 text-[10px]">▼</span>
      </div>

      {isOpen && (
        <div className="absolute z-50 min-w-full sm:min-w-[560px] max-w-[680px] left-0 mt-1 bg-white border border-slate-300 shadow-xl rounded-xl max-h-64 overflow-y-auto">
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
                    setTimeout(() => triggerRef.current?.focus(), 0);
                  }
                } else if (e.key === 'Escape') {
                  setIsOpen(false);
                  setTimeout(() => triggerRef.current?.focus(), 0);
                } else if (e.key === 'Tab') {
                  if (filteredOptions.length > 0 && searchTerm.trim() !== '') {
                    triggerChange(filteredOptions[0].value);
                  }
                  setIsOpen(false);
                  setSearchTerm('');
                  if (!e.shiftKey) {
                    e.preventDefault();
                    focusNext(triggerRef.current);
                  } else {
                    e.preventDefault();
                    focusPrev(triggerRef.current);
                  }
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
              setTimeout(() => triggerRef.current?.focus(), 0);
            }}
          >
            {placeholder}
          </div>
          {filteredOptions.map((option: any, idx: number) => {
            const isSelected = String(value) === String(option.value);
            return (
              <div
                key={`${option.value}-${idx}`}
                title={option.label + (option.subLabel ? `\n${option.subLabel}` : '')}
                className={`px-3 py-2 hover:bg-indigo-50/80 cursor-pointer text-xs transition duration-100 border-b border-slate-100 last:border-b-0 ${
                  isSelected
                    ? 'bg-indigo-50 text-indigo-950 font-semibold'
                    : 'text-slate-700'
                }`}
                onClick={() => {
                  triggerChange(option.value);
                  setIsOpen(false);
                  setSearchTerm('');
                  setTimeout(() => triggerRef.current?.focus(), 0);
                }}
              >
                {option.subLabel ? (
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-slate-900 truncate">{option.label}</span>
                      {option.badge && (
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm shrink-0 border ${option.badgeColor || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                          {option.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 truncate">
                      {option.subLabel}
                    </div>
                  </div>
                ) : (
                  <div className="whitespace-nowrap truncate">{option.label}</div>
                )}
              </div>
            );
          })}
          {filteredOptions.length === 0 && (
            <div className="px-3 py-4 text-slate-400 text-xs text-center">माहिती आढळली नाही</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSelect;
