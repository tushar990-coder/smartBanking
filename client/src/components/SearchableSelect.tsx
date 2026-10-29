import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import ReactDOM from 'react-dom';

export const convertMarathiDigits = (val: string): string => {
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
  searchPlaceholder?: string;
  countLabel?: string;
  emptyMessage?: string;
  emptySubMessage?: string;
  onQuickAdd?: (searchText: string) => void;
  quickAddLabel?: string;
  minMenuWidth?: number;
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
  tabIndex,
  searchPlaceholder = "खाते क्र. (ID), खाते नाव किंवा गट कोड (उदा. 1, 28.1)...",
  countLabel = "उपलब्ध खाती",
  emptyMessage = "कोणतीही खाती आढळली नाहीत.",
  emptySubMessage = "खाते क्र. (ID), खाते नाव किंवा गट कोड तपासा.",
  onQuickAdd,
  quickAddLabel = "+ नवीन जोडा",
  minMenuWidth
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState<number>(0);
  const [menuPos, setMenuPos] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  }>({
    top: 0,
    bottom: undefined,
    left: 0,
    width: 320,
    maxHeight: 280
  });

  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuPortalRef = useRef<HTMLDivElement>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  const inputId = id ? `${id}-input` : (name ? `${name}-input` : 'searchable-select-input');
  const inputName = name ? `${name}Search` : 'searchableSelectSearch';

  const safeOptions = Array.isArray(options) ? options : [];

  // Update floating dropdown position before paint whenever opened, scrolled, or resized
  useLayoutEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const hasRichSubLabels = safeOptions.some((o: any) => Boolean(o?.subLabel || o?.badge));
      const effectiveMinWidth =
        typeof minMenuWidth === 'number'
          ? minMenuWidth
          : hasRichSubLabels
            ? 460
            : Math.min(rect.width, 240);

      const desiredWidth = Math.max(rect.width, effectiveMinWidth);
      const clampedWidth = Math.min(desiredWidth, viewportWidth - 24);

      let left = rect.left;
      if (left + clampedWidth > viewportWidth - 12) {
        left = Math.max(12, viewportWidth - clampedWidth - 12);
      }
      if (left < 12) {
        left = 12;
      }

      const spaceBelow = viewportHeight - rect.bottom;
      const spaceAbove = rect.top;
      const rowHeight = hasRichSubLabels ? 46 : 34;
      const estimatedHeight = Math.min(280, 96 + Math.max(1, safeOptions.length) * rowHeight);
      const openUp = spaceBelow < Math.min(200, estimatedHeight + 12) && spaceAbove > spaceBelow;

      const availableHeight = openUp
        ? Math.max(120, Math.min(280, spaceAbove - 16))
        : Math.max(120, Math.min(280, spaceBelow - 16));

      if (openUp) {
        setMenuPos({
          top: undefined,
          bottom: Math.max(8, viewportHeight - rect.top + 4),
          left,
          width: clampedWidth,
          maxHeight: availableHeight
        });
      } else {
        setMenuPos({
          top: rect.bottom + 4,
          bottom: undefined,
          left,
          width: clampedWidth,
          maxHeight: availableHeight
        });
      }
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, safeOptions.length, minMenuWidth]);

  // Click outside to close (checking both trigger and portaled menu)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        menuPortalRef.current && !menuPortalRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = safeOptions.find((o: any) => String(o.value) === String(value));
  const rawSearch = searchTerm.trim();
  const normalizedSearch = convertMarathiDigits(rawSearch).toLowerCase();

  // Smart relevance ranking: Exact ID > ID prefix > Group code > Name prefix > Substring
  const filteredOptions = useMemo(() => {
    if (!normalizedSearch) return safeOptions;

    return safeOptions
      .filter((o: any) => {
        const normLabel = convertMarathiDigits(o.label || '').toLowerCase();
        const normSub = convertMarathiDigits(o.subLabel || '').toLowerCase();
        const normBadge = convertMarathiDigits(o.badge || '').toLowerCase();
        const normVal = convertMarathiDigits(String(o.value || '')).toLowerCase();

        return (
          normVal === normalizedSearch ||
          normVal.startsWith(normalizedSearch) ||
          normVal.includes(normalizedSearch) ||
          normLabel.includes(normalizedSearch) ||
          normSub.includes(normalizedSearch) ||
          normBadge.includes(normalizedSearch) ||
          (rawSearch && (
            (o.label && o.label.toLowerCase().includes(rawSearch.toLowerCase())) ||
            (o.subLabel && o.subLabel.toLowerCase().includes(rawSearch.toLowerCase()))
          ))
        );
      })
      .sort((a: any, b: any) => {
        const valA = convertMarathiDigits(String(a.value || '')).toLowerCase();
        const valB = convertMarathiDigits(String(b.value || '')).toLowerCase();
        const labelA = convertMarathiDigits(a.label || '').toLowerCase();
        const labelB = convertMarathiDigits(b.label || '').toLowerCase();
        const subA = convertMarathiDigits(a.subLabel || '').toLowerCase();
        const subB = convertMarathiDigits(b.subLabel || '').toLowerCase();

        // 1. Exact खाते क्र. (ID) match gets highest priority
        const exactA = valA === normalizedSearch;
        const exactB = valB === normalizedSearch;
        if (exactA && !exactB) return -1;
        if (!exactA && exactB) return 1;

        // 2. खाते क्र. (ID) starts with search
        const startValA = valA.startsWith(normalizedSearch);
        const startValB = valB.startsWith(normalizedSearch);
        if (startValA && !startValB) return -1;
        if (!startValA && startValB) return 1;

        // 3. SubLabel contains exact group code (उदा. [28.1] किंवा [28])
        const grpMatchA = subA.includes(`[${normalizedSearch}]`) || subA.includes(` ${normalizedSearch} `) || subA.startsWith(`गट: [${normalizedSearch}]`);
        const grpMatchB = subB.includes(`[${normalizedSearch}]`) || subB.includes(` ${normalizedSearch} `) || subB.startsWith(`गट: [${normalizedSearch}]`);
        if (grpMatchA && !grpMatchB) return -1;
        if (!grpMatchA && grpMatchB) return 1;

        // 4. Label starts with search term
        const startLabelA = labelA.startsWith(normalizedSearch);
        const startLabelB = labelB.startsWith(normalizedSearch);
        if (startLabelA && !startLabelB) return -1;
        if (!startLabelA && startLabelB) return 1;

        // 5. Default sort by numeric ID if both are numbers
        const numA = parseInt(valA, 10);
        const numB = parseInt(valB, 10);
        if (!isNaN(numA) && !isNaN(numB)) return numA - numB;

        return labelA.localeCompare(labelB);
      });
  }, [safeOptions, normalizedSearch, rawSearch]);

  useEffect(() => {
    if (!isOpen) return;
    const selectedIdx = filteredOptions.findIndex((o: any) => String(o.value) === String(value));
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
  }, [isOpen]);

  useEffect(() => {
    if (highlightedIndex >= filteredOptions.length) {
      setHighlightedIndex(0);
    }
  }, [filteredOptions.length, highlightedIndex]);

  useEffect(() => {
    if (!isOpen || !listContainerRef.current) return;
    const activeEl = listContainerRef.current.querySelector<HTMLElement>(`[data-option-idx="${highlightedIndex}"]`);
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [isOpen, highlightedIndex]);

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

      {isOpen && typeof document !== 'undefined' && ReactDOM.createPortal(
        <div 
          ref={menuPortalRef}
          style={{
            position: 'fixed',
            ...(menuPos.top !== undefined ? { top: `${menuPos.top}px` } : {}),
            ...(menuPos.bottom !== undefined ? { bottom: `${menuPos.bottom}px` } : {}),
            left: `${menuPos.left}px`,
            width: `${menuPos.width}px`,
            maxHeight: `${menuPos.maxHeight}px`,
            zIndex: 999999
          }}
          className="bg-white border border-slate-300 shadow-2xl rounded-lg overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100 ring-1 ring-black/5"
        >
          {/* Search Box Header */}
          <div className="sticky top-0 bg-slate-50 p-2 border-b border-slate-200 z-10 shrink-0">
            <div className="relative flex items-center">
              <input
                id={inputId}
                name={inputName}
                aria-label={placeholder || "शोधा..."}
                type="text"
                className="w-full border border-slate-300 pl-3 pr-7 py-1.5 text-xs rounded-lg focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 bg-white font-medium"
                placeholder={searchPlaceholder}
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setHighlightedIndex(0);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    if (filteredOptions.length > 0) {
                      setHighlightedIndex(prev => (prev + 1 < filteredOptions.length ? prev + 1 : 0));
                    }
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (filteredOptions.length > 0) {
                      setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : filteredOptions.length - 1));
                    }
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (filteredOptions.length > 0) {
                      const safeIdx = highlightedIndex >= 0 && highlightedIndex < filteredOptions.length ? highlightedIndex : 0;
                      triggerChange(filteredOptions[safeIdx].value);
                      setIsOpen(false);
                      setSearchTerm('');
                      setTimeout(() => triggerRef.current?.focus(), 0);
                    }
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsOpen(false);
                    setTimeout(() => triggerRef.current?.focus(), 0);
                  } else if (e.key === 'Tab') {
                    if (filteredOptions.length > 0 && (searchTerm.trim() !== '' || highlightedIndex > 0)) {
                      const safeIdx = highlightedIndex >= 0 && highlightedIndex < filteredOptions.length ? highlightedIndex : 0;
                      triggerChange(filteredOptions[safeIdx].value);
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
              {searchTerm && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSearchTerm('');
                    setHighlightedIndex(0);
                  }}
                  className="absolute right-2 text-slate-400 hover:text-slate-600 font-bold text-xs"
                >
                  ✕
                </button>
              )}
            </div>
            <div className="mt-1 flex items-center justify-between text-[10.5px] text-slate-500 px-1 font-semibold">
              <span>{countLabel}: <strong className="text-primary font-mono">{filteredOptions.length}</strong></span>
              <div className="flex items-center gap-2">
                {searchTerm && <span className="text-[10px] text-indigo-600">सर्च: "{searchTerm}"</span>}
                {onQuickAdd && !disabled && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      const typed = searchTerm.trim();
                      setIsOpen(false);
                      setSearchTerm('');
                      onQuickAdd(typed);
                    }}
                    className="text-[10px] text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 px-1.5 py-0.5 rounded font-bold cursor-pointer transition-colors"
                  >
                    {quickAddLabel}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Reset / Clear Option */}
          <div
            className="px-3 py-1.5 hover:bg-slate-100 cursor-pointer text-xs text-slate-500 border-b border-slate-100 font-medium shrink-0 flex items-center gap-1.5"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              triggerChange('');
              setIsOpen(false);
              setSearchTerm('');
              setTimeout(() => triggerRef.current?.focus(), 0);
            }}
          >
            <span className="text-slate-400">✕</span>
            <span>{placeholder}</span>
          </div>

          {/* Scrollable Results List */}
          <div ref={listContainerRef} className="overflow-y-auto flex-1 divide-y divide-slate-100">
            {filteredOptions.map((option: any, idx: number) => {
              const isSelected = String(value) === String(option.value);
              const isHighlighted = idx === highlightedIndex;
              return (
                <div
                  key={`${option.value}-${idx}`}
                  data-option-idx={idx}
                  title={option.label + (option.subLabel ? `\n${option.subLabel}` : '')}
                  className={`px-3 py-2 cursor-pointer text-xs transition duration-100 ${
                    isSelected
                      ? 'bg-indigo-100 text-indigo-950 font-semibold'
                      : isHighlighted
                        ? 'bg-indigo-50/90 text-slate-900 ring-1 ring-inset ring-indigo-200'
                        : 'text-slate-700 hover:bg-indigo-50/80'
                  }`}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onMouseDown={(e) => e.preventDefault()}
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
                        <span className="font-bold text-slate-900 truncate">
                          {option.label}
                        </span>
                        {option.badge && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-sm shrink-0 border ${option.badgeColor || 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                            {option.badge}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                        <span>{option.subLabel}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="whitespace-nowrap truncate font-medium">{option.label}</div>
                  )}
                </div>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="px-3 py-6 text-slate-400 text-xs text-center flex flex-col items-center gap-1.5">
                <span className="font-semibold text-slate-500">{emptyMessage}</span>
                {emptySubMessage && (
                  <span className="text-[10.5px] text-slate-400">{emptySubMessage}</span>
                )}
                {onQuickAdd && !disabled && (
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      const typed = searchTerm.trim();
                      setIsOpen(false);
                      setSearchTerm('');
                      onQuickAdd(typed);
                    }}
                    className="mt-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold shadow-xs cursor-pointer transition-colors"
                  >
                    {searchTerm.trim() ? `+ "${searchTerm.trim()}" जोडा` : quickAddLabel}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SearchableSelect;
