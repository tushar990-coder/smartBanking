import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { AlertTriangle } from 'lucide-react';
import SearchableSelect from '../SearchableSelect';
import {
  RawLedgerItem,
  filterBankAccountLedgers,
  buildBankLedgerOptions
} from '../../utils/bankLedgerUtils';

export interface BankLedgerSelectProps {
  value?: number | string | null;
  onChange: (ledgerId: number) => void;
  ledgers?: RawLedgerItem[];
  name?: string;
  id?: string;
  label?: string;
  hideLabel?: boolean;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  showEmptyWarning?: boolean;
  showCountBadge?: boolean;
  className?: string;
  tabIndex?: number;
}

const BankLedgerSelect: React.FC<BankLedgerSelectProps> = ({
  value,
  onChange,
  ledgers,
  name = 'bankLedgerID',
  id,
  label = '🏦 बँक जी.एल. खाते निवडा (Select Bank GL Account) *',
  hideLabel = false,
  disabled = false,
  required = true,
  placeholder = '-- खाते क्र. (Ledger No.) किंवा बँक जी.एल. नाव शोधा --',
  showEmptyWarning = true,
  showCountBadge = false,
  className,
  tabIndex
}) => {
  const [internalLedgers, setInternalLedgers] = useState<RawLedgerItem[]>([]);
  const [loaded, setLoaded] = useState<boolean>(Array.isArray(ledgers));

  useEffect(() => {
    if (Array.isArray(ledgers)) {
      setLoaded(true);
      return;
    }

    let isMounted = true;
    axios
      .get('/api/Ledgers')
      .then((res) => {
        if (!isMounted) return;
        setInternalLedgers(Array.isArray(res.data) ? res.data : []);
      })
      .catch((err) => {
        console.error('Failed to fetch ledgers for BankLedgerSelect:', err);
      })
      .finally(() => {
        if (isMounted) setLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, [ledgers]);

  const rawLedgers = Array.isArray(ledgers) ? ledgers : internalLedgers;

  const bankLedgers = useMemo(() => {
    return filterBankAccountLedgers(rawLedgers);
  }, [rawLedgers]);

  const options = useMemo(() => {
    return buildBankLedgerOptions(bankLedgers, value, disabled ? rawLedgers : undefined);
  }, [bankLedgers, value, disabled, rawLedgers]);

  const numericValue = Number(value || 0);

  return (
    <div className="w-full space-y-1">
      {(!hideLabel || showCountBadge) && (
        <div className="flex items-center justify-between gap-2 mb-0.5">
          {!hideLabel && label && (
            <label htmlFor={id} className="block text-[11px] font-bold text-blue-950">
              {label}
            </label>
          )}
          {showCountBadge && (
            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-blue-300 shrink-0">
              {bankLedgers.length} बँक जी.एल. खाती
            </span>
          )}
        </div>
      )}

      {showEmptyWarning && loaded && !disabled && bankLedgers.length === 0 && (
        <div className="p-2 bg-amber-50 border border-amber-300 rounded-sm text-[11px] text-amber-900 font-semibold flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>
            कोणत्याही खात्याला <b>Bank Account (बँक खाते)</b> प्रकार दिलेला नाही. कृपया <b>सेटिंग्ज &rarr; खाते माहिती (Ledger Master)</b> मध्ये बँक खात्याचा <b>खाते प्रकार = Bank Account</b> निवडा.
          </span>
        </div>
      )}

      <SearchableSelect
        id={id}
        name={name}
        options={options}
        value={numericValue > 0 ? numericValue : ''}
        onChange={(e) => {
          const parsed = Number(e?.target?.value || 0);
          onChange(isNaN(parsed) ? 0 : parsed);
        }}
        disabled={disabled}
        required={required}
        tabIndex={tabIndex}
        placeholder={placeholder}
        className={
          className ||
          `w-full text-[11px] border border-blue-400 rounded-sm px-2.5 py-1 flex justify-between items-center h-[30px] shadow-2xs ${
            disabled
              ? 'bg-slate-100 text-slate-500 cursor-not-allowed opacity-75'
              : 'bg-white text-blue-950 font-bold cursor-pointer hover:border-blue-500'
          }`
        }
      />
    </div>
  );
};

export default BankLedgerSelect;

