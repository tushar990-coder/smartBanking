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

      const nextPos = openUp
        ? {
            top: undefined,
            bottom: Math.max(8, viewportHeight - rect.top + 4),
            left,
            width: clampedWidth,
            maxHeight: availableHeight
          }
        : {
            top: rect.bottom + 4,
            bottom: undefined,
            left,
            width: clampedWidth,
            maxHeight: availableHeight
          };

      setMenuPos((prev) => {
        if (
          prev.top === nextPos.top &&
          prev.bottom === nextPos.bottom &&
          prev.left === nextPos.left &&
          prev.width === nextPos.width &&
          prev.maxHeight === nextPos.maxHeight
        ) {
          return prev;
        }
        return nextPos;
      });
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
  const rawLower = rawSearch.toLowerCase();

  // Pre-index normalized fields once per options reference change
  const indexedOptions = useMemo(() => {
    return safeOptions.map((o: any) => {
      const normVal = convertMarathiDigits(String(o.value || '')).toLowerCase();
      return {
        raw: o,
        normVal,
        normLabel: convertMarathiDigits(o.label || '').toLowerCase(),
        normSub: convertMarathiDigits(o.subLabel || '').toLowerCase(),
        normBadge: convertMarathiDigits(o.badge || '').toLowerCase(),
        rawLabelLower: (o.label || '').toLowerCase(),
        rawSubLower: (o.subLabel || '').toLowerCase(),
        numVal: parseInt(normVal, 10),
      };
    });
  }, [safeOptions]);

  // Smart relevance ranking: Exact ID > ID prefix > Group code > Name prefix > Substring
  const filteredOptions = useMemo(() => {
    if (!normalizedSearch) return safeOptions;

    return indexedOptions
      .filter((item) => {
        return (
          item.normVal === normalizedSearch ||
          item.normVal.startsWith(normalizedSearch) ||
          item.normVal.includes(normalizedSearch) ||
          item.normLabel.includes(normalizedSearch) ||
          item.normSub.includes(normalizedSearch) ||
          item.normBadge.includes(normalizedSearch) ||
          (rawLower && (
            item.rawLabelLower.includes(rawLower) ||
            item.rawSubLower.includes(rawLower)
          ))
        );
      })
      .sort((a, b) => {
        // 1. Exact खाते क्र. (ID) match gets highest priority
        const exactA = a.normVal === normalizedSearch;
        const exactB = b.normVal === normalizedSearch;
        if (exactA && !exactB) return -1;
        if (!exactA && exactB) return 1;

        // 2. खाते क्र. (ID) starts with search
        const startValA = a.normVal.startsWith(normalizedSearch);
        const startValB = b.normVal.startsWith(normalizedSearch);
        if (startValA && !startValB) return -1;
        if (!startValA && startValB) return 1;

        // 3. SubLabel contains exact group code (उदा. [28.1] किंवा [28])
        const grpMatchA = a.normSub.includes(`[${normalizedSearch}]`) || a.normSub.includes(` ${normalizedSearch} `) || a.normSub.startsWith(`गट: [${normalizedSearch}]`);
        const grpMatchB = b.normSub.includes(`[${normalizedSearch}]`) || b.normSub.includes(` ${normalizedSearch} `) || b.normSub.startsWith(`गट: [${normalizedSearch}]`);
        if (grpMatchA && !grpMatchB) return -1;
        if (!grpMatchA && grpMatchB) return 1;

        // 4. Label starts with search term
        const startLabelA = a.normLabel.startsWith(normalizedSearch);
        const startLabelB = b.normLabel.startsWith(normalizedSearch);
        if (startLabelA && !startLabelB) return -1;
        if (!startLabelA && startLabelB) return 1;

        // 5. Default sort by numeric ID if both are numbers
        if (!isNaN(a.numVal) && !isNaN(b.numVal)) return a.numVal - b.numVal;

        return a.normLabel.localeCompare(b.normLabel);
      })
      .map((item) => item.raw);
  }, [indexedOptions, safeOptions, normalizedSearch, rawLower]);

  const [maxVisibleOptions, setMaxVisibleOptions] = useState<number>(200);
  const visibleOptions = useMemo(() => {
    if (filteredOptions.length <= maxVisibleOptions) return filteredOptions;
    const sliced = filteredOptions.slice(0, maxVisibleOptions);
    if (selectedOption && !sliced.some((o: any) => String(o.value) === String(selectedOption.value))) {
      return [selectedOption, ...sliced.slice(0, maxVisibleOptions - 1)];
    }
    return sliced;
  }, [filteredOptions, selectedOption, maxVisibleOptions]);

  useEffect(() => {
    if (!isOpen) {
      setMaxVisibleOptions(200);
      return;
    }
    const selectedIdx = visibleOptions.findIndex((o: any) => String(o.value) === String(value));
    setHighlightedIndex(selectedIdx >= 0 ? selectedIdx : 0);
  }, [isOpen]);

  useEffect(() => {
    if (visibleOptions.length > 0 && highlightedIndex >= visibleOptions.length) {
      setHighlightedIndex(0);
    }
  }, [visibleOptions.length, highlightedIndex]);

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
                    if (visibleOptions.length > 0) {
                      setHighlightedIndex(prev => (prev + 1 < visibleOptions.length ? prev + 1 : 0));
                    }
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    if (visibleOptions.length > 0) {
                      setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : visibleOptions.length - 1));
                    }
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    if (visibleOptions.length > 0) {
                      const safeIdx = highlightedIndex >= 0 && highlightedIndex < visibleOptions.length ? highlightedIndex : 0;
                      triggerChange(visibleOptions[safeIdx].value);
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
                    if (visibleOptions.length > 0 && (searchTerm.trim() !== '' || highlightedIndex > 0)) {
                      const safeIdx = highlightedIndex >= 0 && highlightedIndex < visibleOptions.length ? highlightedIndex : 0;
                      triggerChange(visibleOptions[safeIdx].value);
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
            {visibleOptions.map((option: any, idx: number) => {
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

            {filteredOptions.length > visibleOptions.length && (
              <div
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                className="sticky bottom-0 bg-amber-50 border-t border-amber-200 px-2.5 py-1.5 text-[11px] text-amber-900 flex flex-wrap items-center justify-between gap-2 z-10"
              >
                <span className="font-semibold">
                  💡 एकूण <b>{filteredOptions.length}</b> पैकी पहिल्या <b>{visibleOptions.length}</b> नोंदी दिसत आहेत
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMaxVisibleOptions((prev) => prev + 200);
                    }}
                    className="px-2 py-0.5 bg-indigo-600 text-white rounded text-[10.5px] font-bold hover:bg-indigo-700 cursor-pointer"
                  >
                    ➕ पुढील २०० दाखवा
                  </button>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setMaxVisibleOptions(filteredOptions.length);
                    }}
                    className="px-2 py-0.5 bg-white text-slate-700 border border-slate-300 rounded text-[10.5px] font-bold hover:bg-slate-100 cursor-pointer"
                  >
                    सर्व ({filteredOptions.length}) दाखवा
                  </button>
                </div>
              </div>
            )}

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
