import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import {
  CheckCircle2,
  AlertCircle,
  ArrowRightLeft,
  Search,
  CheckSquare,
  Square,
  Wallet,
  Coins,
  History,
  X
} from 'lucide-react';
import {
  isBankAccountLedger,
  isCashLedgerOption,
  getLedgerId,
  getLedgerName,
  getLedgerCode
} from '../utils/bankLedgerUtils';

type MisDisbursementMode = 'SavingTransfer' | 'LoanRecovery' | 'Suspense' | 'Bank' | 'Cash';

interface PayoutLedgerOption {
  ledgerID: number;
  ledgerName: string;
  ledgerCode?: string;
  category: 'SavingTransfer' | 'Cash' | 'Bank' | 'Suspense';
  isDefault?: boolean;
}

interface CustomerSavingAccountOption {
  savingAccountID: number;
  accountNo: string;
  oldAccountNo?: string;
  cifNo?: string;
  currentBalance: number;
  branchID: number;
  branchName: string;
  ledgerID?: number;
  ledgerName?: string;
}

interface PreviewItem {
  fdAccountID: number;
  fdSchemeID?: number;
  accountNo: string;
  oldAccountNo?: string;
  legacyAccountNumber?: string;
  customerID: number;
  customerName: string;
  cifNo: string;
  memberID?: number;
  memberNo: string;
  schemeName: string;
  schemeCalculationMethod?: string;
  openingDate: string;
  maturityDate: string;
  depositPrincipal: number;
  interestRate: number;
  elapsedDays: number;
  autoElapsedDays?: number;
  periodFromDate: string;
  periodToDate: string;
  isBrokenPeriod: boolean;
  grossInterest: number;
  autoGrossInterest?: number;
  tdsAmount: number;
  loanAdjustedAmount: number;
  netDisbursedAmount: number;
  disbursementMode: MisDisbursementMode;
  originalDisbursementMode?: MisDisbursementMode;
  targetSavingAccountID?: number;
  targetSavingAccountNo?: string;
  targetSavingOldAccountNo?: string;
  targetSavingCifNo?: string;
  targetSavingAccountBalance?: number;
  targetCreditLedgerID?: number;
  targetCreditLedgerName?: string;
  customerSavingAccounts?: CustomerSavingAccountOption[];
  targetLoanAccountID?: number;
  targetLoanAccountNo?: string;
  targetLoanBalance?: number;
  isAlreadyPaid: boolean;
  isLienMarked: boolean;
  warningNote?: string;
  isSelected: boolean;
}

interface RegisterRow {
  payoutID: number;
  branchID: number;
  payoutYear: number;
  payoutMonth: number;
  payoutDate: string;
  elapsedDays: number;
  depositPrincipal: number;
  interestRate: number;
  grossInterest: number;
  tdsAmount: number;
  loanAdjustedAmount: number;
  netDisbursedAmount: number;
  disbursementMode: string;
  status: string;
  remarks?: string;
  voucherNo?: string;
  accountNo: string;
  oldAccountNo?: string;
  legacyAccountNumber?: string;
  customerName: string;
  targetSavingAccountNo?: string;
  targetSavingOldAccountNo?: string;
  targetLoanAccountNo?: string;
}

const MARATHI_MONTHS = [
  { value: 1, label: 'जानेवारी (Jan)', short: 'जानेवारी' },
  { value: 2, label: 'फेब्रुवारी (Feb)', short: 'फेब्रुवारी' },
  { value: 3, label: 'मार्च (Mar)', short: 'मार्च' },
  { value: 4, label: 'एप्रिल (Apr)', short: 'एप्रिल' },
  { value: 5, label: 'मे (May)', short: 'मे' },
  { value: 6, label: 'जून (Jun)', short: 'जून' },
  { value: 7, label: 'जुलै (Jul)', short: 'जुलै' },
  { value: 8, label: 'ऑगस्ट (Aug)', short: 'ऑगस्ट' },
  { value: 9, label: 'सप्टेंबर (Sep)', short: 'सप्टेंबर' },
  { value: 10, label: 'ऑक्टोबर (Oct)', short: 'ऑक्टोबर' },
  { value: 11, label: 'नोव्हेंबर (Nov)', short: 'नोव्हेंबर' },
  { value: 12, label: 'डिसेंबर (Dec)', short: 'डिसेंबर' },
];

const getExactMonthDays = (year: number, month: number): number => {
  if (!year || !month || month < 1 || month > 12) return 30;
  return new Date(year, month, 0).getDate();
};

const resolveSchemeCalcMethod = (scheme: any): 'Monthly' | 'Daily' => {
  if (!scheme) return 'Monthly';
  const raw = String(scheme.interestCalculationMethod ?? scheme.InterestCalculationMethod ?? '').trim().toLowerCase();
  if (raw === 'daily') return 'Daily';
  if (raw === 'monthly') return 'Monthly';
  const durType = String(scheme.durationType ?? scheme.DurationType ?? '').trim();
  const durModel = String(scheme.schemeDurationModel ?? scheme.SchemeDurationModel ?? '').trim();
  if (durType === 'Days' || durModel === 'Slab') return 'Daily';
  return 'Monthly';
};

const isMisLikeScheme = (s: any): boolean => {
  if (!s) return false;
  const intType = String(s.interestType ?? '').trim().toLowerCase();
  const freq = String(s.interestPayoutFrequency ?? '').trim().toLowerCase();
  const name = String(s.schemeName ?? '');
  return (
    intType === 'mis' ||
    intType === 'monthly interest' ||
    freq.includes('monthly') ||
    name.includes('मासिक') ||
    name.toUpperCase().includes('MIS')
  );
};

const resolveDefaultCalcMethodForSchemeSelection = (
  schemeList: any[],
  schemeId: number | '',
  currentBranchId: number
): 'Monthly' | 'Daily' => {
  if (!Array.isArray(schemeList) || schemeList.length === 0) return 'Monthly';

  if (schemeId !== '') {
    const matched = schemeList.find((s) => Number(s.fdSchemeID || s.schemeID) === Number(schemeId));
    if (matched) return resolveSchemeCalcMethod(matched);
  }

  const branchApplicable = schemeList.filter(
    (s) => s.isActive !== false && (!s.branchID || Number(s.branchID) === Number(currentBranchId))
  );
  const pool = branchApplicable.length > 0 ? branchApplicable : schemeList;

  const misSchemes = pool.filter(isMisLikeScheme);
  if (misSchemes.length > 0) {
    // If any active MIS scheme is configured as Daily, prefer Daily if majority/first is Daily
    const firstMis = misSchemes[0];
    if (misSchemes.some((s) => resolveSchemeCalcMethod(s) === 'Daily') && resolveSchemeCalcMethod(firstMis) === 'Daily') {
      return 'Daily';
    }
    const explicitDailyMis = misSchemes.find(
      (s) => String(s.interestCalculationMethod ?? '').trim().toLowerCase() === 'daily'
    );
    if (explicitDailyMis) return 'Daily';
    return resolveSchemeCalcMethod(firstMis);
  }

  return resolveSchemeCalcMethod(pool[0]);
};

const computeRowDaysAndInterest = (
  rawItem: {
    depositPrincipal: number;
    interestRate: number;
    isBrokenPeriod?: boolean;
    elapsedDays?: number;
    autoElapsedDays?: number;
    tdsAmount?: number;
    disbursementMode?: MisDisbursementMode;
  },
  method: 'Monthly' | 'Daily',
  year: number,
  month: number
) => {
  const principal = Number(rawItem.depositPrincipal) || 0;
  const rate = Number(rawItem.interestRate) || 0;
  const tds = Number(rawItem.tdsAmount) || 0;
  const fullMonthDays = getExactMonthDays(year, month);

  let exactDays = fullMonthDays;
  if (rawItem.isBrokenPeriod) {
    const brokenDays = Number(rawItem.autoElapsedDays ?? rawItem.elapsedDays) || 0;
    exactDays = brokenDays > 0 ? brokenDays : fullMonthDays;
  }

  let gross = 0;
  if (method === 'Daily') {
    gross = Math.round((principal * rate * exactDays) / 36500);
  } else {
    gross = rawItem.isBrokenPeriod
      ? Math.round((principal * rate * exactDays) / 36500)
      : Math.round((principal * rate) / 1200);
  }

  const netAmt = Math.max(0, gross - tds);
  const isLoanMode = rawItem.disbursementMode === 'LoanRecovery';

  return {
    elapsedDays: exactDays,
    autoElapsedDays: exactDays,
    grossInterest: gross,
    autoGrossInterest: gross,
    loanAdjustedAmount: isLoanMode ? netAmt : 0,
    netDisbursedAmount: isLoanMode ? 0 : netAmt
  };
};

export const FdMisInterestPayout: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'payout' | 'register'>('payout');

  // Branch & Filter states
  const [branches, setBranches] = useState<any[]>([]);
  const [schemes, setSchemes] = useState<any[]>([]);
  const [selectedSchemeId, setSelectedSchemeId] = useState<number | ''>('');

  const isHeadOfficeOrAdmin = Boolean(
    user?.role === 'Admin' ||
    (user as any)?.roleName === 'Admin' ||
    (user as any)?.isHeadOffice ||
    user?.branchID === 0 ||
    !user?.branchID
  );

  const globalBranchStr = localStorage.getItem('globalBranchId');
  const hasGlobalBranch = Boolean(globalBranchStr && globalBranchStr !== 'all');
  const initialBranchId = user?.branchID ? user.branchID : (hasGlobalBranch ? parseInt(globalBranchStr as string, 10) : 1);
  const [branchID, setBranchID] = useState<number>(initialBranchId);

  const getBizDateStr = (b?: string) => {
    if (b && b.trim()) return b.split('T')[0];
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
  };
  const initialBizStr = getBizDateStr(user?.businessDate);
  const initialBizParts = initialBizStr.split('-').map(Number);
  const [payoutYear, setPayoutYear] = useState<number>(initialBizParts[0] || new Date().getFullYear());
  const [payoutMonth, setPayoutMonth] = useState<number>(initialBizParts[1] || (new Date().getMonth() + 1));
  const [payoutDate, setPayoutDate] = useState<string>(initialBizStr);

  const currentYear = new Date().getFullYear();
  const availableYears = Array.from({ length: 6 }, (_, idx) => currentYear - 3 + idx);

  // Calculation Method: Auto-selected from Scheme on open & scheme change, switchable in 1 click
  const [calcMethod, setCalcMethod] = useState<'Monthly' | 'Daily'>('Monthly');
  const [isSchemeSyncedMethod, setIsSchemeSyncedMethod] = useState<boolean>(true);
  const [accountingMode] = useState<'DirectExpense' | 'ClearPayable'>('DirectExpense');

  // Dynamic Payout Ledgers (Saving / Cash / Bank / Suspense)
  const [payoutLedgers, setPayoutLedgers] = useState<PayoutLedgerOption[]>([]);
  const [batchLedgerKey, setBatchLedgerKey] = useState<string>('');

  // Preview & Processing states
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingExecute, setLoadingExecute] = useState(false);
  const [previewItems, setPreviewItems] = useState<PreviewItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Confirmation Modal
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Quick Saving Account Search Modal
  const [searchModalItem, setSearchModalItem] = useState<PreviewItem | null>(null);
  const [sbSearchTerm, setSbSearchTerm] = useState('');
  const [sbSearchResults, setSbSearchResults] = useState<any[]>([]);
  const [sbSearchLoading, setSbSearchLoading] = useState(false);

  // Register states
  const [loadingRegister, setLoadingRegister] = useState(false);
  const [registerRows, setRegisterRows] = useState<RegisterRow[]>([]);
  const [registerSearch, setRegisterSearch] = useState('');

  const API_URL = '/api';

  // Categorized Ledger Lists
  const savingLedgers = useMemo(
    () => payoutLedgers.filter((l) => l.category === 'SavingTransfer'),
    [payoutLedgers]
  );
  const cashLedgers = useMemo(
    () => payoutLedgers.filter((l) => l.category === 'Cash'),
    [payoutLedgers]
  );
  const bankLedgers = useMemo(
    () => payoutLedgers.filter((l) => l.category === 'Bank'),
    [payoutLedgers]
  );
  const suspenseLedgers = useMemo(
    () => payoutLedgers.filter((l) => l.category === 'Suspense'),
    [payoutLedgers]
  );

  const selectedMonthMeta = MARATHI_MONTHS.find((m) => m.value === payoutMonth);
  const selectedMonthDays = getExactMonthDays(payoutYear, payoutMonth);

  useEffect(() => {
    fetchBranches();
    fetchSchemes();
  }, []);

  useEffect(() => {
    fetchPayoutLedgers(branchID);
  }, [branchID]);

  const fetchBranches = async () => {
    try {
      const res = await axios.get(`${API_URL}/Branches`);
      setBranches(res.data || []);
    } catch (err) {
      console.error('Branches fetch error', err);
    }
  };

  const fetchSchemes = async () => {
    try {
      const res = await axios.get(`${API_URL}/FdSchemes`, { params: { branchId: branchID } });
      const list = Array.isArray(res.data) ? res.data : [];
      setSchemes(list);

      // Requirement #1: Auto-select व्याज गणना पद्धत from scheme as soon as form opens!
      const autoMethod = resolveDefaultCalcMethodForSchemeSelection(list, selectedSchemeId, branchID);
      setCalcMethod(autoMethod);
      setIsSchemeSyncedMethod(true);
    } catch (err) {
      console.error('Schemes fetch error', err);
    }
  };

  // Fetch Categorized Payout Ledgers (with automatic fallback to /api/Ledgers if backend not yet restarted)
  const fetchPayoutLedgers = async (targetBranchId: number) => {
    try {
      const res = await axios.get(`${API_URL}/FdMisPayout/PayoutLedgers`, {
        params: { branchId: targetBranchId }
      });
      if (Array.isArray(res.data) && res.data.length > 0) {
        const normalized: PayoutLedgerOption[] = res.data.map((l: any) => ({
          ledgerID: Number(l.ledgerID ?? l.LedgerID),
          ledgerName: String(l.ledgerName ?? l.LedgerName ?? ''),
          ledgerCode: String(l.ledgerCode ?? l.LedgerCode ?? ''),
          category: l.category ?? l.Category ?? 'SavingTransfer',
          isDefault: Boolean(l.isDefault ?? l.IsDefault)
        }));
        setPayoutLedgers(normalized);
        return normalized;
      }
    } catch {
      // Fallback categorization from /api/Ledgers + /api/SavingInterestSettings
    }

    try {
      const [ledRes, savSetRes] = await Promise.all([
        axios.get(`${API_URL}/Ledgers`),
        axios.get(`${API_URL}/SavingInterestSettings`).catch(() => ({ data: [] }))
      ]);
      const rawLedgers: any[] = Array.isArray(ledRes.data) ? ledRes.data : [];
      const rawSavSettings: any[] = Array.isArray(savSetRes.data) ? savSetRes.data : [];

      const schemeSavingIds = new Set<number>();
      rawSavSettings.forEach((s: any) => {
        const lid = Number(s.savingLiabilityLedgerID ?? s.ledgerID ?? 0);
        if (lid > 0) schemeSavingIds.add(lid);
      });

      const fallbackList: PayoutLedgerOption[] = [];
      const seen = new Set<number>();

      const pushOpt = (l: any, category: PayoutLedgerOption['category'], isDefault = false) => {
        const id = getLedgerId(l);
        if (id <= 0 || seen.has(id)) return;
        if ((l.isActive ?? l.IsActive ?? true) === false) return;
        seen.add(id);
        fallbackList.push({
          ledgerID: id,
          ledgerName: getLedgerName(l),
          ledgerCode: getLedgerCode(l),
          category,
          isDefault
        });
      };

      // 1. Saving Liability Ledgers
      rawLedgers.forEach((l) => {
        const id = getLedgerId(l);
        if (schemeSavingIds.has(id) && !isBankAccountLedger(l) && !isCashLedgerOption(l)) {
          pushOpt(l, 'SavingTransfer', !fallbackList.some((x) => x.category === 'SavingTransfer'));
        }
      });

      rawLedgers.forEach((l) => {
        if (isBankAccountLedger(l) || isCashLedgerOption(l)) return;
        const name = getLedgerName(l);
        const grp = l.accountGroup || l.AccountGroup || {};
        const grpName = `${grp.groupName || grp.GroupName || ''} ${grp.groupNameEnglish || grp.GroupNameEnglish || ''}`.toLowerCase();
        const nature = String(grp.natureOfGroup || grp.NatureOfGroup || '').toLowerCase();
        const isLiability = !nature || nature.includes('liabilit');
        const looksSaving =
          String(l.accountType || l.AccountType || '').toLowerCase() === 'savings' ||
          grpName.includes('बचत') ||
          grpName.includes('saving') ||
          (name.includes('बचत') && !name.includes('व्याज') && !name.includes('देणे'));
        if (isLiability && looksSaving) {
          pushOpt(l, 'SavingTransfer', !fallbackList.some((x) => x.category === 'SavingTransfer'));
        }
      });

      // 2. Cash Ledgers
      rawLedgers.forEach((l) => {
        if (isCashLedgerOption(l) && !isBankAccountLedger(l)) {
          pushOpt(l, 'Cash', !fallbackList.some((x) => x.category === 'Cash'));
        }
      });

      // 3. Bank Account GL Ledgers
      rawLedgers.forEach((l) => {
        if (isBankAccountLedger(l)) {
          pushOpt(l, 'Bank', !fallbackList.some((x) => x.category === 'Bank'));
        }
      });

      // 4. Suspense Ledgers
      rawLedgers.forEach((l) => {
        if (isBankAccountLedger(l) || isCashLedgerOption(l)) return;
        const name = getLedgerName(l);
        if (name.includes('उचंत') || name.includes('न मागितलेले') || name.toLowerCase().includes('suspense')) {
          pushOpt(l, 'Suspense', !fallbackList.some((x) => x.category === 'Suspense'));
        }
      });

      setPayoutLedgers(fallbackList);
      return fallbackList;
    } catch (err) {
      console.error('Fallback ledgers fetch error', err);
      return [];
    }
  };

  // Enrich customer saving accounts with OldAccountNo, CIFNo, and LedgerID if missing (e.g. un-restarted backend)
  const enrichSavingAccountsMetadataIfNeeded = async (items: PreviewItem[], currentBranchId: number) => {
    const needsEnrichment = items.some((item) =>
      (item.customerSavingAccounts && item.customerSavingAccounts.some((sb) => sb.oldAccountNo === undefined)) ||
      (item.targetSavingAccountID && item.targetSavingOldAccountNo === undefined)
    );
    if (!needsEnrichment || items.length === 0) return;

    try {
      const res = await axios.get(`${API_URL}/SavingAccounts`, {
        params: { branchId: currentBranchId }
      });
      const allBranchSbs: any[] = Array.isArray(res.data) ? res.data : [];
      if (allBranchSbs.length === 0) return;

      const byId = new Map<number, any>();
      const byCustomerId = new Map<number, any[]>();
      const byCif = new Map<string, any[]>();

      allBranchSbs.forEach((s) => {
        const status = String(s.status ?? s.Status ?? '');
        if (status === 'Closed' || status === 'बंद') return;
        const sid = Number(s.savingAccountID ?? s.SavingAccountID);
        if (sid > 0) byId.set(sid, s);

        const cid = Number(s.customerID ?? s.CustomerID ?? 0);
        if (cid > 0) {
          const arr = byCustomerId.get(cid) || [];
          arr.push(s);
          byCustomerId.set(cid, arr);
        }

        const cif = String(s.cifNo ?? s.CIFNo ?? '').trim();
        if (cif) {
          const arr = byCif.get(cif) || [];
          arr.push(s);
          byCif.set(cif, arr);
        }
      });

      setPreviewItems((prev) =>
        prev.map((item) => {
          const existingOptions = item.customerSavingAccounts ? [...item.customerSavingAccounts] : [];
          const candidatePool = [
            ...(byCustomerId.get(item.customerID) || []),
            ...(item.cifNo ? (byCif.get(item.cifNo) || []) : [])
          ];

          candidatePool.forEach((rawSb) => {
            const sid = Number(rawSb.savingAccountID ?? rawSb.SavingAccountID);
            if (sid > 0 && !existingOptions.some((o) => o.savingAccountID === sid)) {
              existingOptions.push({
                savingAccountID: sid,
                accountNo: String(rawSb.accountNo ?? rawSb.AccountNo ?? ''),
                oldAccountNo: String(rawSb.oldAccountNo ?? rawSb.OldAccountNo ?? rawSb.legacyAccountNumber ?? rawSb.LegacyAccountNumber ?? ''),
                cifNo: String(rawSb.cifNo ?? rawSb.CIFNo ?? item.cifNo ?? ''),
                currentBalance: Number(rawSb.currentBalance ?? rawSb.CurrentBalance ?? 0),
                branchID: Number(rawSb.branchID ?? rawSb.BranchID ?? currentBranchId),
                branchName: String(rawSb.branchName ?? rawSb.BranchName ?? ''),
                ledgerID: Number(rawSb.ledgerID ?? rawSb.LedgerID ?? 0),
                ledgerName: String(rawSb.ledgerName ?? rawSb.LedgerName ?? '')
              });
            }
          });

          const enrichedOptions = existingOptions.map((opt) => {
            const raw = byId.get(opt.savingAccountID);
            if (!raw) return opt;
            return {
              ...opt,
              oldAccountNo: opt.oldAccountNo || String(raw.oldAccountNo ?? raw.OldAccountNo ?? raw.legacyAccountNumber ?? raw.LegacyAccountNumber ?? ''),
              cifNo: opt.cifNo || String(raw.cifNo ?? raw.CIFNo ?? item.cifNo ?? ''),
              ledgerID: opt.ledgerID || Number(raw.ledgerID ?? raw.LedgerID ?? 0),
              ledgerName: opt.ledgerName || String(raw.ledgerName ?? raw.LedgerName ?? '')
            };
          });

          const matchedSb =
            (item.targetSavingAccountID ? enrichedOptions.find((x) => x.savingAccountID === item.targetSavingAccountID) : undefined) ||
            enrichedOptions[0];

          return {
            ...item,
            customerSavingAccounts: enrichedOptions,
            targetSavingAccountID: item.targetSavingAccountID || matchedSb?.savingAccountID,
            targetSavingAccountNo: item.targetSavingAccountNo || matchedSb?.accountNo,
            targetSavingOldAccountNo: item.targetSavingOldAccountNo || matchedSb?.oldAccountNo || '',
            targetSavingCifNo: item.targetSavingCifNo || matchedSb?.cifNo || item.cifNo || '',
            targetSavingAccountBalance: item.targetSavingAccountBalance ?? matchedSb?.currentBalance,
            targetCreditLedgerID:
              item.disbursementMode === 'SavingTransfer'
                ? (item.targetCreditLedgerID || matchedSb?.ledgerID || savingLedgers[0]?.ledgerID)
                : item.targetCreditLedgerID
          };
        })
      );
    } catch (err) {
      console.error('Enrich saving metadata error', err);
    }
  };

  // Handle Scheme Dropdown Change -> Auto-select Scheme's Calculation Method
  const handleSchemeFilterChange = (rawVal: string) => {
    const nextSchemeId: number | '' = rawVal ? parseInt(rawVal, 10) : '';
    setSelectedSchemeId(nextSchemeId);
    const autoMethod = resolveDefaultCalcMethodForSchemeSelection(schemes, nextSchemeId, branchID);
    setCalcMethod(autoMethod);
    setIsSchemeSyncedMethod(true);
    setPreviewItems([]);
  };

  // 1. Fetch Preview
  const handleFetchPreview = async () => {
    setError('');
    setSuccess('');
    setLoadingPreview(true);
    setPreviewItems([]);
    setBatchLedgerKey('');

    try {
      let currentLedgers = payoutLedgers;
      if (currentLedgers.length === 0) {
        currentLedgers = await fetchPayoutLedgers(branchID);
      }

      const payload = {
        branchID,
        fdSchemeID: selectedSchemeId ? Number(selectedSchemeId) : null,
        payoutYear,
        payoutMonth,
        payoutDate,
        accountingMode,
        calculationMethod: calcMethod
      };

      const res = await axios.post(`${API_URL}/FdMisPayout/Preview`, payload);
      const data = res.data;

      // Sync PayoutLedgers if returned by backend
      const apiLedgers = data.PayoutLedgers || data.payoutLedgers;
      if (Array.isArray(apiLedgers) && apiLedgers.length > 0) {
        const normalized: PayoutLedgerOption[] = apiLedgers.map((l: any) => ({
          ledgerID: Number(l.ledgerID ?? l.LedgerID),
          ledgerName: String(l.ledgerName ?? l.LedgerName ?? ''),
          ledgerCode: String(l.ledgerCode ?? l.LedgerCode ?? ''),
          category: l.category ?? l.Category ?? 'SavingTransfer',
          isDefault: Boolean(l.isDefault ?? l.IsDefault)
        }));
        setPayoutLedgers(normalized);
        currentLedgers = normalized;
      }

      const rawItems: any[] = data.Items || data.items || [];

      // If form is in scheme-synced mode and All Schemes was chosen, align with returned accounts' scheme method
      let effectiveMethod: 'Monthly' | 'Daily' = calcMethod;
      if (isSchemeSyncedMethod && selectedSchemeId === '' && rawItems.length > 0) {
        const firstSchemeMethod = rawItems[0].schemeCalculationMethod ?? rawItems[0].SchemeCalculationMethod;
        if (firstSchemeMethod && String(firstSchemeMethod).toLowerCase() === 'daily') {
          effectiveMethod = 'Daily';
          setCalcMethod('Daily');
        } else if (firstSchemeMethod && String(firstSchemeMethod).toLowerCase() === 'monthly') {
          effectiveMethod = 'Monthly';
          setCalcMethod('Monthly');
        }
      }

      const defaultSavLedger = currentLedgers.find((l) => l.category === 'SavingTransfer' && l.isDefault)
        || currentLedgers.find((l) => l.category === 'SavingTransfer');
      const defaultCashLedger = currentLedgers.find((l) => l.category === 'Cash' && l.isDefault)
        || currentLedgers.find((l) => l.category === 'Cash');
      const defaultBankLedger = currentLedgers.find((l) => l.category === 'Bank' && l.isDefault)
        || currentLedgers.find((l) => l.category === 'Bank');
      const defaultSuspLedger = currentLedgers.find((l) => l.category === 'Suspense' && l.isDefault)
        || currentLedgers.find((l) => l.category === 'Suspense');

      // Requirement #2: Always compute exact calendar days & selected calcMethod immediately on every row!
      const items: PreviewItem[] = rawItems.map((i: any) => {
        const origMode: MisDisbursementMode = i.disbursementMode || 'SavingTransfer';
        const fdOldAcc = String(i.oldAccountNo ?? i.OldAccountNo ?? i.legacyAccountNumber ?? i.LegacyAccountNumber ?? '').trim();
        const sbList: CustomerSavingAccountOption[] = Array.isArray(i.customerSavingAccounts)
          ? i.customerSavingAccounts.map((s: any) => ({
              savingAccountID: Number(s.savingAccountID ?? s.SavingAccountID),
              accountNo: String(s.accountNo ?? s.AccountNo ?? ''),
              oldAccountNo: s.oldAccountNo !== undefined || s.OldAccountNo !== undefined
                ? String(s.oldAccountNo ?? s.OldAccountNo ?? '')
                : undefined,
              cifNo: String(s.cifNo ?? s.CifNo ?? i.cifNo ?? ''),
              currentBalance: Number(s.currentBalance ?? s.CurrentBalance ?? 0),
              branchID: Number(s.branchID ?? s.BranchID ?? branchID),
              branchName: String(s.branchName ?? s.BranchName ?? ''),
              ledgerID: Number(s.ledgerID ?? s.LedgerID ?? 0) || undefined,
              ledgerName: String(s.ledgerName ?? s.LedgerName ?? '') || undefined
            }))
          : [];

        const matchedSb =
          (i.targetSavingAccountID ? sbList.find((s) => s.savingAccountID === Number(i.targetSavingAccountID)) : undefined) ||
          sbList[0];

        let creditLedgerId = Number(i.targetCreditLedgerID ?? 0) || undefined;
        let creditLedgerName = i.targetCreditLedgerName ? String(i.targetCreditLedgerName) : undefined;

        if (!creditLedgerId) {
          if (origMode === 'SavingTransfer') {
            creditLedgerId = matchedSb?.ledgerID || defaultSavLedger?.ledgerID;
            creditLedgerName = matchedSb?.ledgerName || defaultSavLedger?.ledgerName;
          } else if (origMode === 'Cash') {
            creditLedgerId = defaultCashLedger?.ledgerID;
            creditLedgerName = defaultCashLedger?.ledgerName;
          } else if (origMode === 'Bank') {
            creditLedgerId = defaultBankLedger?.ledgerID;
            creditLedgerName = defaultBankLedger?.ledgerName;
          } else if (origMode === 'Suspense') {
            creditLedgerId = defaultSuspLedger?.ledgerID;
            creditLedgerName = defaultSuspLedger?.ledgerName;
          }
        } else if (!creditLedgerName) {
          creditLedgerName = currentLedgers.find((l) => l.ledgerID === creditLedgerId)?.ledgerName;
        }

        const calcResult = i.isAlreadyPaid
          ? {
              elapsedDays: Number(i.elapsedDays) || selectedMonthDays,
              autoElapsedDays: Number(i.autoElapsedDays ?? i.elapsedDays) || selectedMonthDays,
              grossInterest: Number(i.grossInterest) || 0,
              autoGrossInterest: Number(i.autoGrossInterest ?? i.grossInterest) || 0,
              loanAdjustedAmount: Number(i.loanAdjustedAmount) || 0,
              netDisbursedAmount: Number(i.netDisbursedAmount) || 0
            }
          : computeRowDaysAndInterest(
              {
                depositPrincipal: Number(i.depositPrincipal) || 0,
                interestRate: Number(i.interestRate) || 0,
                isBrokenPeriod: Boolean(i.isBrokenPeriod),
                elapsedDays: Number(i.elapsedDays) || 0,
                autoElapsedDays: Number(i.autoElapsedDays ?? i.elapsedDays) || 0,
                tdsAmount: Number(i.tdsAmount) || 0,
                disbursementMode: origMode
              },
              effectiveMethod,
              payoutYear,
              payoutMonth
            );

        return {
          ...i,
          ...calcResult,
          oldAccountNo: fdOldAcc || undefined,
          legacyAccountNumber: fdOldAcc || undefined,
          tdsAmount: Number(i.tdsAmount) || 0,
          customerSavingAccounts: sbList,
          targetSavingAccountID: i.targetSavingAccountID ?? matchedSb?.savingAccountID,
          targetSavingAccountNo: i.targetSavingAccountNo ?? matchedSb?.accountNo,
          targetSavingOldAccountNo: i.targetSavingOldAccountNo !== undefined
            ? String(i.targetSavingOldAccountNo || matchedSb?.oldAccountNo || '')
            : matchedSb?.oldAccountNo,
          targetSavingCifNo: String(i.targetSavingCifNo || matchedSb?.cifNo || i.cifNo || ''),
          targetSavingAccountBalance: i.targetSavingAccountBalance ?? matchedSb?.currentBalance,
          targetCreditLedgerID: creditLedgerId,
          targetCreditLedgerName: creditLedgerName,
          originalDisbursementMode: origMode,
          disbursementMode: origMode,
          isSelected: !i.isAlreadyPaid && calcResult.grossInterest > 0
        };
      });

      setPreviewItems(items);
      if (items.length === 0) {
        setError('निवडलेल्या महिना व शाखेसाठी कोणतेही सक्रिय मुदत ठेव खाते सापडले नाही.');
      } else {
        enrichSavingAccountsMetadataIfNeeded(items, branchID);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || err.message || 'प्रिव्ह्यू आणताना त्रुटी आली.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setLoadingPreview(false);
    }
  };

  // Requirement #2: 1-Click Instant Recalculation across ALL rows without clicking '↺'
  const handleCalcMethodChange = (newMethod: 'Monthly' | 'Daily') => {
    setCalcMethod(newMethod);
    setIsSchemeSyncedMethod(false);
    setPreviewItems((prev) =>
      prev.map((i) => {
        if (i.isAlreadyPaid) return i;
        const calcResult = computeRowDaysAndInterest(i, newMethod, payoutYear, payoutMonth);
        return {
          ...i,
          ...calcResult,
          isSelected: calcResult.grossInterest > 0 ? i.isSelected : false
        };
      })
    );
  };

  // Helper to apply a selected Ledger (Saving / Cash / Bank / Suspense / LoanRecovery) onto a single row
  const applyLedgerChoiceToRow = (item: PreviewItem, ledgerChoiceKey: string): PreviewItem => {
    if (!ledgerChoiceKey || item.isAlreadyPaid || item.isLienMarked) return item;

    const [rawMode, rawId] = ledgerChoiceKey.split(':');
    const chosenMode = rawMode as MisDisbursementMode;
    const chosenLedgerId = Number(rawId) || 0;
    const tds = Number(item.tdsAmount) || 0;
    const netAmt = Math.max(0, (Number(item.grossInterest) || 0) - tds);

    if (chosenMode === 'LoanRecovery') {
      if (!item.targetLoanAccountID) return item;
      return {
        ...item,
        disbursementMode: 'LoanRecovery',
        targetCreditLedgerID: undefined,
        targetCreditLedgerName: 'कर्ज खाते वळती',
        loanAdjustedAmount: netAmt,
        netDisbursedAmount: 0
      };
    }

    const ledgerObj = payoutLedgers.find((l) => l.ledgerID === chosenLedgerId);
    const ledgerName = ledgerObj?.ledgerName || item.targetCreditLedgerName || '';

    // Requirement #4: When Saving Ledger is selected, auto-match customer's Saving Account (with Old A/c No & CIF No!)
    if (chosenMode === 'SavingTransfer') {
      const sbList = item.customerSavingAccounts || [];
      const matchedByLedger = chosenLedgerId > 0
        ? sbList.find((s) => Number(s.ledgerID) === chosenLedgerId)
        : undefined;
      const currentLinked = item.targetSavingAccountID
        ? sbList.find((s) => s.savingAccountID === item.targetSavingAccountID)
        : undefined;
      const autoSb = matchedByLedger || currentLinked || sbList[0];

      return {
        ...item,
        disbursementMode: 'SavingTransfer',
        targetCreditLedgerID: chosenLedgerId > 0 ? chosenLedgerId : (autoSb?.ledgerID || savingLedgers[0]?.ledgerID),
        targetCreditLedgerName: ledgerName || autoSb?.ledgerName || 'बचत ठेव लेजर',
        targetSavingAccountID: autoSb ? autoSb.savingAccountID : item.targetSavingAccountID,
        targetSavingAccountNo: autoSb ? autoSb.accountNo : item.targetSavingAccountNo,
        targetSavingOldAccountNo: autoSb ? (autoSb.oldAccountNo || '') : (item.targetSavingOldAccountNo || ''),
        targetSavingCifNo: autoSb?.cifNo || item.cifNo || '',
        targetSavingAccountBalance: autoSb ? autoSb.currentBalance : item.targetSavingAccountBalance,
        loanAdjustedAmount: 0,
        netDisbursedAmount: netAmt,
        warningNote: undefined
      };
    }

    // Cash, Bank, or Suspense Ledger
    return {
      ...item,
      disbursementMode: chosenMode,
      targetCreditLedgerID: chosenLedgerId > 0 ? chosenLedgerId : undefined,
      targetCreditLedgerName: ledgerName,
      loanAdjustedAmount: 0,
      netDisbursedAmount: netAmt,
      warningNote: undefined
    };
  };

  // Requirement #3: Per-row Ledger Selection (Cash / Saving / Bank / Suspense / Loan)
  const handleRowLedgerSelect = (fdAccountId: number, ledgerChoiceKey: string) => {
    setPreviewItems((prev) =>
      prev.map((i) => (i.fdAccountID === fdAccountId ? applyLedgerChoiceToRow(i, ledgerChoiceKey) : i))
    );
  };

  // Requirement #3: Top Batch Ledger Selection across all unlocked rows
  const handleBatchLedgerSelect = (ledgerChoiceKey: string) => {
    setBatchLedgerKey(ledgerChoiceKey);
    if (!ledgerChoiceKey) return;
    setPreviewItems((prev) =>
      prev.map((i) => {
        if (i.isAlreadyPaid || i.isLienMarked) return i;
        return applyLedgerChoiceToRow(i, ledgerChoiceKey);
      })
    );
  };

  const getRowLedgerSelectValue = (item: PreviewItem): string => {
    if (item.disbursementMode === 'LoanRecovery') return 'LoanRecovery:0';
    if (item.targetCreditLedgerID && payoutLedgers.some((l) => l.ledgerID === item.targetCreditLedgerID && l.category === item.disbursementMode)) {
      return `${item.disbursementMode}:${item.targetCreditLedgerID}`;
    }
    if (item.disbursementMode === 'SavingTransfer' && savingLedgers.length > 0) {
      return `SavingTransfer:${savingLedgers[0].ledgerID}`;
    }
    if (item.disbursementMode === 'Cash' && cashLedgers.length > 0) {
      return `Cash:${cashLedgers[0].ledgerID}`;
    }
    if (item.disbursementMode === 'Bank' && bankLedgers.length > 0) {
      return `Bank:${bankLedgers[0].ledgerID}`;
    }
    if (item.disbursementMode === 'Suspense' && suspenseLedgers.length > 0) {
      return `Suspense:${suspenseLedgers[0].ledgerID}`;
    }
    return `${item.disbursementMode}:${item.targetCreditLedgerID || 0}`;
  };

  // 2. Fetch Register
  const handleFetchRegister = async () => {
    setLoadingRegister(true);
    try {
      const res = await axios.get(`${API_URL}/FdMisPayout/Register`, {
        params: {
          branchId: branchID,
          payoutYear,
          payoutMonth
        }
      });
      const mapped = (res.data || []).map((r: any) => {
        const fdOldAcc = String(r.oldAccountNo ?? r.OldAccountNo ?? r.legacyAccountNumber ?? r.LegacyAccountNumber ?? '').trim();
        return {
          ...r,
          oldAccountNo: fdOldAcc || undefined,
          legacyAccountNumber: fdOldAcc || undefined
        };
      });
      setRegisterRows(mapped);
    } catch (err: any) {
      console.error('Register fetch error', err);
    } finally {
      setLoadingRegister(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'register') {
      handleFetchRegister();
    }
  }, [activeTab, branchID, payoutYear, payoutMonth]);

  // Selection handlers
  const toggleSelect = (id: number) => {
    setPreviewItems((prev) =>
      prev.map((i) => (i.fdAccountID === id ? { ...i, isSelected: !i.isSelected } : i))
    );
  };

  const toggleSelectAll = (checked: boolean) => {
    setPreviewItems((prev) =>
      prev.map((i) => (!i.isAlreadyPaid && i.grossInterest > 0 ? { ...i, isSelected: checked } : i))
    );
  };

  const handleGrossInterestChange = (fdAccountId: number, newGross: number) => {
    setPreviewItems((prev) =>
      prev.map((i) => {
        if (i.fdAccountID !== fdAccountId || i.isAlreadyPaid) return i;
        const gross = Math.max(0, newGross);
        const tds = Number(i.tdsAmount) || 0;
        const netAmt = Math.max(0, gross - tds);
        if (i.disbursementMode === 'LoanRecovery') {
          return {
            ...i,
            grossInterest: gross,
            loanAdjustedAmount: netAmt,
            netDisbursedAmount: 0
          };
        }
        return {
          ...i,
          grossInterest: gross,
          loanAdjustedAmount: 0,
          netDisbursedAmount: netAmt
        };
      })
    );
  };

  const handleResetGrossInterest = (fdAccountId: number) => {
    setPreviewItems((prev) =>
      prev.map((i) => {
        if (i.fdAccountID !== fdAccountId || i.isAlreadyPaid) return i;
        const calcResult = computeRowDaysAndInterest(i, calcMethod, payoutYear, payoutMonth);
        return {
          ...i,
          ...calcResult
        };
      })
    );
  };

  const handleSavingAccountChange = (fdAccountId: number, savingAccountId: number) => {
    setPreviewItems((prev) =>
      prev.map((i) => {
        if (i.fdAccountID !== fdAccountId) return i;
        const selectedSb = i.customerSavingAccounts?.find((s) => s.savingAccountID === savingAccountId);
        if (!selectedSb) return i;
        const tds = Number(i.tdsAmount) || 0;
        const netAmt = Math.max(0, i.grossInterest - tds);
        const matchedSavLedger =
          (selectedSb.ledgerID ? savingLedgers.find((l) => l.ledgerID === selectedSb.ledgerID) : undefined) ||
          (i.targetCreditLedgerID ? savingLedgers.find((l) => l.ledgerID === i.targetCreditLedgerID) : undefined) ||
          savingLedgers[0];

        return {
          ...i,
          targetSavingAccountID: selectedSb.savingAccountID,
          targetSavingAccountNo: selectedSb.accountNo,
          targetSavingOldAccountNo: selectedSb.oldAccountNo || '',
          targetSavingCifNo: selectedSb.cifNo || i.cifNo || '',
          targetSavingAccountBalance: selectedSb.currentBalance,
          targetCreditLedgerID: matchedSavLedger?.ledgerID ?? selectedSb.ledgerID ?? i.targetCreditLedgerID,
          targetCreditLedgerName: matchedSavLedger?.ledgerName ?? selectedSb.ledgerName ?? i.targetCreditLedgerName,
          disbursementMode: 'SavingTransfer',
          netDisbursedAmount: netAmt,
          loanAdjustedAmount: 0,
          warningNote: undefined
        };
      })
    );
  };

  // Quick Saving Account Search Modal Handlers
  const handleOpenSbSearchModal = (item: PreviewItem) => {
    setSearchModalItem(item);
    const defaultTerm = item.cifNo || item.customerName || '';
    setSbSearchTerm(defaultTerm);
    setSbSearchResults([]);
    performSbSearch(defaultTerm);
  };

  const performSbSearch = async (term: string) => {
    if (!term || term.trim().length < 1) return;
    setSbSearchLoading(true);
    try {
      const res = await axios.get(`${API_URL}/SavingAccounts`, {
        params: { search: term.trim() }
      });
      const rows = Array.isArray(res.data) ? res.data : [];
      setSbSearchResults(rows.filter((r: any) => r.status !== 'Closed' && r.status !== 'बंद'));
    } catch (err) {
      console.error('Saving account search error', err);
    } finally {
      setSbSearchLoading(false);
    }
  };

  const handleSelectSearchedSb = (sb: any) => {
    if (!searchModalItem) return;
    const sbId = Number(sb.savingAccountID || sb.id);
    const accNo = String(sb.accountNo || '');
    const oldAccNo = String(sb.oldAccountNo ?? sb.OldAccountNo ?? sb.legacyAccountNumber ?? sb.LegacyAccountNumber ?? '');
    const sbCif = String(sb.cifNo ?? sb.CIFNo ?? searchModalItem.cifNo ?? '');
    const bal = Number(sb.currentBalance ?? sb.balance ?? 0);
    const sbLedgerId = Number(sb.ledgerID ?? sb.LedgerID ?? 0) || savingLedgers[0]?.ledgerID;
    const sbLedgerName = String(sb.ledgerName ?? sb.LedgerName ?? savingLedgers[0]?.ledgerName ?? 'बचत ठेव');

    setPreviewItems((prev) =>
      prev.map((i) => {
        if (i.fdAccountID !== searchModalItem.fdAccountID) return i;
        const tds = Number(i.tdsAmount) || 0;
        const netAmt = Math.max(0, i.grossInterest - tds);
        const existingOpts = i.customerSavingAccounts ? [...i.customerSavingAccounts] : [];
        if (!existingOpts.some((o) => o.savingAccountID === sbId)) {
          existingOpts.unshift({
            savingAccountID: sbId,
            accountNo: accNo,
            oldAccountNo: oldAccNo,
            cifNo: sbCif,
            currentBalance: bal,
            branchID: Number(sb.branchID ?? branchID),
            branchName: String(sb.branchName ?? ''),
            ledgerID: sbLedgerId,
            ledgerName: sbLedgerName
          });
        }

        return {
          ...i,
          customerSavingAccounts: existingOpts,
          targetSavingAccountID: sbId,
          targetSavingAccountNo: accNo,
          targetSavingOldAccountNo: oldAccNo,
          targetSavingCifNo: sbCif,
          targetSavingAccountBalance: bal,
          targetCreditLedgerID: sbLedgerId,
          targetCreditLedgerName: sbLedgerName,
          disbursementMode: 'SavingTransfer',
          netDisbursedAmount: netAmt,
          loanAdjustedAmount: 0,
          warningNote: undefined
        };
      })
    );
    setSearchModalItem(null);
  };

  // Summary Metrics
  const selectableItems = previewItems.filter((i) => !i.isAlreadyPaid && i.grossInterest > 0);
  const selectedItems = previewItems.filter((i) => i.isSelected && !i.isAlreadyPaid && i.grossInterest > 0);
  const totalSelectedGross = selectedItems.reduce((sum, i) => sum + (Number(i.grossInterest) || 0), 0);
  const totalSelectedLoanAdj = selectedItems.reduce((sum, i) => sum + (Number(i.loanAdjustedAmount) || 0), 0);
  const totalSelectedSbDisb = selectedItems
    .filter((i) => i.disbursementMode === 'SavingTransfer')
    .reduce((sum, i) => sum + (Number(i.netDisbursedAmount) || 0), 0);
  const totalSelectedCashDisb = selectedItems
    .filter((i) => i.disbursementMode === 'Cash')
    .reduce((sum, i) => sum + (Number(i.netDisbursedAmount) || 0), 0);
  const totalSelectedBankDisb = selectedItems
    .filter((i) => i.disbursementMode === 'Bank')
    .reduce((sum, i) => sum + (Number(i.netDisbursedAmount) || 0), 0);
  const totalSelectedSuspenseDisb = selectedItems
    .filter((i) => i.disbursementMode === 'Suspense')
    .reduce((sum, i) => sum + (Number(i.netDisbursedAmount) || 0), 0);

  const handleOpenConfirmModal = () => {
    if (selectedItems.length === 0) {
      setError('कृपया किमान एक खाते निवडा.');
      return;
    }

    const missingSbItem = selectedItems.find(
      (i) => i.disbursementMode === 'SavingTransfer' && (!i.targetSavingAccountID || i.targetSavingAccountID <= 0)
    );
    if (missingSbItem) {
      setError(
        `खातेदार "${missingSbItem.customerName}" (FD क्र. ${missingSbItem.accountNo}) साठी बचत ठेव लेजर निवडले आहे, परंतु बचत खाते जोडलेले नाही. कृपया "+ बचत खाते शोधा" वरून बचत खाते निवडा किंवा रोख / बँक लेजर निवडा.`
      );
      return;
    }

    const missingBankItem = selectedItems.find(
      (i) => i.disbursementMode === 'Bank' && (!i.targetCreditLedgerID || i.targetCreditLedgerID <= 0)
    );
    if (missingBankItem) {
      setError(`खातेदार "${missingBankItem.customerName}" साठी कृपया वैध बँक खाते लेजर निवडा.`);
      return;
    }

    setError('');
    setShowConfirmModal(true);
  };

  // Execute Batch
  const handleExecuteBatch = async () => {
    if (selectedItems.length === 0) {
      setError('कृपया किमान एक खाते निवडा.');
      setShowConfirmModal(false);
      return;
    }

    setError('');
    setSuccess('');
    setLoadingExecute(true);

    try {
      const firstBankLedgerId = selectedItems.find((i) => i.disbursementMode === 'Bank' && i.targetCreditLedgerID)?.targetCreditLedgerID || null;

      const payload = {
        branchID,
        payoutYear,
        payoutMonth,
        payoutDate,
        accountingMode,
        bankLedgerID: firstBankLedgerId,
        selectedItems: selectedItems.map((i) => ({
          fdAccountID: i.fdAccountID,
          elapsedDays: i.elapsedDays,
          grossInterest: i.grossInterest,
          tdsAmount: Number(i.tdsAmount) || 0,
          loanAdjustedAmount: Number(i.loanAdjustedAmount) || 0,
          netDisbursedAmount: Number(i.netDisbursedAmount) || 0,
          disbursementMode: i.disbursementMode,
          targetSavingAccountID: i.disbursementMode === 'SavingTransfer' ? (i.targetSavingAccountID || null) : null,
          targetLoanAccountID: i.disbursementMode === 'LoanRecovery' ? (i.targetLoanAccountID || null) : null,
          bankLedgerID: i.disbursementMode === 'Bank' ? (i.targetCreditLedgerID || null) : null,
          creditLedgerID: i.targetCreditLedgerID || null,
          remarks: `MIS Payout ${payoutMonth}/${payoutYear}`
        }))
      };

      const res = await axios.post(`${API_URL}/FdMisPayout/ExecuteBatch`, payload);
      setSuccess(`${res.data.message || res.data.Message} (व्हाउचर क्र: ${res.data.voucherNo || res.data.VoucherNo})`);
      setShowConfirmModal(false);
      handleFetchPreview();
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data || err.message || 'व्याज ट्रान्सफर करताना त्रुटी आली.';
      setError(typeof msg === 'string' ? msg : JSON.stringify(msg));
      setShowConfirmModal(false);
    } finally {
      setLoadingExecute(false);
    }
  };

  const filteredPreview = previewItems.filter((item) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      item.accountNo.toLowerCase().includes(q) ||
      (item.oldAccountNo && item.oldAccountNo.toLowerCase().includes(q)) ||
      (item.legacyAccountNumber && item.legacyAccountNumber.toLowerCase().includes(q)) ||
      item.customerName.toLowerCase().includes(q) ||
      item.cifNo.toLowerCase().includes(q) ||
      item.memberNo.toLowerCase().includes(q) ||
      (item.targetSavingAccountNo && item.targetSavingAccountNo.toLowerCase().includes(q)) ||
      (item.targetSavingOldAccountNo && item.targetSavingOldAccountNo.toLowerCase().includes(q)) ||
      (item.targetCreditLedgerName && item.targetCreditLedgerName.toLowerCase().includes(q))
    );
  });

  const filteredRegister = registerRows.filter((row) => {
    if (!registerSearch) return true;
    const q = registerSearch.toLowerCase();
    return (
      row.accountNo.toLowerCase().includes(q) ||
      (row.oldAccountNo && row.oldAccountNo.toLowerCase().includes(q)) ||
      (row.legacyAccountNumber && row.legacyAccountNumber.toLowerCase().includes(q)) ||
      row.customerName.toLowerCase().includes(q) ||
      (row.voucherNo && row.voucherNo.toLowerCase().includes(q)) ||
      (row.targetSavingAccountNo && row.targetSavingAccountNo.toLowerCase().includes(q)) ||
      (row.targetSavingOldAccountNo && row.targetSavingOldAccountNo.toLowerCase().includes(q))
    );
  });

  return (
    <div className="p-3 max-w-7xl mx-auto space-y-2.5 font-sans text-xs">
      {/* Top ERP Header Banner matching CBS theme */}
      <div className="bg-primary px-3 py-2 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs rounded-sm">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-blue-100 shrink-0" />
          <div>
            <h1 className="text-sm font-bold tracking-wide flex items-center gap-2">
              मुदत ठेव मासिक व्याज ट्रान्सफर व परतावा
              <span className="text-[10px] bg-white/20 text-white font-semibold px-2 py-0.5 rounded-sm font-mono">
                FD MIS Payout
              </span>
            </h1>
            <p className="text-[10px] text-blue-100 font-normal">
              दरमहा ठेवीदारांच्या बचत खात्यात, रोख किंवा बँक लेजरद्वारे मासिक व्याज वर्ग करणे व कर्जात वळती
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center bg-black/20 p-0.5 rounded-sm border border-white/20 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('payout')}
            className={`px-3 py-1 text-xs font-semibold rounded-sm transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'payout'
                ? 'bg-white text-gray-900 shadow-xs font-bold'
                : 'text-white/90 hover:text-white hover:bg-white/10'
            }`}
          >
            <Coins size={13} />
            मासिक वाटप
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('register')}
            className={`px-3 py-1 text-xs font-semibold rounded-sm transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'register'
                ? 'bg-white text-gray-900 shadow-xs font-bold'
                : 'text-white/90 hover:text-white hover:bg-white/10'
            }`}
          >
            <History size={13} />
            मासिक वाटप नोंदवही
          </button>
        </div>
      </div>

      {/* Simplified, Clean Filter Bar */}
      <div className="bg-white p-2.5 rounded-sm border border-gray-200 shadow-2xs space-y-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 items-end">
          {/* Branch */}
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">शाखा (Branch) *</label>
            {isHeadOfficeOrAdmin ? (
              <select
                value={branchID}
                onChange={(e) => {
                  const nextBranch = parseInt(e.target.value, 10);
                  setBranchID(nextBranch);
                  const autoMethod = resolveDefaultCalcMethodForSchemeSelection(schemes, selectedSchemeId, nextBranch);
                  setCalcMethod(autoMethod);
                  setIsSchemeSyncedMethod(true);
                  setPreviewItems([]);
                  setError('');
                }}
                className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-primary bg-white font-medium"
              >
                {branches.map((b) => (
                  <option key={b.branchID} value={b.branchID}>
                    {b.branchName} ({b.branchCode})
                  </option>
                ))}
              </select>
            ) : (
              <div className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs bg-gray-100 font-bold text-gray-800 flex items-center gap-1">
                <span>🔒</span>
                <span className="truncate">{branches.find((b) => b.branchID === branchID)?.branchName || user?.branchName || 'Branch'}</span>
              </div>
            )}
          </div>

          {/* Scheme Filter (Auto-syncs Interest Calculation Method on change) */}
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">मुदत ठेव योजना (Scheme)</label>
            <select
              value={selectedSchemeId}
              onChange={(e) => handleSchemeFilterChange(e.target.value)}
              className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-primary bg-white font-medium"
            >
              <option value="">सर्व योजना (All Schemes)</option>
              {schemes.map((s) => (
                <option key={s.fdSchemeID || s.schemeID} value={s.fdSchemeID || s.schemeID}>
                  {s.schemeName} ({resolveSchemeCalcMethod(s) === 'Daily' ? 'प्रत्यक्ष दिवस' : 'मासिक समान'})
                </option>
              ))}
            </select>
          </div>

          {/* Year & Month Grouped */}
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">वर्ष व महिना *</label>
            <div className="flex gap-1">
              <select
                value={payoutYear}
                onChange={(e) => {
                  setPayoutYear(parseInt(e.target.value, 10));
                  setPreviewItems([]);
                }}
                className="w-20 border border-gray-300 rounded-sm px-1.5 py-1 text-xs focus:outline-none focus:border-primary bg-white font-bold"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={payoutMonth}
                onChange={(e) => {
                  setPayoutMonth(parseInt(e.target.value, 10));
                  setPreviewItems([]);
                }}
                className="flex-1 border border-gray-300 rounded-sm px-1.5 py-1 text-xs focus:outline-none focus:border-primary bg-white font-bold"
              >
                {MARATHI_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Payout Date */}
          <div>
            <label className="block text-[11px] font-medium text-gray-600 mb-0.5">वाटप तारीख (Date) *</label>
            <input
              type="date"
              value={payoutDate}
              onChange={(e) => setPayoutDate(e.target.value)}
              className="w-full border border-gray-300 rounded-sm px-2 py-1 text-xs focus:outline-none focus:border-primary bg-white"
            />
          </div>

          {/* Fetch Preview Button */}
          <div>
            {activeTab === 'payout' ? (
              <button
                type="button"
                onClick={handleFetchPreview}
                disabled={loadingPreview}
                className="w-full bg-primary hover:opacity-90 text-white px-3 py-1.5 rounded-sm shadow-xs text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                {loadingPreview ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    शोधत आहे...
                  </>
                ) : (
                  <>
                    <Search size={14} />
                    प्रिव्ह्यू पहा (Preview)
                  </>
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleFetchRegister}
                disabled={loadingRegister}
                className="w-full bg-primary hover:opacity-90 text-white px-3 py-1.5 rounded-sm shadow-xs text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer disabled:opacity-50"
              >
                <History size={14} />
                नोंदवही रिफ्रेश
              </button>
            )}
          </div>
        </div>

        {/* Calculation Formula Toggle + Batch Ledger Selector Strip */}
        {activeTab === 'payout' && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-gray-100 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-gray-700 flex items-center gap-1">
                व्याज गणना पद्धत:
                {isSchemeSyncedMethod && (
                  <span className="text-[10px] bg-blue-50 text-primary border border-blue-200 px-1.5 py-0.2 rounded-sm font-semibold">
                    योजनेनुसार ऑटो
                  </span>
                )}
              </span>

              <label
                className={`inline-flex items-center gap-1.5 cursor-pointer font-medium px-2 py-0.5 rounded-sm border transition ${
                  calcMethod === 'Monthly'
                    ? 'bg-primary/10 border-primary text-gray-900 font-bold'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="calcMethod"
                  value="Monthly"
                  checked={calcMethod === 'Monthly'}
                  onChange={() => handleCalcMethodChange('Monthly')}
                  className="text-primary focus:ring-primary"
                />
                <span>१. दरमहा समान हप्ता <strong>((P×R)/1200)</strong></span>
              </label>

              <label
                className={`inline-flex items-center gap-1.5 cursor-pointer font-medium px-2 py-0.5 rounded-sm border transition ${
                  calcMethod === 'Daily'
                    ? 'bg-primary/10 border-primary text-gray-900 font-bold'
                    : 'bg-gray-50 border-gray-200 text-gray-700'
                }`}
              >
                <input
                  type="radio"
                  name="calcMethod"
                  value="Daily"
                  checked={calcMethod === 'Daily'}
                  onChange={() => handleCalcMethodChange('Daily')}
                  className="text-primary focus:ring-primary"
                />
                <span>
                  २. प्रत्यक्ष दिवसानुसार <strong>((P×R×दिवस)/३६५००)</strong> — {selectedMonthMeta?.short || 'महिना'} ({selectedMonthDays} दिवस)
                </span>
              </label>
            </div>

            {/* Batch Ledger Quick Apply Selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-gray-600">सामूहिक जमा लेजर:</span>
              <select
                value={batchLedgerKey}
                disabled={selectableItems.length === 0}
                onChange={(e) => handleBatchLedgerSelect(e.target.value)}
                className="border border-gray-300 rounded-sm px-2 py-0.5 text-xs font-semibold bg-white text-gray-800 focus:outline-none focus:border-primary disabled:bg-gray-100 max-w-[230px]"
                title="सर्व खात्यांसाठी एकाच क्लिकवर बचत, रोख किंवा बँक लेजर निवडा"
              >
                <option value="">-- सर्व ओळींना लेजर लागू करा --</option>
                {savingLedgers.length > 0 && (
                  <optgroup label="बचत ठेव लेजर (Saving Ledger)">
                    {savingLedgers.map((l) => (
                      <option key={`batch-sav-${l.ledgerID}`} value={`SavingTransfer:${l.ledgerID}`}>
                        बचत: {l.ledgerName}
                      </option>
                    ))}
                  </optgroup>
                )}
                {cashLedgers.length > 0 && (
                  <optgroup label="रोख लेजर (Cash Ledger)">
                    {cashLedgers.map((l) => (
                      <option key={`batch-cash-${l.ledgerID}`} value={`Cash:${l.ledgerID}`}>
                        रोख: {l.ledgerName}
                      </option>
                    ))}
                  </optgroup>
                )}
                {bankLedgers.length > 0 && (
                  <optgroup label="बँक खाते लेजर (Bank Ledger)">
                    {bankLedgers.map((l) => (
                      <option key={`batch-bank-${l.ledgerID}`} value={`Bank:${l.ledgerID}`}>
                        बँक: {l.ledgerName}
                      </option>
                    ))}
                  </optgroup>
                )}
                {suspenseLedgers.length > 0 && (
                  <optgroup label="उचंत लेजर (Suspense)">
                    {suspenseLedgers.map((l) => (
                      <option key={`batch-susp-${l.ledgerID}`} value={`Suspense:${l.ledgerID}`}>
                        उचंत: {l.ledgerName}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 border-l-4 border-l-red-500 text-red-800 px-3 py-2 rounded-sm text-xs flex items-center gap-2 font-medium">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span className="whitespace-pre-line">{error}</span>
        </div>
      )}
      {success && (
        <div className="bg-emerald-50 border border-emerald-200 border-l-4 border-l-emerald-500 text-emerald-900 px-3 py-2 rounded-sm text-xs flex items-center gap-2 font-bold shadow-xs">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span className="whitespace-pre-line">{success}</span>
        </div>
      )}

      {/* MAIN TAB 1: PAYOUT VIEW */}
      {activeTab === 'payout' && (
        <div className="space-y-2">
          {/* Streamlined Single-Row Summary & Action Bar */}
          <div className="bg-white px-3 py-2 rounded-sm border border-gray-200 shadow-2xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span>एकूण खाती: <strong className="text-gray-900 font-bold">{previewItems.length}</strong></span>
              <span className="text-gray-300">|</span>
              <span>निवडलेली: <strong className="text-primary font-bold">{selectedItems.length}</strong></span>
              <span className="text-gray-300">|</span>
              <span>देय मासिक व्याज: <strong className="text-primary font-bold text-sm">₹ {totalSelectedGross.toLocaleString('en-IN')}</strong></span>
              {totalSelectedSbDisb > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span>बचत जमा: <strong className="text-emerald-700 font-bold">₹ {totalSelectedSbDisb.toLocaleString('en-IN')}</strong></span>
                </>
              )}
              {totalSelectedCashDisb > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span>रोख परतावा: <strong className="text-teal-700 font-bold">₹ {totalSelectedCashDisb.toLocaleString('en-IN')}</strong></span>
                </>
              )}
              {totalSelectedBankDisb > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span>बँक वर्ग: <strong className="text-indigo-700 font-bold">₹ {totalSelectedBankDisb.toLocaleString('en-IN')}</strong></span>
                </>
              )}
              {totalSelectedLoanAdj > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span>कर्ज वळती: <strong className="text-amber-700 font-bold">₹ {totalSelectedLoanAdj.toLocaleString('en-IN')}</strong></span>
                </>
              )}
              {totalSelectedSuspenseDisb > 0 && (
                <>
                  <span className="text-gray-300">|</span>
                  <span>उचंत: <strong className="text-gray-700 font-bold">₹ {totalSelectedSuspenseDisb.toLocaleString('en-IN')}</strong></span>
                </>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleSelectAll(selectedItems.length !== selectableItems.length)}
                disabled={selectableItems.length === 0}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer disabled:opacity-40"
              >
                {selectedItems.length === selectableItems.length && selectableItems.length > 0 ? (
                  <CheckSquare size={14} className="text-primary" />
                ) : (
                  <Square size={14} className="text-gray-400" />
                )}
                सर्व निवडा ({selectedItems.length}/{selectableItems.length})
              </button>

              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2 text-gray-400" />
                <input
                  type="text"
                  placeholder="खाते क्र., जुना क्र., नाव, CIF शोधा..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-7 pr-2 py-1 text-xs bg-white border border-gray-300 rounded-sm w-56 focus:outline-none focus:border-primary"
                />
              </div>

              <button
                type="button"
                onClick={handleOpenConfirmModal}
                disabled={selectedItems.length === 0 || loadingExecute}
                className="bg-primary hover:opacity-90 text-white px-3 py-1 rounded-sm shadow-xs text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Wallet size={14} />
                व्याज ट्रान्सफर करा ({selectedItems.length})
              </button>
            </div>
          </div>

          {/* Clean 8-Column Grid Table */}
          <div className="bg-white rounded-sm shadow-xs border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto max-h-[580px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-100 text-gray-700 uppercase font-bold tracking-wider text-[10px] sticky top-0 z-10 border-b border-gray-200">
                  <tr>
                    <th className="p-2 w-10 text-center">निवड</th>
                    <th className="p-2 min-w-[190px]">FD खाते क्र. व खातेदार</th>
                    <th className="p-2 text-right min-w-[110px]">ठेव मुद्दल व दर</th>
                    <th className="p-2 text-center min-w-[85px]">कालावधी</th>
                    <th className="p-2 text-right min-w-[130px]">देय मासिक व्याज (₹)</th>
                    <th className="p-2 min-w-[205px]">जमा लेजर (Cash / Saving / Bank)</th>
                    <th className="p-2 min-w-[240px]">वाटप प्रकार (जुना क्र. व CIF)</th>
                    <th className="p-2 text-center w-24">स्थिती</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {filteredPreview.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-6 text-center text-gray-400 font-semibold">
                        {loadingPreview ? 'माहिती गोळा केली जात आहे...' : 'प्रदर्शनासाठी कोणतेही रेकॉर्ड सापडले नाही.'}
                      </td>
                    </tr>
                  ) : (
                    filteredPreview.map((item) => {
                      const isDisabled = item.isAlreadyPaid;
                      const currentLedgerSelectVal = getRowLedgerSelectValue(item);
                      const effectiveCif = item.targetSavingCifNo || item.cifNo || '-';

                      return (
                        <tr
                          key={item.fdAccountID}
                          className={`transition-colors hover:bg-blue-50/40 ${
                            item.isSelected ? 'bg-blue-50/30' : (isDisabled ? 'bg-gray-50/70 opacity-60' : '')
                          }`}
                        >
                          {/* 1. Checkbox */}
                          <td className="p-2 text-center">
                            <input
                              type="checkbox"
                              checked={item.isSelected}
                              disabled={isDisabled || item.grossInterest <= 0}
                              onChange={() => toggleSelect(item.fdAccountID)}
                              className="rounded-sm border-gray-300 text-primary focus:ring-primary cursor-pointer disabled:cursor-not-allowed"
                            />
                          </td>

                          {/* 2. FD Account & Customer */}
                          <td className="p-2">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-gray-900">{item.accountNo}</span>
                              {(item.oldAccountNo || item.legacyAccountNumber) && (
                                <span className="bg-amber-100 text-amber-950 border border-amber-300 px-1.5 py-0.2 rounded-sm text-[10px] font-extrabold shadow-2xs">
                                  जुना क्र: {item.oldAccountNo || item.legacyAccountNumber}
                                </span>
                              )}
                            </div>
                            <div className="text-gray-800 font-semibold">{item.customerName}</div>
                            <div className="text-[10px] text-gray-500">
                              CIF: {item.cifNo || '-'} | {item.schemeName}
                            </div>
                          </td>

                          {/* 3. Deposit Amount & Rate */}
                          <td className="p-2 text-right">
                            <div className="font-bold text-gray-900">₹ {item.depositPrincipal.toLocaleString('en-IN')}</div>
                            <div className="text-[11px] font-semibold text-primary">{item.interestRate}% वार्षिक</div>
                          </td>

                          {/* 4. Exact Calendar Days */}
                          <td className="p-2 text-center">
                            <div className="font-bold text-gray-800">{item.elapsedDays} दिवस</div>
                            {item.isBrokenPeriod && (
                              <span className="text-[9px] bg-amber-50 text-amber-800 border border-amber-200 px-1 py-0.2 rounded-sm font-semibold inline-block mt-0.5">
                                अपूर्ण महिना
                              </span>
                            )}
                          </td>

                          {/* 5. Gross Monthly Interest (Editable with Reset for manual edits) */}
                          <td className="p-2 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <span className="text-gray-500 font-bold">₹</span>
                              <input
                                type="number"
                                min="0"
                                step="1"
                                disabled={isDisabled}
                                value={item.grossInterest}
                                onChange={(e) => handleGrossInterestChange(item.fdAccountID, parseFloat(e.target.value) || 0)}
                                className="w-20 text-right font-bold text-gray-900 border border-gray-300 rounded-sm px-1.5 py-0.5 text-xs focus:outline-none focus:border-primary disabled:bg-gray-100"
                                title="मासिक व्याज मॅन्युअल बदलता येईल"
                              />
                              <button
                                type="button"
                                title="निवडलेल्या सूत्रानुसार मूळ व्याज पुन्हा आणा"
                                disabled={isDisabled}
                                onClick={() => handleResetGrossInterest(item.fdAccountID)}
                                className="p-0.5 text-gray-400 hover:text-primary transition rounded-sm cursor-pointer font-bold text-sm"
                              >
                                ↺
                              </button>
                            </div>
                          </td>

                          {/* 6. Dynamic Ledger Selection (Saving / Cash / Bank / Suspense / Loan) */}
                          <td className="p-2">
                            {item.isLienMarked && item.disbursementMode === 'LoanRecovery' ? (
                              <div className="text-amber-800 bg-amber-50/70 border border-amber-200 rounded-sm px-2 py-1">
                                <span className="font-bold block text-[11px]">🔒 तारण कर्ज वळती</span>
                                <span className="text-[10px] text-amber-700">कर्ज: {item.targetLoanAccountNo}</span>
                              </div>
                            ) : (
                              <select
                                value={currentLedgerSelectVal}
                                disabled={isDisabled}
                                onChange={(e) => handleRowLedgerSelect(item.fdAccountID, e.target.value)}
                                className="w-full border border-gray-300 rounded-sm px-1.5 py-1 text-xs font-semibold bg-white text-gray-900 focus:outline-none focus:border-primary cursor-pointer disabled:bg-gray-100"
                                title="जमा करण्यासाठी बचत, रोख किंवा बँक लेजर निवडा"
                              >
                                {savingLedgers.length > 0 ? (
                                  <optgroup label="बचत ठेव लेजर (Saving)">
                                    {savingLedgers.map((l) => (
                                      <option key={`sav-${l.ledgerID}`} value={`SavingTransfer:${l.ledgerID}`}>
                                        बचत: {l.ledgerName}
                                      </option>
                                    ))}
                                  </optgroup>
                                ) : (
                                  <option value="SavingTransfer:0">बचत ठेव लेजर (Saving)</option>
                                )}

                                {cashLedgers.length > 0 ? (
                                  <optgroup label="रोख लेजर (Cash)">
                                    {cashLedgers.map((l) => (
                                      <option key={`cash-${l.ledgerID}`} value={`Cash:${l.ledgerID}`}>
                                        रोख: {l.ledgerName}
                                      </option>
                                    ))}
                                  </optgroup>
                                ) : (
                                  <option value="Cash:0">रोख लेजर (Cash)</option>
                                )}

                                {bankLedgers.length > 0 && (
                                  <optgroup label="बँक खाते लेजर (Bank)">
                                    {bankLedgers.map((l) => (
                                      <option key={`bank-${l.ledgerID}`} value={`Bank:${l.ledgerID}`}>
                                        बँक: {l.ledgerName}
                                      </option>
                                    ))}
                                  </optgroup>
                                )}

                                <optgroup label="इतर / वळती">
                                  {suspenseLedgers.length > 0 ? (
                                    suspenseLedgers.map((l) => (
                                      <option key={`susp-${l.ledgerID}`} value={`Suspense:${l.ledgerID}`}>
                                        उचंत: {l.ledgerName}
                                      </option>
                                    ))
                                  ) : (
                                    <option value="Suspense:0">उचंत खाते (Suspense)</option>
                                  )}
                                  {item.targetLoanAccountID && (
                                    <option value="LoanRecovery:0">
                                      कर्जात वळती ({item.targetLoanAccountNo})
                                    </option>
                                  )}
                                </optgroup>
                              </select>
                            )}
                          </td>

                          {/* 7. वाटप प्रकार — Auto-shows Old Account No + CIF No + Saving Account No when Saving Ledger is selected */}
                          <td className="p-2">
                            {item.disbursementMode === 'SavingTransfer' ? (
                              <div className="space-y-1">
                                <div className="flex items-center justify-between gap-1">
                                  <span className="inline-block bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-sm font-bold text-[11px]">
                                    बचत जमा ₹ {item.netDisbursedAmount.toLocaleString('en-IN')}
                                  </span>
                                  {!isDisabled && (
                                    <button
                                      type="button"
                                      onClick={() => handleOpenSbSearchModal(item)}
                                      className="text-primary hover:underline text-[10px] font-bold cursor-pointer shrink-0"
                                      title="बचत खाते शोधा किंवा बदला"
                                    >
                                      {item.targetSavingAccountNo ? 'बदला' : '+ खाते शोधा'}
                                    </button>
                                  )}
                                </div>

                                {item.customerSavingAccounts && item.customerSavingAccounts.length > 1 ? (
                                  <select
                                    value={item.targetSavingAccountID || ''}
                                    disabled={isDisabled}
                                    onChange={(e) => handleSavingAccountChange(item.fdAccountID, Number(e.target.value))}
                                    className="w-full border border-emerald-300 rounded-sm px-1.5 py-0.5 text-[11px] font-bold bg-white text-gray-900 focus:outline-none focus:border-primary cursor-pointer"
                                  >
                                    {item.customerSavingAccounts.map((sb) => (
                                      <option key={sb.savingAccountID} value={sb.savingAccountID}>
                                        {sb.oldAccountNo ? `जुना: ${sb.oldAccountNo} | ` : ''}{sb.accountNo} (₹ {sb.currentBalance.toLocaleString('en-IN')})
                                      </option>
                                    ))}
                                  </select>
                                ) : null}

                                {item.targetSavingAccountNo ? (
                                  <div className="bg-slate-50 border border-slate-200 rounded-sm px-1.5 py-1 text-[10px] leading-tight space-y-0.5">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      <span className="bg-amber-100 text-amber-950 border border-amber-300 px-1.5 py-0.2 rounded-sm font-extrabold">
                                        जुना क्र.: {item.targetSavingOldAccountNo || '-'}
                                      </span>
                                      <span className="font-bold text-primary">
                                        CIF: {effectiveCif}
                                      </span>
                                    </div>
                                    <div className="text-gray-700 font-semibold flex flex-wrap items-center justify-between gap-1">
                                      <span>बचत क्र.: <strong className="text-gray-900">{item.targetSavingAccountNo}</strong></span>
                                      <span className="text-emerald-700 font-bold">
                                        शिल्लक: ₹ {(item.targetSavingAccountBalance || 0).toLocaleString('en-IN')}
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="bg-amber-50 border border-amber-200 rounded-sm px-1.5 py-1 text-[10px] text-amber-900 flex items-center justify-between gap-1">
                                    <span>बचत खाते नाही (CIF: <b>{effectiveCif}</b>)</span>
                                    {!isDisabled && (
                                      <button
                                        type="button"
                                        onClick={() => handleOpenSbSearchModal(item)}
                                        className="text-primary font-bold underline cursor-pointer"
                                      >
                                        + शोधा
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            ) : item.disbursementMode === 'Cash' ? (
                              <div className="space-y-0.5">
                                <span className="inline-block bg-teal-50 text-teal-900 border border-teal-200 px-2 py-0.5 rounded-sm font-bold text-[11px]">
                                  रोख परतावा ₹ {item.netDisbursedAmount.toLocaleString('en-IN')}
                                </span>
                                <div className="text-[10px] text-gray-600 font-semibold">
                                  {item.targetCreditLedgerName || 'रोख लेजर'} | CIF: <strong className="text-gray-800">{item.cifNo || '-'}</strong>
                                </div>
                              </div>
                            ) : item.disbursementMode === 'Bank' ? (
                              <div className="space-y-0.5">
                                <span className="inline-block bg-indigo-50 text-indigo-900 border border-indigo-200 px-2 py-0.5 rounded-sm font-bold text-[11px]">
                                  बँक वर्ग ₹ {item.netDisbursedAmount.toLocaleString('en-IN')}
                                </span>
                                <div className="text-[10px] text-gray-600 font-semibold">
                                  {item.targetCreditLedgerName || 'बँक लेजर'} | CIF: <strong className="text-gray-800">{item.cifNo || '-'}</strong>
                                </div>
                              </div>
                            ) : item.disbursementMode === 'LoanRecovery' ? (
                              <div className="space-y-0.5">
                                <span className="inline-block bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-sm font-bold text-[11px]">
                                  कर्जात वळती ₹ {item.loanAdjustedAmount.toLocaleString('en-IN')}
                                </span>
                                <div className="text-[10px] text-gray-600 font-semibold">
                                  कर्ज क्र.: {item.targetLoanAccountNo || '-'} | शिल्लक: ₹ {(item.targetLoanBalance || 0).toLocaleString('en-IN')}
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-0.5">
                                <span className="inline-block bg-gray-100 text-gray-800 border border-gray-300 px-2 py-0.5 rounded-sm font-bold text-[11px]">
                                  उचंत जमा ₹ {item.netDisbursedAmount.toLocaleString('en-IN')}
                                </span>
                                <div className="text-[10px] text-gray-500 font-semibold">
                                  {item.targetCreditLedgerName || 'उचंत खाते'} | CIF: {item.cifNo || '-'}
                                </div>
                              </div>
                            )}
                          </td>

                          {/* 8. Status */}
                          <td className="p-2 text-center">
                            {item.isAlreadyPaid ? (
                              <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-[10px] px-1.5 py-0.5 rounded-sm font-semibold border border-gray-200">
                                <CheckCircle2 size={11} className="text-gray-500" /> जमा झाले
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 bg-blue-50 text-primary text-[10px] px-1.5 py-0.5 rounded-sm font-semibold border border-blue-200">
                                वाटप तयार
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* MAIN TAB 2: REGISTER VIEW */}
      {activeTab === 'register' && (
        <div className="bg-white rounded-sm shadow-xs border border-gray-200 p-2.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-200">
            <div>
              <h2 className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                <History size={15} className="text-primary" />
                मासिक व्याज वाटप नोंदवही (MIS Payout Register)
              </h2>
              <p className="text-[11px] text-gray-500">
                वर्ष: <b>{payoutYear}</b> | महिना: <b>{selectedMonthMeta?.label}</b>
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Search size={13} className="absolute left-2.5 top-2 text-gray-400" />
                <input
                  type="text"
                  placeholder="नोंदवहीत शोधा..."
                  value={registerSearch}
                  onChange={(e) => setRegisterSearch(e.target.value)}
                  className="pl-7 pr-2 py-1 text-xs bg-white border border-gray-300 rounded-sm w-52 focus:outline-none focus:border-primary"
                />
              </div>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[550px] overflow-y-auto border border-gray-200 rounded-sm">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-gray-100 text-gray-700 uppercase font-bold tracking-wider text-[10px] sticky top-0 z-10 border-b border-gray-200">
                <tr>
                  <th className="p-2">वाटप दिनांक</th>
                  <th className="p-2">व्हाउचर क्र.</th>
                  <th className="p-2">FD खाते क्र.</th>
                  <th className="p-2">खातेदार</th>
                  <th className="p-2 text-right">ठेव मुद्दल</th>
                  <th className="p-2 text-center">व्याजदर / दिवस</th>
                  <th className="p-2 text-right">मासिक व्याज</th>
                  <th className="p-2">वाटप प्रकार / बचत खाते</th>
                  <th className="p-2">वळती कर्ज खाते</th>
                  <th className="p-2 text-center">स्थिती</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium">
                {filteredRegister.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="p-6 text-center text-gray-400 font-semibold">
                      {loadingRegister ? 'नोंदवही लोड होत आहे...' : 'या कालावधीसाठी कोणतीही नोंद आढळली नाही.'}
                    </td>
                  </tr>
                ) : (
                  filteredRegister.map((r) => (
                    <tr key={r.payoutID} className="hover:bg-gray-50/50">
                      <td className="p-2 font-mono">{r.payoutDate ? r.payoutDate.split('T')[0] : '-'}</td>
                      <td className="p-2 font-bold text-primary font-mono">{r.voucherNo || '-'}</td>
                      <td className="p-2">
                        <div className="font-bold text-gray-800">{r.accountNo}</div>
                        {(r.oldAccountNo || r.legacyAccountNumber) && (
                          <div className="text-[10px] text-amber-900 font-bold bg-amber-50 border border-amber-200 px-1 py-0.2 rounded-xs inline-block mt-0.5">
                            जुना क्र: {r.oldAccountNo || r.legacyAccountNumber}
                          </div>
                        )}
                      </td>
                      <td className="p-2 text-gray-800 font-semibold">{r.customerName}</td>
                      <td className="p-2 text-right font-bold text-gray-800">₹ {r.depositPrincipal.toLocaleString('en-IN')}</td>
                      <td className="p-2 text-center font-bold text-gray-700">
                        {r.interestRate}% {r.elapsedDays ? `(${r.elapsedDays} दि.)` : ''}
                      </td>
                      <td className="p-2 text-right font-bold text-primary">₹ {r.grossInterest.toLocaleString('en-IN')}</td>
                      <td className="p-2 text-emerald-800 font-bold">
                        {r.disbursementMode === 'SavingTransfer'
                          ? `${r.targetSavingAccountNo || '-'}${r.targetSavingOldAccountNo ? ` (जुना: ${r.targetSavingOldAccountNo})` : ''}`
                          : r.disbursementMode === 'Cash'
                          ? 'रोख परतावा'
                          : r.disbursementMode === 'Bank'
                          ? 'बँक ट्रान्सफर'
                          : r.disbursementMode}
                      </td>
                      <td className="p-2 text-amber-800 font-bold">{r.targetLoanAccountNo || '-'}</td>
                      <td className="p-2 text-center">
                        <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded-sm text-[10px] font-bold">
                          ✓ यशस्वी
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-sm shadow-xl max-w-md w-full border border-gray-200 overflow-hidden">
            <div className="bg-primary px-4 py-2.5 text-white flex items-center justify-between">
              <span className="font-bold text-sm flex items-center gap-1.5">
                <Wallet size={16} /> मासिक व्याज ट्रान्सफर पुष्टीकरण
              </span>
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <p className="text-gray-700 font-medium">
                आपण निवडलेल्या <b>{selectedItems.length}</b> मुदत ठेव खात्यांचे मासिक व्याज वर्ग करत आहात:
              </p>

              <div className="bg-gray-50 border border-gray-200 rounded-sm p-3 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-600">एकूण देय मासिक व्याज:</span>
                  <span className="font-bold text-gray-900 text-sm">₹ {totalSelectedGross.toLocaleString('en-IN')}</span>
                </div>
                {totalSelectedSbDisb > 0 && (
                  <div className="flex justify-between">
                    <span className="text-emerald-700 font-medium">बचत खात्यात थेट जमा:</span>
                    <span className="font-bold text-emerald-800">₹ {totalSelectedSbDisb.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {totalSelectedCashDisb > 0 && (
                  <div className="flex justify-between">
                    <span className="text-teal-700 font-medium">रोख परतावा (Cash Ledger):</span>
                    <span className="font-bold text-teal-800">₹ {totalSelectedCashDisb.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {totalSelectedBankDisb > 0 && (
                  <div className="flex justify-between">
                    <span className="text-indigo-700 font-medium">बँक वर्ग (Bank Ledger):</span>
                    <span className="font-bold text-indigo-800">₹ {totalSelectedBankDisb.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {totalSelectedLoanAdj > 0 && (
                  <div className="flex justify-between">
                    <span className="text-amber-700 font-medium">तारण कर्जात वळती:</span>
                    <span className="font-bold text-amber-800">₹ {totalSelectedLoanAdj.toLocaleString('en-IN')}</span>
                  </div>
                )}
                {totalSelectedSuspenseDisb > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-700 font-medium">उचंत खात्यात जमा:</span>
                    <span className="font-bold text-gray-800">₹ {totalSelectedSuspenseDisb.toLocaleString('en-IN')}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-gray-200 pt-1.5">
                  <span className="text-gray-600">व्याज गणना पद्धत:</span>
                  <span className="font-bold text-gray-900">
                    {calcMethod === 'Daily' ? `प्रत्यक्ष दिवसानुसार (${selectedMonthDays} दिवस)` : 'दरमहा समान हप्ता ((P×R)/1200)'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">वाटप दिनांक:</span>
                  <span className="font-bold text-gray-900">{payoutDate}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={loadingExecute}
                  className="px-3 py-1.5 border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-100 font-semibold cursor-pointer"
                >
                  रद्द करा
                </button>
                <button
                  type="button"
                  onClick={handleExecuteBatch}
                  disabled={loadingExecute}
                  className="bg-primary hover:opacity-90 text-white px-4 py-1.5 rounded-sm font-bold shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {loadingExecute ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ट्रान्सफर होत आहे...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={14} /> होय, व्याज वर्ग करा
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Saving Account Search Modal (Shows Old A/c No & CIF No) */}
      {searchModalItem && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3">
          <div className="bg-white rounded-sm shadow-xl max-w-lg w-full border border-gray-200 overflow-hidden">
            <div className="bg-primary px-4 py-2.5 text-white flex items-center justify-between">
              <span className="font-bold text-sm flex items-center gap-1.5">
                <Search size={16} /> बचत खाते शोधा व निवडा
              </span>
              <button
                type="button"
                onClick={() => setSearchModalItem(null)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-3 text-xs">
              <div className="bg-blue-50/60 border border-blue-200 rounded-sm p-2 text-gray-800">
                FD खाते क्र: <b>{searchModalItem.accountNo}</b> | खातेदार: <b>{searchModalItem.customerName}</b> | CIF: <b>{searchModalItem.cifNo || '-'}</b>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="जुना खाते क्र., नवीन बचत क्र., नाव किंवा CIF टाका..."
                  value={sbSearchTerm}
                  onChange={(e) => setSbSearchTerm(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && performSbSearch(sbSearchTerm)}
                  className="flex-1 border border-gray-300 rounded-sm px-2 py-1.5 text-xs focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => performSbSearch(sbSearchTerm)}
                  disabled={sbSearchLoading}
                  className="bg-primary text-white px-3 py-1.5 rounded-sm font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Search size={13} /> शोधा
                </button>
              </div>

              <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-sm divide-y divide-gray-100">
                {sbSearchLoading ? (
                  <div className="p-4 text-center text-gray-500">शोधत आहे...</div>
                ) : sbSearchResults.length === 0 ? (
                  <div className="p-4 text-center text-gray-400">कोणतेही बचत खाते आढळले नाही. जुना क्र., नवीन क्र. किंवा नाव टाईप करून शोधा.</div>
                ) : (
                  sbSearchResults.map((sb) => {
                    const oldNo = sb.oldAccountNo || sb.OldAccountNo || sb.legacyAccountNumber || sb.LegacyAccountNumber || '';
                    const cifVal = sb.cifNo || sb.CIFNo || '';
                    return (
                      <div
                        key={sb.savingAccountID || sb.id}
                        onClick={() => handleSelectSearchedSb(sb)}
                        className="p-2 hover:bg-blue-50/50 cursor-pointer flex items-center justify-between transition"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-gray-900">{sb.accountNo}</span>
                            {oldNo && (
                              <span className="bg-amber-100 text-amber-950 border border-amber-300 px-1.5 py-0.2 rounded-sm text-[10px] font-extrabold">
                                जुना क्र.: {oldNo}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-gray-600 block">
                            {sb.customerName || sb.name} {cifVal ? `| CIF: ${cifVal}` : ''} {sb.ledgerName ? `| ${sb.ledgerName}` : ''}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="font-bold text-emerald-800 block">
                            ₹ {(sb.currentBalance ?? sb.balance ?? 0).toLocaleString('en-IN')}
                          </span>
                          <span className="text-[10px] text-primary font-bold">निवडा →</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="flex justify-end pt-2 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setSearchModalItem(null)}
                  className="px-3 py-1.5 border border-gray-300 rounded-sm text-gray-700 hover:bg-gray-100 font-semibold cursor-pointer"
                >
                  बंद करा
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FdMisInterestPayout;
