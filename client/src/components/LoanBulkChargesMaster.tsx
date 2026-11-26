import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import {
  Search,
  RefreshCw,
  CheckCircle2,
  FileText,
  Printer,
  FileSpreadsheet,
  ArrowLeft,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  X,
  AlertCircle,
  Coins,
  Building2,
  CheckSquare,
  Square,
} from 'lucide-react';
import SearchableSelect from './SearchableSelect';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr } from '../utils/businessDateUtils';
import { getCachedMasterData } from '../utils/apiCache';
import { getLockedBranchId, isHeadOfficeUser, resolveWriteBranchId } from '../utils/branchAccess';

export interface LoanBulkChargesMasterProps {
  onNavigate?: (tab: string, params?: any) => void;
}

interface BranchItem {
  branchID: number;
  branchCode?: string;
  branchName: string;
}

interface LoanRateItem {
  loanRateID: number;
  loanType: string;
  shortName?: string;
  loanCode?: string;
  interestRate?: number;
  loanLedgerID?: number | null;
  interestLedgerID?: number | null;
  overdueInterestLedgerID?: number | null;
  surchargeLedgerID?: number | null;
  recoveryFeeLedgerID?: number | null;
  processingFeeLedgerID?: number | null;
  isActive?: boolean;
}

interface LoanPrincipalLedgerItem {
  ledgerID: number;
  ledgerName: string;
  ledgerCode?: string;
}

interface DynamicIncomeLedgerItem {
  ledgerID: number;
  ledgerName: string;
  ledgerCode?: string;
  groupName?: string;
}

type OverdueFilterMode = 'MATURITY_ONLY' | 'ALL_OVERDUE';

interface OverdueCandidateRow {
  loanAccountID: number;
  branchID: number;
  loanAccountNo: string;
  legacyAccountNumber?: string | null;
  customerID?: number | null;
  cifNo?: string;
  legacyCustomerNo?: string | null;
  customerName: string;
  mobileNo?: string;
  memberID?: number | null;
  loanRateID: number;
  loanType: string;
  loanLedgerID?: number | null;
  loanDate: string;
  overdueDate?: string | null;
  maturityDate?: string | null;
  principalBalance: number;
  interestBalance?: number;
  overdueInterestBalance?: number;
  overdueAmount: number;
  overdueCategory?: 'MATURITY_OVERDUE' | 'INSTALLMENT_OVERDUE' | 'DUES_OVERDUE' | string;
  isMaturityOverdue?: boolean;
  isInstallmentOverdue?: boolean;
  hasReceivableDues?: boolean;
  overdueInstallmentsCount?: number;
  capitalizedRecoveryCharges?: number;
  alreadyChargedToday?: boolean;
  alreadyChargedAmount?: number;
  alreadyChargedVoucherNo?: string;
}

interface BulkBatchAccountItem {
  expenseId: number;
  loanAccountId: number;
  loanAccountNo: string;
  legacyAccountNumber?: string | null;
  customerID?: number | null;
  cifNo?: string;
  legacyCustomerNo?: string | null;
  customerName: string;
  loanType: string;
  amount: number;
  isPrincipalApplied: boolean;
}

interface BulkChargeBatchRow {
  voucherId: number;
  voucherNo: string;
  expenseDate: string;
  voucherStatus: string;
  isPrincipalApplied: boolean;
  creditLedgerId?: number | null;
  incomeLedgerName: string;
  accountCount: number;
  totalAmount: number;
  narration?: string;
  items: BulkBatchAccountItem[];
}

const getSchemeDisplayName = (lr?: LoanRateItem | null): string => {
  if (!lr) return '';
  const shortLabel = (lr.shortName || '').trim();
  if (shortLabel) return shortLabel;
  const typeLabel = (lr.loanType || '').trim();
  if (typeLabel) return typeLabel;
  return `कर्ज योजना #${lr.loanRateID}`;
};

const formatDisplayDate = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  const clean = dateStr.split('T')[0];
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[0]}`;
  }
  return dateStr;
};

const formatAmount = (num?: number | null): string => {
  return Number(num || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export default function LoanBulkChargesMaster({ onNavigate }: LoanBulkChargesMasterProps) {
  const { user, globalBranchId } = useAuth();
  const isHOUser = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  const defaultBizDate = getBusinessDateStr(user?.businessDate);

  const [branches, setBranches] = useState<BranchItem[]>(
    () => getCachedMasterData<BranchItem[]>('/api/Branches') || []
  );
  const [branchId, setBranchId] = useState<number>(() => resolveWriteBranchId(user, globalBranchId));
  const [loanRates, setLoanRates] = useState<LoanRateItem[]>(() => {
    const cached = getCachedMasterData<LoanRateItem[]>('/api/LoanRates') || [];
    return cached.filter((r) => r.isActive !== false);
  });
  const [loanPrincipalLedgers, setLoanPrincipalLedgers] = useState<LoanPrincipalLedgerItem[]>([]);
  const [incomeLedgers, setIncomeLedgers] = useState<DynamicIncomeLedgerItem[]>([]);

  // 2-Option Overdue Filter Mode + Scheme Scope + Dynamic Income Ledger + Amount + Date + Search
  const [overdueMode, setOverdueMode] = useState<OverdueFilterMode>('ALL_OVERDUE');
  const [schemeScope, setSchemeScope] = useState<'ALL' | 'SCHEME'>('SCHEME');
  const [selectedLoanRateId, setSelectedLoanRateId] = useState<number>(() => {
    const cached = (getCachedMasterData<LoanRateItem[]>('/api/LoanRates') || []).filter(
      (r) => r.isActive !== false
    );
    return cached.length > 0 ? cached[0].loanRateID : 0;
  });
  const [selectedCreditLedgerId, setSelectedCreditLedgerId] = useState<number>(0);
  const [defaultChargeAmount, setDefaultChargeAmount] = useState<string>('100');
  const [chargeDate, setChargeDate] = useState<string>(defaultBizDate);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [singleLoanQuickPickId, setSingleLoanQuickPickId] = useState<number>(0);

  // Candidate Grid State
  const [candidates, setCandidates] = useState<OverdueCandidateRow[]>([]);
  const [selectedLoanIds, setSelectedLoanIds] = useState<Set<number>>(new Set());
  const [rowAmounts, setRowAmounts] = useState<Record<number, string>>({});
  const [loadingCandidates, setLoadingCandidates] = useState<boolean>(false);
  const [savingBatch, setSavingBatch] = useState<boolean>(false);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  // Feedback Banner
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [lastSavedResult, setLastSavedResult] = useState<{
    voucherId: number;
    voucherNo: string;
    processedCount: number;
    totalAmount: number;
    incomeLedgerName: string;
    message: string;
  } | null>(null);

  // "यादी पहा" (Saved Batches Register Modal)
  const [showBatchListModal, setShowBatchListModal] = useState<boolean>(false);
  const [batches, setBatches] = useState<BulkChargeBatchRow[]>([]);
  const [loadingBatches, setLoadingBatches] = useState<boolean>(false);
  const [batchFromDate, setBatchFromDate] = useState<string>(defaultBizDate);
  const [batchToDate, setBatchToDate] = useState<string>(defaultBizDate);
  const [expandedBatchVoucherId, setExpandedBatchVoucherId] = useState<number | null>(null);

  // Optional Khatedar 360 customer filter support
  const urlCustomerId = useMemo(() => {
    const raw = new URLSearchParams(window.location.search).get('customerId');
    return raw ? Number(raw) : 0;
  }, []);

  useEffect(() => {
    if (user?.businessDate) {
      setChargeDate(getBusinessDateStr(user.businessDate));
    }
    if (lockedBranchId) {
      setBranchId(lockedBranchId);
    } else if (user?.branchID && user.branchID > 0) {
      setBranchId(Number(user.branchID));
    }
  }, [user?.businessDate, user?.branchID, lockedBranchId]);

  useEffect(() => {
    const loadMasters = async () => {
      try {
        const [branchRes, ratesRes, ledgersRes] = await Promise.allSettled([
          axios.get('/api/Branches'),
          axios.get('/api/LoanRates'),
          axios.get('/api/Vouchers/loan-charge-ledgers'),
        ]);

        if (branchRes.status === 'fulfilled' && Array.isArray(branchRes.value.data)) {
          const bList: BranchItem[] = branchRes.value.data;
          setBranches(bList);
          if (lockedBranchId) {
            setBranchId(lockedBranchId);
          } else if (bList.length > 0 && (!branchId || branchId <= 0)) {
            setBranchId(bList[0].branchID);
          }
        }

        if (ratesRes.status === 'fulfilled' && Array.isArray(ratesRes.value.data)) {
          const activeRates: LoanRateItem[] = ratesRes.value.data.filter(
            (r: LoanRateItem) => r.isActive !== false
          );
          setLoanRates(activeRates);
          setSelectedLoanRateId((prev) =>
            prev > 0 && activeRates.some((x) => x.loanRateID === prev)
              ? prev
              : activeRates[0]?.loanRateID || 0
          );
        }

        if (ledgersRes.status === 'fulfilled' && ledgersRes.value.data) {
          const dynPrincipal: LoanPrincipalLedgerItem[] = Array.isArray(
            ledgersRes.value.data.loanPrincipalLedgers
          )
            ? ledgersRes.value.data.loanPrincipalLedgers
            : [];
          setLoanPrincipalLedgers(dynPrincipal);

          const dynIncome: DynamicIncomeLedgerItem[] = Array.isArray(
            ledgersRes.value.data.incomeLedgers
          )
            ? ledgersRes.value.data.incomeLedgers
            : [];
          setIncomeLedgers(dynIncome);
        }
      } catch (err) {
        console.error('Error loading bulk loan charge master data', err);
      }
    };

    loadMasters();
  }, [lockedBranchId]);

  useEffect(() => {
    if (urlCustomerId > 0) {
      setSchemeScope('ALL');
      setOverdueMode('ALL_OVERDUE');
    }
  }, [urlCustomerId]);

  const branchOptions = useMemo(() => {
    const base = lockedBranchId
      ? branches.filter((b) => Number(b.branchID) === Number(lockedBranchId))
      : branches;
    if (base.length > 0) return base;
    return [
      {
        branchID: branchId || Number(user?.branchID || 1),
        branchName: user?.branchName || 'मुख्य शाखा',
      },
    ];
  }, [branches, lockedBranchId, branchId, user?.branchID, user?.branchName]);

  const selectedScheme = useMemo(
    () =>
      schemeScope === 'SCHEME'
        ? loanRates.find((r) => Number(r.loanRateID) === Number(selectedLoanRateId))
        : undefined,
    [schemeScope, loanRates, selectedLoanRateId]
  );

  const selectedLoanPrincipalLedgerName = useMemo(() => {
    if (!selectedScheme?.loanLedgerID) return '';
    const found = loanPrincipalLedgers.find(
      (l) => Number(l.ledgerID) === Number(selectedScheme.loanLedgerID)
    );
    return found ? found.ledgerName : '';
  }, [selectedScheme, loanPrincipalLedgers]);

  // 100% Foreign-Key Dynamic Income Ledger List:
  // 1) Selected scheme's mapped Income ledgers at top
  // 2) All general/common Income ledgers (excluding OTHER loan schemes' Interest/OverdueInterest ledgers)
  const { visibleIncomeLedgers, currentSchemeIncomeIdSet } = useMemo(() => {
    const incomeById = new Map<number, DynamicIncomeLedgerItem>();
    incomeLedgers.forEach((l) => incomeById.set(Number(l.ledgerID), l));

    if (schemeScope === 'SCHEME' && selectedScheme) {
      const candidateSchemeIds = [
        Number(selectedScheme.recoveryFeeLedgerID || 0),
        Number(selectedScheme.surchargeLedgerID || 0),
        Number(selectedScheme.overdueInterestLedgerID || 0),
        Number(selectedScheme.interestLedgerID || 0),
        Number(selectedScheme.processingFeeLedgerID || 0),
      ].filter((id) => id > 0 && incomeById.has(id));

      const uniqueSchemeIds: number[] = [];
      const schemeIdSet = new Set<number>();
      candidateSchemeIds.forEach((id) => {
        if (!schemeIdSet.has(id)) {
          schemeIdSet.add(id);
          uniqueSchemeIds.push(id);
        }
      });

      const otherSchemeInterestIds = new Set<number>();
      loanRates.forEach((r) => {
        if (Number(r.loanRateID) === Number(selectedScheme.loanRateID)) return;
        const intId = Number(r.interestLedgerID || 0);
        const ovdId = Number(r.overdueInterestLedgerID || 0);
        if (intId > 0 && !schemeIdSet.has(intId)) otherSchemeInterestIds.add(intId);
        if (ovdId > 0 && !schemeIdSet.has(ovdId)) otherSchemeInterestIds.add(ovdId);
      });

      const topMapped = uniqueSchemeIds.map((id) => incomeById.get(id)!);
      const commonOthers = incomeLedgers.filter(
        (l) =>
          !schemeIdSet.has(Number(l.ledgerID)) &&
          !otherSchemeInterestIds.has(Number(l.ledgerID))
      );

      return {
        visibleIncomeLedgers: [...topMapped, ...commonOthers],
        currentSchemeIncomeIdSet: schemeIdSet,
      };
    }

    const sharedFeeIds = new Set<number>();
    const allSchemeInterestIds = new Set<number>();
    loanRates.forEach((r) => {
      [r.recoveryFeeLedgerID, r.surchargeLedgerID, r.processingFeeLedgerID].forEach((id) => {
        const num = Number(id || 0);
        if (num > 0) sharedFeeIds.add(num);
      });
      [r.interestLedgerID, r.overdueInterestLedgerID].forEach((id) => {
        const num = Number(id || 0);
        if (num > 0) allSchemeInterestIds.add(num);
      });
    });

    const commonForAll = incomeLedgers.filter(
      (l) =>
        sharedFeeIds.has(Number(l.ledgerID)) ||
        !allSchemeInterestIds.has(Number(l.ledgerID))
    );

    return {
      visibleIncomeLedgers: commonForAll.length > 0 ? commonForAll : incomeLedgers,
      currentSchemeIncomeIdSet: sharedFeeIds,
    };
  }, [incomeLedgers, loanRates, schemeScope, selectedScheme]);

  // Auto-select the selected Loan Scheme's mapped Income ledger whenever scheme changes
  useEffect(() => {
    if (incomeLedgers.length === 0) return;

    const incomeIdSet = new Set(incomeLedgers.map((l) => Number(l.ledgerID)));

    if (schemeScope === 'SCHEME' && selectedScheme) {
      const preferredOrder = [
        Number(selectedScheme.recoveryFeeLedgerID || 0),
        Number(selectedScheme.surchargeLedgerID || 0),
        Number(selectedScheme.overdueInterestLedgerID || 0),
        Number(selectedScheme.interestLedgerID || 0),
        Number(selectedScheme.processingFeeLedgerID || 0),
      ];
      const matchedMappedId = preferredOrder.find((id) => id > 0 && incomeIdSet.has(id));
      if (matchedMappedId && matchedMappedId > 0) {
        setSelectedCreditLedgerId(matchedMappedId);
        return;
      }

      if (
        !selectedCreditLedgerId ||
        !visibleIncomeLedgers.some((l) => Number(l.ledgerID) === Number(selectedCreditLedgerId))
      ) {
        setSelectedCreditLedgerId(visibleIncomeLedgers[0]?.ledgerID || 0);
      }
      return;
    }

    if (schemeScope === 'ALL') {
      const firstMappedRecoveryFee = loanRates
        .map((r) => Number(r.recoveryFeeLedgerID || 0))
        .find((id) => id > 0 && incomeIdSet.has(id));

      if (
        !selectedCreditLedgerId ||
        !visibleIncomeLedgers.some((l) => Number(l.ledgerID) === Number(selectedCreditLedgerId))
      ) {
        setSelectedCreditLedgerId(
          firstMappedRecoveryFee || visibleIncomeLedgers[0]?.ledgerID || 0
        );
      }
    }
  }, [schemeScope, selectedLoanRateId, selectedScheme, incomeLedgers, loanRates, visibleIncomeLedgers]);

  const incomeLedgerOptions = useMemo(() => {
    return visibleIncomeLedgers.map((l) => {
      const isSchemeLedger = currentSchemeIncomeIdSet.has(Number(l.ledgerID));
      const schemeTag =
        schemeScope === 'SCHEME' && isSchemeLedger ? ' ★ [या कर्जाचे लेजर]' : '';
      return {
        value: l.ledgerID,
        label: `${l.ledgerName}${l.ledgerCode ? ` (${l.ledgerCode})` : ''}${schemeTag}${
          !schemeTag && l.groupName ? ` — [${l.groupName}]` : ''
        }`,
      };
    });
  }, [visibleIncomeLedgers, currentSchemeIncomeIdSet, schemeScope]);

  const selectedIncomeLedger = useMemo(
    () => incomeLedgers.find((l) => l.ledgerID === Number(selectedCreditLedgerId)),
    [incomeLedgers, selectedCreditLedgerId]
  );

  // Sync default charge amount across loaded rows when user edits "खर्च रक्कम"
  const handleDefaultAmountChange = (val: string) => {
    setDefaultChargeAmount(val);
    if (candidates.length > 0) {
      setRowAmounts((prev) => {
        const next: Record<number, string> = { ...prev };
        candidates.forEach((c) => {
          next[c.loanAccountID] = val;
        });
        return next;
      });
    }
  };

  const fetchOverdueCandidates = async (overrideMode?: OverdueFilterMode) => {
    const activeMode = overrideMode || overdueMode;
    setErrorMessage('');
    if (schemeScope === 'SCHEME' && (!selectedLoanRateId || selectedLoanRateId <= 0)) {
      setErrorMessage('कृपया कर्ज प्रकार निवडा किंवा "सर्व योजना" पर्याय निवडा.');
      return;
    }

    setLoadingCandidates(true);
    setHasSearched(true);
    setSingleLoanQuickPickId(0);
    try {
      const params = new URLSearchParams();
      params.set('branchId', String(branchId));
      params.set('asOnDate', chargeDate);
      params.set('overdueMode', activeMode);
      if (schemeScope === 'SCHEME' && selectedLoanRateId > 0) {
        params.set('loanRateId', String(selectedLoanRateId));
      }
      if (selectedCreditLedgerId > 0) {
        params.set('creditLedgerId', String(selectedCreditLedgerId));
      }

      const res = await axios.get(`/api/LegalRecovery/overdue-charge-candidates?${params.toString()}`);
      let rows: OverdueCandidateRow[] = Array.isArray(res.data) ? res.data : [];

      if (urlCustomerId > 0) {
        rows = rows.filter((r) => Number(r.customerID || 0) === urlCustomerId);
      }

      setCandidates(rows);

      const initAmounts: Record<number, string> = {};
      const initSelected = new Set<number>();
      const fallbackAmt = defaultChargeAmount.trim() || '0';

      rows.forEach((r) => {
        initAmounts[r.loanAccountID] = fallbackAmt;
        if (!r.alreadyChargedToday) {
          initSelected.add(r.loanAccountID);
        }
      });

      setRowAmounts(initAmounts);
      setSelectedLoanIds(initSelected);
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || 'थकबाकीदार कर्ज खाती लोड करताना त्रुटी आली.'
      );
      setCandidates([]);
      setSelectedLoanIds(new Set());
    } finally {
      setLoadingCandidates(false);
    }
  };

  // Quick single-account dropdown options from loaded overdue/installment candidates
  const quickPickLoanOptions = useMemo(() => {
    return candidates.map((r) => {
      const accDisplay = r.legacyAccountNumber
        ? `${r.legacyAccountNumber} (${r.loanAccountNo})`
        : r.loanAccountNo;
      const catLabel =
        r.overdueCategory === 'MATURITY_OVERDUE'
          ? 'मुदतबाह्य'
          : r.overdueCategory === 'INSTALLMENT_OVERDUE'
          ? `हप्ता थकीत (${r.overdueInstallmentsCount || 1})`
          : 'येणे बाकी';
      return {
        value: r.loanAccountID,
        label: `${accDisplay} — ${r.customerName} [${catLabel}: ₹${formatAmount(r.overdueAmount)}]`,
      };
    });
  }, [candidates]);

  const handleQuickPickSingleLoan = (loanId: number) => {
    setSingleLoanQuickPickId(loanId);
    if (loanId > 0) {
      setSelectedLoanIds(new Set([loanId]));
    }
  };

  const filteredCandidates = useMemo(() => {
    let base = candidates;
    if (singleLoanQuickPickId > 0) {
      base = base.filter((r) => r.loanAccountID === singleLoanQuickPickId);
    }
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((r) => {
      const legNo = (r.legacyAccountNumber || '').toLowerCase();
      const accNo = (r.loanAccountNo || '').toLowerCase();
      const name = (r.customerName || '').toLowerCase();
      const cif = (r.cifNo || '').toLowerCase();
      const legCust = (r.legacyCustomerNo || '').toLowerCase();
      return (
        legNo.includes(q) ||
        accNo.includes(q) ||
        name.includes(q) ||
        cif.includes(q) ||
        legCust.includes(q)
      );
    });
  }, [candidates, searchQuery, singleLoanQuickPickId]);

  const categoryCounts = useMemo(() => {
    let maturity = 0;
    let installment = 0;
    let dues = 0;
    candidates.forEach((r) => {
      if (r.overdueCategory === 'MATURITY_OVERDUE') maturity++;
      else if (r.overdueCategory === 'INSTALLMENT_OVERDUE') installment++;
      else dues++;
    });
    return { maturity, installment, dues };
  }, [candidates]);

  const allVisibleSelected = useMemo(() => {
    if (filteredCandidates.length === 0) return false;
    return filteredCandidates.every((r) => selectedLoanIds.has(r.loanAccountID));
  }, [filteredCandidates, selectedLoanIds]);

  const toggleSelectAllVisible = () => {
    setSelectedLoanIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        filteredCandidates.forEach((r) => next.delete(r.loanAccountID));
      } else {
        filteredCandidates.forEach((r) => next.add(r.loanAccountID));
      }
      return next;
    });
  };

  const toggleRowSelection = (loanAccountId: number) => {
    setSelectedLoanIds((prev) => {
      const next = new Set(prev);
      if (next.has(loanAccountId)) {
        next.delete(loanAccountId);
      } else {
        next.add(loanAccountId);
      }
      return next;
    });
  };

  const handleRowAmountChange = (loanAccountId: number, value: string) => {
    setRowAmounts((prev) => ({
      ...prev,
      [loanAccountId]: value,
    }));
  };

  const selectedSummary = useMemo(() => {
    let count = 0;
    let total = 0;
    candidates.forEach((c) => {
      if (selectedLoanIds.has(c.loanAccountID)) {
        count++;
        const amt = Math.round((Number(rowAmounts[c.loanAccountID]) || 0) * 100) / 100;
        if (amt > 0) total += amt;
      }
    });
    return {
      selectedCount: count,
      totalAmount: Math.round(total * 100) / 100,
    };
  }, [candidates, selectedLoanIds, rowAmounts]);

  const handleReset = () => {
    setErrorMessage('');
    setLastSavedResult(null);
    setSearchQuery('');
    setSingleLoanQuickPickId(0);
    setCandidates([]);
    setSelectedLoanIds(new Set());
    setRowAmounts({});
    setHasSearched(false);
    setDefaultChargeAmount('100');
    setChargeDate(defaultBizDate);
  };

  const handleSaveBulkCharges = async () => {
    setErrorMessage('');
    setLastSavedResult(null);

    if (!selectedCreditLedgerId || selectedCreditLedgerId <= 0) {
      setErrorMessage('कृपया जमेसाठी उत्पन्नाचे (Income) लेजर निवडा.');
      return;
    }

    const selectedItems = candidates
      .filter((c) => selectedLoanIds.has(c.loanAccountID))
      .map((c) => ({
        loanAccountId: c.loanAccountID,
        displayAccountNo: c.legacyAccountNumber || c.loanAccountNo,
        amount: Math.round((Number(rowAmounts[c.loanAccountID]) || 0) * 100) / 100,
      }));

    if (selectedItems.length === 0) {
      setErrorMessage('कृपया खर्च नावे टाकण्यासाठी किमान एक थकबाकीदार / हप्ता थकीत खातेदार निवडा.');
      return;
    }

    const invalidRow = selectedItems.find((i) => !i.amount || i.amount <= 0);
    if (invalidRow) {
      setErrorMessage(
        `निवडलेल्या कर्ज खाते क्र. '${invalidRow.displayAccountNo}' साठी वैध खर्च रक्कम (> ०) प्रविष्ट करा.`
      );
      return;
    }

    const totalSum = Math.round(selectedItems.reduce((s, x) => s + x.amount, 0) * 100) / 100;
    const ledgerTitle = selectedIncomeLedger?.ledgerName || `Ledger #${selectedCreditLedgerId}`;

    const confirmed = window.confirm(
      `खालील तपशिलाप्रमाणे निवडलेल्या कर्ज खात्यांवर खर्च नावे टाकायचा आहे का?\n\n` +
        `• दिनांक: ${formatDisplayDate(chargeDate)}\n` +
        `• जमा उत्पन्न लेजर (Cr): ${ledgerTitle}\n` +
        `• निवडलेले खातेदार: ${selectedItems.length}\n` +
        `• एकूण रक्कम: ₹${formatAmount(totalSum)}\n\n` +
        `(सेव्ह केल्यावर एकत्रित Journal व्हाउचर तयार होईल व पासिंगनंतर कर्जाच्या मुद्दलात रक्कम जमा होईल.)`
    );
    if (!confirmed) return;

    setSavingBatch(true);
    try {
      const payload = {
        branchId,
        expenseDate: chargeDate,
        creditLedgerId: selectedCreditLedgerId,
        expenseType: 'RECOVERY_EXPENSE',
        items: selectedItems.map((x) => ({
          loanAccountId: x.loanAccountId,
          amount: x.amount,
        })),
      };

      const res = await axios.post('/api/LegalRecovery/expense/bulk-add', payload);
      const data = res.data || {};
      setLastSavedResult({
        voucherId: Number(data.voucherId || 0),
        voucherNo: String(data.voucherNo || data.voucherNumber || ''),
        processedCount: Number(data.processedCount || selectedItems.length),
        totalAmount: Number(data.totalAmount || totalSum),
        incomeLedgerName: String(data.incomeLedgerName || ledgerTitle),
        message:
          data.message ||
          `एकूण ${selectedItems.length} खात्यांवर ₹${formatAmount(totalSum)} खर्च यशस्वीरीत्या नोंदवला गेला!`,
      });

      await fetchOverdueCandidates();
    } catch (err: any) {
      setErrorMessage(
        err.response?.data?.message || 'बल्क वसुली खर्च जतन करताना त्रुटी आली.'
      );
    } finally {
      setSavingBatch(false);
    }
  };

  const fetchSavedBatches = async () => {
    setLoadingBatches(true);
    try {
      const params = new URLSearchParams();
      params.set('branchId', String(branchId));
      if (batchFromDate) params.set('fromDate', batchFromDate);
      if (batchToDate) params.set('toDate', batchToDate);

      const res = await axios.get(`/api/LegalRecovery/bulk-charge-batches?${params.toString()}`);
      setBatches(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to load bulk charge batches', err);
      setBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  };

  const handleOpenBatchList = () => {
    setBatchFromDate(chargeDate);
    setBatchToDate(chargeDate);
    setShowBatchListModal(true);
    setTimeout(() => {
      fetchSavedBatches();
    }, 0);
  };

  const handleExportBatchesExcel = () => {
    if (batches.length === 0) {
      alert('एक्सेल एक्सपोर्ट करण्यासाठी कोणतीही नोंद उपलब्ध नाही.');
      return;
    }

    const excelRows: any[] = [];
    let sr = 1;
    batches.forEach((b) => {
      b.items.forEach((it) => {
        excelRows.push({
          'अ. नं.': sr++,
          'दिनांक': formatDisplayDate(b.expenseDate),
          'व्हाउचर क्र.': b.voucherNo,
          'व्हाउचर स्थिती': b.voucherStatus === 'Approved' ? 'मंजूर (Approved)' : 'प्रलंबित (Pending)',
          'जमा उत्पन्न लेजर': b.incomeLedgerName,
          'जुना कर्ज खाते नं.': it.legacyAccountNumber || '-',
          'कर्ज खाते नं.': it.loanAccountNo,
          'CIF क्र.': it.cifNo || '-',
          'कर्जदाराचे नाव': it.customerName,
          'कर्ज प्रकार': it.loanType,
          'रक्कम (₹)': it.amount,
        });
      });
    });

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'वसुली खर्च यादी');
    XLSX.writeFile(wb, `Vasuli_Kharch_Nave_${batchFromDate}_${batchToDate}.xlsx`);
  };

  const renderOverdueCategoryBadge = (row: OverdueCandidateRow) => {
    if (row.overdueCategory === 'MATURITY_OVERDUE' || row.isMaturityOverdue) {
      return (
        <span className="inline-block px-1.5 py-0.5 rounded-sm text-[10px] leading-none font-bold bg-rose-50 text-rose-800 border border-rose-200 whitespace-nowrap">
          मुदतबाह्य
        </span>
      );
    }
    if (row.overdueCategory === 'INSTALLMENT_OVERDUE' || row.isInstallmentOverdue) {
      return (
        <span className="inline-block px-1.5 py-0.5 rounded-sm text-[10px] leading-none font-bold bg-amber-50 text-amber-900 border border-amber-300 whitespace-nowrap">
          हप्ता थकीत ({row.overdueInstallmentsCount || 1})
        </span>
      );
    }
    return (
      <span className="inline-block px-1.5 py-0.5 rounded-sm text-[10px] leading-none font-bold bg-indigo-50 text-indigo-800 border border-indigo-200 whitespace-nowrap">
        येणे व्याज बाकी
      </span>
    );
  };

  const compactSelectTriggerClass =
    'w-full h-7 border border-slate-300 px-2 rounded-sm flex justify-between items-center bg-white cursor-pointer hover:border-primary/60 text-[11px] font-semibold text-slate-900';

  return (
    <div className="p-1.5 sm:p-2 max-w-[1560px] mx-auto font-sans text-xs text-slate-800 flex flex-col h-[calc(100vh-3.15rem)] gap-1.5 bg-slate-50/60 overflow-hidden">
      {/* 1. Ultra-Compact Combined ERP Header + Filter Toolbar Card */}
      <div className="bg-white rounded-sm shadow-xs border border-slate-300 border-t-2 border-t-primary shrink-0">
        {/* Top Strip: Title + Live Dr->Cr Mapping + Overdue Mode Pills + Branch + Back */}
        <div className="px-2.5 py-1 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-sm bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                <Coins size={12} className="stroke-[2.4]" />
              </div>
              <h1 className="text-xs sm:text-sm font-extrabold text-primary tracking-tight whitespace-nowrap">
                वसुली खर्च नावे
              </h1>
            </div>

            <span className="hidden xl:inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm bg-primary/5 border border-primary/20 text-[10px] text-slate-700 whitespace-nowrap">
              <span>
                Dr:{' '}
                <strong className="text-slate-900">
                  {schemeScope === 'SCHEME'
                    ? selectedLoanPrincipalLedgerName || getSchemeDisplayName(selectedScheme) || '-'
                    : 'कर्ज योजनानिहाय मुद्दल लेजर'}
                </strong>
              </span>
              <span className="text-primary font-bold">➔</span>
              <span>
                Cr:{' '}
                <strong className="text-primary">
                  {selectedIncomeLedger?.ledgerName || 'लेजर निवडा'}
                </strong>
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {/* 2 Compact Overdue Mode Buttons */}
            <div className="flex items-center gap-1">
              <span className="text-[10px] font-bold text-slate-600 hidden sm:inline">थकबाकी:</span>
              <button
                type="button"
                onClick={() => {
                  setOverdueMode('MATURITY_ONLY');
                  setCandidates([]);
                  setSelectedLoanIds(new Set());
                  setHasSearched(false);
                }}
                className={`h-6 px-2 rounded-sm text-[11px] font-bold border transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  overdueMode === 'MATURITY_ONLY'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-primary/40 hover:bg-primary/5'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    overdueMode === 'MATURITY_ONLY' ? 'bg-white' : 'bg-slate-400'
                  }`}
                />
                <span>१) मुदतबाह्य थकबाकीदार</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setOverdueMode('ALL_OVERDUE');
                  setCandidates([]);
                  setSelectedLoanIds(new Set());
                  setHasSearched(false);
                }}
                className={`h-6 px-2 rounded-sm text-[11px] font-bold border transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                  overdueMode === 'ALL_OVERDUE'
                    ? 'bg-primary text-white border-primary'
                    : 'bg-white text-slate-700 border-slate-300 hover:border-primary/40 hover:bg-primary/5'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    overdueMode === 'ALL_OVERDUE' ? 'bg-white' : 'bg-slate-400'
                  }`}
                />
                <span>२) येणे बाकी / हप्ता थकीत व थकबाकीदार एकत्रित</span>
              </button>
            </div>

            <div className="h-4 w-px bg-slate-300 hidden sm:block" />

            {/* Compact Branch Selector */}
            <div className="flex items-center gap-1 bg-white px-1.5 h-6 rounded-sm border border-slate-300">
              <Building2 size={11} className="text-primary shrink-0" />
              <select
                value={branchId}
                disabled={!isHOUser}
                onChange={(e) => {
                  setBranchId(Number(e.target.value));
                  setCandidates([]);
                  setSelectedLoanIds(new Set());
                  setHasSearched(false);
                }}
                className="h-5 text-[11px] font-bold bg-transparent text-slate-900 focus:outline-none disabled:text-slate-600"
              >
                {branchOptions.map((b) => (
                  <option key={b.branchID} value={b.branchID}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('loan')}
                className="h-6 px-2 rounded-sm border border-slate-300 bg-white hover:bg-primary/5 hover:text-primary hover:border-primary/40 text-slate-700 font-bold text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
                title="कर्ज विभाग मुख्य डॅशबोर्डवर परत जा"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>मागे</span>
              </button>
            )}
          </div>
        </div>

        {/* Single Compact Inline Filter Row (28px controls, horizontal labels — minimal vertical space) */}
        <div className="px-2.5 py-1.5 flex flex-wrap lg:flex-nowrap items-center gap-2">
          {/* सर्व / कर्ज प्रकार */}
          <div className="flex items-center gap-1.5 shrink-0">
            <label className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 cursor-pointer select-none whitespace-nowrap">
              <input
                type="radio"
                name="loanSchemeScope"
                checked={schemeScope === 'ALL'}
                onChange={() => {
                  setSchemeScope('ALL');
                  setCandidates([]);
                  setSelectedLoanIds(new Set());
                  setHasSearched(false);
                }}
                className="w-3.5 h-3.5 accent-primary cursor-pointer"
              />
              <span>सर्व</span>
            </label>

            <label className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-800 cursor-pointer select-none whitespace-nowrap">
              <input
                type="radio"
                name="loanSchemeScope"
                checked={schemeScope === 'SCHEME'}
                onChange={() => {
                  setSchemeScope('SCHEME');
                  setCandidates([]);
                  setSelectedLoanIds(new Set());
                  setHasSearched(false);
                }}
                className="w-3.5 h-3.5 accent-primary cursor-pointer"
              />
              <span>कर्ज प्रकार</span>
            </label>

            <select
              value={schemeScope === 'SCHEME' ? selectedLoanRateId : ''}
              disabled={schemeScope === 'ALL'}
              onChange={(e) => {
                setSelectedLoanRateId(Number(e.target.value) || 0);
                setCandidates([]);
                setSelectedLoanIds(new Set());
                setHasSearched(false);
              }}
              className="h-7 w-40 border border-slate-300 rounded-sm px-1.5 text-[11px] font-bold bg-white text-slate-900 focus:outline-none focus:border-primary disabled:bg-slate-100 disabled:text-slate-400"
            >
              {schemeScope === 'ALL' ? (
                <option value="">-- सर्व योजना --</option>
              ) : loanRates.length === 0 ? (
                <option value={0}>-- लोड होत आहे --</option>
              ) : (
                loanRates.map((lr) => (
                  <option key={lr.loanRateID} value={lr.loanRateID}>
                    {getSchemeDisplayName(lr)}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* लेजर (Dynamic Income Ledger) */}
          <div className="flex items-center gap-1 flex-1 min-w-[210px]">
            <label className="text-[11px] font-bold text-slate-700 whitespace-nowrap shrink-0">
              लेजर<span className="text-rose-600">*</span>:
            </label>
            <div className="flex-1 min-w-0">
              <SearchableSelect
                id="bulk-loan-charge-income-ledger"
                options={incomeLedgerOptions}
                value={selectedCreditLedgerId || ''}
                onChange={(e) => setSelectedCreditLedgerId(Number(e.target.value) || 0)}
                placeholder="-- जमा उत्पन्न लेजर निवडा --"
                searchPlaceholder="उत्पन्न लेजर नाव / कोड शोधा..."
                minMenuWidth={350}
                className={compactSelectTriggerClass}
              />
            </div>
          </div>

          {/* खर्च रक्कम */}
          <div className="flex items-center gap-1 shrink-0">
            <label className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
              रक्कम:
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={defaultChargeAmount}
              onChange={(e) => handleDefaultAmountChange(e.target.value)}
              placeholder="100"
              className="h-7 w-20 border border-slate-300 rounded-sm px-2 text-[11px] font-mono font-black text-right bg-white text-primary focus:outline-none focus:border-primary"
            />
          </div>

          {/* दिनांक */}
          <div className="flex items-center gap-1 shrink-0">
            <label className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
              दिनांक:
            </label>
            <input
              type="date"
              value={chargeDate}
              onChange={(e) => setChargeDate(e.target.value)}
              className="h-7 w-[124px] border border-slate-300 rounded-sm px-1.5 text-[11px] font-mono font-bold bg-white text-slate-900 focus:outline-none focus:border-primary"
            />
          </div>

          {/* पहा Button */}
          <button
            type="button"
            onClick={() => fetchOverdueCandidates()}
            disabled={loadingCandidates}
            className="h-7 px-3.5 bg-primary hover:opacity-90 text-white font-extrabold text-[11px] rounded-sm shadow-2xs transition flex items-center gap-1 shrink-0 cursor-pointer disabled:opacity-50"
          >
            {loadingCandidates ? (
              <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
            ) : (
              <Search className="w-3 h-3 shrink-0" />
            )}
            <span>पहा</span>
          </button>

          {/* थेट कर्ज खाते निवडा / शोधा */}
          <div className="flex items-center gap-1 w-full sm:w-56 shrink-0">
            <label className="text-[11px] font-bold text-primary whitespace-nowrap shrink-0">
              शोधा:
            </label>
            <div className="flex-1 min-w-0">
              {candidates.length > 0 && !searchQuery ? (
                <SearchableSelect
                  id="bulk-loan-single-account-picker"
                  options={[
                    { value: 0, label: `-- सर्व खाती (${candidates.length}) --` },
                    ...quickPickLoanOptions,
                  ]}
                  value={singleLoanQuickPickId || 0}
                  onChange={(e) => handleQuickPickSingleLoan(Number(e.target.value) || 0)}
                  placeholder="खाते नं / नाव निवडा..."
                  searchPlaceholder="जुना क्र., खाते नं., नाव किंवा CIF शोधा..."
                  minMenuWidth={380}
                  className={compactSelectTriggerClass}
                />
              ) : (
                <div className="relative">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="जुना क्र. / नाव / CIF..."
                    className="h-7 w-full border border-slate-300 rounded-sm pl-2 pr-6 text-[11px] bg-white text-slate-900 focus:outline-none focus:border-primary"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-1.5 top-1.5 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <Search className="w-3 h-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Slim Error Alert */}
      {errorMessage && (
        <div className="bg-rose-50 border border-rose-300 text-rose-800 px-2.5 py-1 rounded-sm flex items-center justify-between gap-2 text-[11px] font-bold shrink-0">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage('')}
            className="text-rose-600 hover:text-rose-900 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Slim Saved Voucher Confirmation Strip */}
      {lastSavedResult && (
        <div className="bg-emerald-50 border border-emerald-300 text-emerald-950 px-2.5 py-1 rounded-sm flex flex-wrap items-center justify-between gap-2 text-[11px] shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="font-bold">{lastSavedResult.message}</span>
            <span className="text-emerald-800">
              (व्हाउचर: <strong className="font-mono">{lastSavedResult.voucherNo}</strong> • लेजर:{' '}
              <strong>{lastSavedResult.incomeLedgerName}</strong> • खाती:{' '}
              <strong>{lastSavedResult.processedCount}</strong> • एकूण:{' '}
              <strong className="font-mono">₹{formatAmount(lastSavedResult.totalAmount)}</strong>)
            </span>
          </div>

          {onNavigate && lastSavedResult.voucherId > 0 && (
            <button
              type="button"
              onClick={() =>
                onNavigate('voucher-posting', { voucherId: lastSavedResult.voucherId })
              }
              className="h-6 px-2.5 bg-primary hover:opacity-90 text-white font-bold text-[11px] rounded-sm flex items-center gap-1 cursor-pointer"
            >
              <ExternalLink className="w-3 h-3" />
              <span>व्हाउचर पासिंग उघडा</span>
            </button>
          )}
        </div>
      )}

      {/* 2. Full-Height Dense Single-Line Borrowers Table Card (flex-1 min-h-0 fills remaining screen) */}
      <div className="flex-1 min-h-0 flex flex-col bg-white border border-slate-300 border-t-2 border-t-primary rounded-sm shadow-xs overflow-hidden">
        {/* Compact Table Toolbar Strip */}
        <div className="px-2.5 py-1 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-1.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-800">
              २. पात्र कर्जदारांची यादी — ज्या खात्यांवर खर्च नावे टाकायचा आहे ती टिक (✓) करा
            </span>
            {singleLoanQuickPickId > 0 && (
              <button
                type="button"
                onClick={() => setSingleLoanQuickPickId(0)}
                className="px-1.5 py-0.5 rounded-sm bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold hover:bg-rose-100 cursor-pointer"
              >
                ✕ सर्व लोड केलेली खाती दाखवा ({candidates.length})
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {candidates.length > 0 && (
              <>
                <span className="px-1.5 py-0.5 rounded-sm bg-rose-50 text-rose-800 border border-rose-200 font-bold text-[10px] leading-none">
                  मुदतबाह्य: {categoryCounts.maturity}
                </span>
                {overdueMode === 'ALL_OVERDUE' && (
                  <>
                    <span className="px-1.5 py-0.5 rounded-sm bg-amber-50 text-amber-900 border border-amber-300 font-bold text-[10px] leading-none">
                      हप्ता थकीत: {categoryCounts.installment}
                    </span>
                    {categoryCounts.dues > 0 && (
                      <span className="px-1.5 py-0.5 rounded-sm bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold text-[10px] leading-none">
                        येणे व्याज: {categoryCounts.dues}
                      </span>
                    )}
                  </>
                )}

                <div className="relative w-44">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="टेबल फिल्टर (नाव / क्र.)..."
                    className="h-6 w-full border border-slate-300 rounded-sm pl-2 pr-5 text-[11px] bg-white focus:outline-none focus:border-primary"
                  />
                  {searchQuery ? (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="absolute right-1 top-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  ) : (
                    <Search className="w-3 h-3 text-slate-400 absolute right-1.5 top-1.5 pointer-events-none" />
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (selectedLoanIds.size > 0) {
                      setSelectedLoanIds(new Set());
                    } else {
                      setSelectedLoanIds(new Set(filteredCandidates.map((r) => r.loanAccountID)));
                    }
                  }}
                  className="h-6 px-2 rounded-sm bg-white hover:bg-primary/10 text-primary border border-primary/30 font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  {selectedLoanIds.size > 0 ? (
                    <>
                      <Square className="w-3 h-3" />
                      <span>निवड साफ करा</span>
                    </>
                  ) : (
                    <>
                      <CheckSquare className="w-3 h-3" />
                      <span>सर्व निवडा</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Scrollable Dense Grid Container */}
        <div className="flex-1 min-h-0 overflow-auto slim-scrollbar">
          <table className="min-w-full border-collapse text-[11px] leading-tight">
            <thead className="bg-slate-100 text-slate-800 sticky top-0 z-10 border-b-2 border-primary/30 font-bold whitespace-nowrap">
              <tr>
                <th className="w-8 px-1.5 py-1.5 border-r border-slate-200 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAllVisible}
                    disabled={filteredCandidates.length === 0}
                    className="w-3.5 h-3.5 accent-primary cursor-pointer align-middle"
                    title="सर्व दिसणारी खाती निवडा / निवड काढा"
                  />
                </th>
                <th className="w-9 px-1.5 py-1.5 border-r border-slate-200 text-center">अ.नं.</th>
                <th className="w-14 px-1.5 py-1.5 border-r border-slate-200 text-center">जुना नं.</th>
                <th className="w-28 px-1.5 py-1.5 border-r border-slate-200 text-center">
                  कर्ज खाते नं.
                </th>
                <th className="w-20 px-1.5 py-1.5 border-r border-slate-200 text-center">CIF नं.</th>
                <th className="px-2 py-1.5 border-r border-slate-200 text-left min-w-[170px]">
                  कर्जदाराचे नाव
                </th>
                <th className="w-32 px-1.5 py-1.5 border-r border-slate-200 text-left">
                  कर्ज प्रकार
                </th>
                <th className="w-28 px-1.5 py-1.5 border-r border-slate-200 text-center">
                  थकबाकी स्थिती
                </th>
                <th className="w-20 px-1.5 py-1.5 border-r border-slate-200 text-center">
                  कर्ज दि.
                </th>
                <th className="w-20 px-1.5 py-1.5 border-r border-slate-200 text-center">
                  थकबाकी दि.
                </th>
                <th className="w-24 px-1.5 py-1.5 border-r border-slate-200 text-right">
                  चालू मुद्दल
                </th>
                <th className="w-20 px-1.5 py-1.5 border-r border-slate-200 text-right">
                  येणे व्याज
                </th>
                <th className="w-24 px-1.5 py-1.5 border-r border-slate-200 text-right">
                  थकबाकी रक्कम
                </th>
                <th className="w-22 px-1.5 py-1.5 text-right">नावे रक्कम (₹)</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-200 bg-white">
              {loadingCandidates ? (
                <tr>
                  <td colSpan={14} className="px-4 py-16 text-center text-slate-500 font-bold">
                    <div className="inline-flex items-center gap-2">
                      <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                      <span>थकबाकीदार व हप्ता-थकीत कर्ज खाती लोड होत आहेत...</span>
                    </div>
                  </td>
                </tr>
              ) : !hasSearched ? (
                <tr>
                  <td colSpan={14} className="px-4 py-16 text-center text-slate-500">
                    <Coins className="w-7 h-7 text-primary/40 mx-auto mb-1" />
                    <div className="font-bold text-slate-700 text-xs mb-0.5">
                      वर थकबाकी पर्याय व कर्ज प्रकार निवडून &quot;पहा&quot; बटणावर क्लिक करा
                    </div>
                    <div className="text-[11px] text-slate-500">
                      पर्याय १ मध्ये फक्त मुदतबाह्य थकबाकीदार कर्जे, तर पर्याय २ मध्ये हप्ता थकीत,
                      येणे बाकी व मुदतबाह्य अशी सर्व पात्र खाती एकत्रित दिसतात.
                    </div>
                  </td>
                </tr>
              ) : filteredCandidates.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-16 text-center text-slate-500 font-bold">
                    निवडलेल्या निकषांनुसार कोणतेही पात्र थकबाकीदार / हप्ता-थकीत कर्ज खाते आढळले नाही.
                  </td>
                </tr>
              ) : (
                filteredCandidates.map((row, idx) => {
                  const isChecked = selectedLoanIds.has(row.loanAccountID);
                  const rowAmtVal = rowAmounts[row.loanAccountID] ?? defaultChargeAmount;
                  const bookedInterestSum =
                    Number(row.interestBalance || 0) + Number(row.overdueInterestBalance || 0);

                  return (
                    <tr
                      key={row.loanAccountID}
                      onClick={() => toggleRowSelection(row.loanAccountID)}
                      className={`h-7 transition-colors cursor-pointer whitespace-nowrap ${
                        isChecked
                          ? 'bg-primary/5 hover:bg-primary/10'
                          : 'hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <td
                        className="px-1.5 py-0.5 border-r border-slate-200 text-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleRowSelection(row.loanAccountID)}
                          className="w-3.5 h-3.5 accent-primary cursor-pointer align-middle"
                        />
                      </td>

                      <td className="px-1.5 py-0.5 border-r border-slate-200 text-center font-mono text-slate-600">
                        {idx + 1}
                      </td>

                      <td className="px-1.5 py-0.5 border-r border-slate-200 text-center font-mono font-black text-primary">
                        {row.legacyAccountNumber || '-'}
                      </td>

                      <td className="px-1.5 py-0.5 border-r border-slate-200 text-center font-mono text-slate-800">
                        {row.loanAccountNo}
                      </td>

                      <td className="px-1.5 py-0.5 border-r border-slate-200 text-center font-mono text-slate-600">
                        {row.cifNo || '-'}
                      </td>

                      <td
                        className="px-2 py-0.5 border-r border-slate-200 text-left max-w-[240px] truncate"
                        title={row.customerName || ''}
                      >
                        <span className="font-bold text-slate-900">{row.customerName || '-'}</span>
                        {row.alreadyChargedToday && (
                          <span
                            className="ml-1.5 px-1 py-0.2 rounded-sm text-[9px] font-bold bg-amber-100 text-amber-950 border border-amber-400"
                            title={`आज आधीच नोंद — व्हाउचर क्र.: ${row.alreadyChargedVoucherNo || '-'}`}
                          >
                            आज: ₹{formatAmount(row.alreadyChargedAmount)}
                          </span>
                        )}
                      </td>

                      <td
                        className="px-1.5 py-0.5 border-r border-slate-200 text-left max-w-[140px] truncate font-medium text-slate-800"
                        title={row.loanType}
                      >
                        {row.loanType}
                      </td>

                      <td className="px-1.5 py-0.5 border-r border-slate-200 text-center">
                        {renderOverdueCategoryBadge(row)}
                      </td>

                      <td className="px-1.5 py-0.5 border-r border-slate-200 text-center font-mono text-slate-700">
                        {formatDisplayDate(row.loanDate)}
                      </td>

                      <td className="px-1.5 py-0.5 border-r border-slate-200 text-center font-mono font-bold text-rose-700">
                        {formatDisplayDate(row.overdueDate || row.maturityDate)}
                      </td>

                      <td className="px-1.5 py-0.5 border-r border-slate-200 text-right font-mono text-slate-700">
                        {formatAmount(row.principalBalance)}
                      </td>

                      <td className="px-1.5 py-0.5 border-r border-slate-200 text-right font-mono text-amber-800 font-semibold">
                        {bookedInterestSum > 0.009 ? formatAmount(bookedInterestSum) : '0.00'}
                      </td>

                      <td className="px-1.5 py-0.5 border-r border-slate-200 text-right font-mono font-bold text-slate-900">
                        {formatAmount(row.overdueAmount)}
                      </td>

                      <td
                        className="px-1.5 py-0.5 text-right"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={rowAmtVal}
                          onChange={(e) =>
                            handleRowAmountChange(row.loanAccountID, e.target.value)
                          }
                          className={`w-20 h-6 px-1.5 text-right text-[11px] font-mono font-black border rounded-sm focus:outline-none focus:border-primary ${
                            isChecked
                              ? 'bg-white border-primary/40 text-primary'
                              : 'bg-slate-100 border-slate-200 text-slate-400'
                          }`}
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 3. Compact Sticky CBS Bottom Summary & Action Bar */}
      <div className="bg-white border border-slate-300 border-t-2 border-t-primary rounded-sm shadow-xs px-3 py-1.5 flex flex-wrap items-center justify-between gap-2 shrink-0">
        {/* Left KPI Pills */}
        <div className="flex items-center gap-2 text-[11px] font-extrabold text-slate-800">
          <div className="px-2 py-0.5 rounded-sm bg-slate-100 border border-slate-200">
            एकूण खातेदार:{' '}
            <span className="text-slate-950 font-mono">{filteredCandidates.length}</span>
          </div>
          <div className="px-2 py-0.5 rounded-sm bg-primary/10 border border-primary/25 text-primary">
            निवडलेले खातेदार:{' '}
            <span className="font-mono font-black">{selectedSummary.selectedCount}</span>
          </div>
        </div>

        {/* Center ERP Action Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleReset}
            disabled={savingBatch}
            className="h-7 px-3.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-bold text-[11px] rounded-sm transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            <RotateCcw className="w-3 h-3" />
            <span>नविन</span>
          </button>

          <button
            type="button"
            onClick={handleSaveBulkCharges}
            disabled={savingBatch || selectedSummary.selectedCount === 0}
            className="h-7 px-4 bg-primary hover:opacity-90 text-white font-extrabold text-[11px] rounded-sm shadow-2xs transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
          >
            {savingBatch ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}
            <span>जतन करा</span>
          </button>

          <button
            type="button"
            onClick={handleOpenBatchList}
            className="h-7 px-3.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 font-bold text-[11px] rounded-sm transition flex items-center gap-1 cursor-pointer"
          >
            <FileText className="w-3 h-3" />
            <span>यादी पहा</span>
          </button>

          <button
            type="button"
            onClick={() => (onNavigate ? onNavigate('loan') : window.history.back())}
            className="h-7 px-3.5 bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 font-bold text-[11px] rounded-sm transition cursor-pointer"
          >
            बाहेर
          </button>
        </div>

        {/* Right Total Selected Amount */}
        <div className="px-2.5 py-0.5 rounded-sm bg-primary/10 border border-primary/25 text-xs font-extrabold text-slate-900">
          एकूण रक्कम:{' '}
          <span className="text-primary font-mono text-sm font-black">
            ₹{formatAmount(selectedSummary.totalAmount)}
          </span>
        </div>
      </div>

      {/* 'यादी पहा' — Saved Bulk Charge Batches Modal */}
      {showBatchListModal && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 print:static print:bg-transparent print:p-0">
          <div className="bg-white rounded-sm border-t-4 border-t-primary w-full max-w-5xl max-h-[90vh] shadow-2xl flex flex-col overflow-hidden print:max-h-none print:shadow-none print:border-none">
            <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between print:hidden">
              <div className="font-bold text-sm text-primary flex items-center gap-2">
                <FileText className="w-4 h-4" />
                <span>वसुली खर्च नावे — जतन केलेल्या नोंदींची यादी (Saved Charge Batches)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchListModal(false)}
                className="p-1 rounded-sm hover:bg-slate-200 text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Bar */}
            <div className="px-4 py-2 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 print:hidden">
              <div className="flex flex-wrap items-center gap-2">
                <label className="font-bold text-slate-700">दिनांक पासून:</label>
                <input
                  type="date"
                  value={batchFromDate}
                  onChange={(e) => setBatchFromDate(e.target.value)}
                  className="h-7 border border-slate-300 rounded-sm px-2 text-xs font-mono"
                />
                <label className="font-bold text-slate-700">पर्यंत:</label>
                <input
                  type="date"
                  value={batchToDate}
                  onChange={(e) => setBatchToDate(e.target.value)}
                  className="h-7 border border-slate-300 rounded-sm px-2 text-xs font-mono"
                />
                <button
                  type="button"
                  onClick={fetchSavedBatches}
                  disabled={loadingBatches}
                  className="h-7 px-3 bg-primary hover:opacity-90 text-white font-bold rounded-sm flex items-center gap-1 cursor-pointer"
                >
                  {loadingBatches ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Search className="w-3.5 h-3.5" />
                  )}
                  <span>पहा</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportBatchesExcel}
                  disabled={batches.length === 0}
                  className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-sm flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  <span>एक्सेल</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  disabled={batches.length === 0}
                  className="h-7 px-2.5 bg-slate-800 hover:bg-slate-900 text-white font-bold rounded-sm flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>प्रिंट</span>
                </button>
              </div>
            </div>

            {/* Batches Table */}
            <div className="p-3 overflow-y-auto flex-1">
              {loadingBatches ? (
                <div className="py-12 text-center text-slate-500 font-bold">
                  यादी लोड होत आहे...
                </div>
              ) : batches.length === 0 ? (
                <div className="py-12 text-center text-slate-500 font-bold">
                  निवडलेल्या कालावधीत कोणतीही वसुली खर्च नावे नोंद सापडली नाही.
                </div>
              ) : (
                <table className="min-w-full border border-slate-300 border-collapse text-xs">
                  <thead className="bg-slate-100 font-bold text-slate-800">
                    <tr>
                      <th className="px-2 py-2 border border-slate-300 w-10"></th>
                      <th className="px-2.5 py-2 border border-slate-300 text-left">दिनांक</th>
                      <th className="px-2.5 py-2 border border-slate-300 text-left">व्हाउचर क्र.</th>
                      <th className="px-2.5 py-2 border border-slate-300 text-left">
                        जमा उत्पन्न लेजर (Cr)
                      </th>
                      <th className="px-2.5 py-2 border border-slate-300 text-center">खातेदार</th>
                      <th className="px-2.5 py-2 border border-slate-300 text-right">एकूण रक्कम</th>
                      <th className="px-2.5 py-2 border border-slate-300 text-center">स्थिती</th>
                      <th className="px-2.5 py-2 border border-slate-300 text-center print:hidden">
                        कृती
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {batches.map((b) => {
                      const isOpen = expandedBatchVoucherId === b.voucherId;
                      const isApproved =
                        (b.voucherStatus || '').toLowerCase() === 'approved';
                      return (
                        <React.Fragment key={b.voucherId}>
                          <tr
                            onClick={() =>
                              setExpandedBatchVoucherId(isOpen ? null : b.voucherId)
                            }
                            className="hover:bg-slate-50 cursor-pointer border-b border-slate-200"
                          >
                            <td className="px-2 py-1.5 border border-slate-200 text-center">
                              {isOpen ? (
                                <ChevronDown className="w-3.5 h-3.5 inline text-primary" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 inline text-slate-500" />
                              )}
                            </td>
                            <td className="px-2.5 py-1.5 border border-slate-200 font-mono">
                              {formatDisplayDate(b.expenseDate)}
                            </td>
                            <td className="px-2.5 py-1.5 border border-slate-200 font-mono font-bold text-slate-900">
                              {b.voucherNo}
                            </td>
                            <td className="px-2.5 py-1.5 border border-slate-200 font-bold text-slate-800">
                              {b.incomeLedgerName || '-'}
                            </td>
                            <td className="px-2.5 py-1.5 border border-slate-200 text-center font-mono font-bold">
                              {b.accountCount}
                            </td>
                            <td className="px-2.5 py-1.5 border border-slate-200 text-right font-mono font-black text-primary">
                              ₹{formatAmount(b.totalAmount)}
                            </td>
                            <td className="px-2.5 py-1.5 border border-slate-200 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-sm text-[10px] font-bold border ${
                                  isApproved
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                    : 'bg-amber-50 text-amber-800 border-amber-300'
                                }`}
                              >
                                {isApproved ? 'मंजूर (Posted)' : 'प्रलंबित (Pending)'}
                              </span>
                            </td>
                            <td
                              className="px-2.5 py-1.5 border border-slate-200 text-center print:hidden"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {!isApproved && onNavigate && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShowBatchListModal(false);
                                    onNavigate('voucher-posting', { voucherId: b.voucherId });
                                  }}
                                  className="px-2 py-0.5 bg-primary text-white text-[10px] font-bold rounded-sm hover:opacity-90 cursor-pointer"
                                >
                                  पास करा
                                </button>
                              )}
                            </td>
                          </tr>

                          {isOpen && (
                            <tr className="bg-slate-50/90">
                              <td colSpan={8} className="p-2.5 border border-slate-300">
                                <table className="min-w-full border border-slate-200 bg-white text-[11px]">
                                  <thead className="bg-slate-100 font-bold">
                                    <tr>
                                      <th className="px-2 py-1 border text-center w-12">अ. नं.</th>
                                      <th className="px-2 py-1 border text-center">कर्ज खाते नं.</th>
                                      <th className="px-2 py-1 border text-left">कर्जदाराचे नाव</th>
                                      <th className="px-2 py-1 border text-center">CIF क्र.</th>
                                      <th className="px-2 py-1 border text-center">कर्ज प्रकार</th>
                                      <th className="px-2 py-1 border text-right">नावे रक्कम (₹)</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {b.items.map((it, i) => (
                                      <tr key={it.expenseId}>
                                        <td className="px-2 py-1 border text-center font-mono">
                                          {i + 1}
                                        </td>
                                        <td className="px-2 py-1 border text-center font-mono font-bold text-primary">
                                          {it.legacyAccountNumber
                                            ? `${it.legacyAccountNumber} (${it.loanAccountNo})`
                                            : it.loanAccountNo}
                                        </td>
                                        <td className="px-2 py-1 border font-semibold">
                                          {it.customerName || '-'}
                                        </td>
                                        <td className="px-2 py-1 border text-center font-mono">
                                          {it.cifNo || '-'}
                                        </td>
                                        <td className="px-2 py-1 border text-center">
                                          {it.loanType}
                                        </td>
                                        <td className="px-2 py-1 border text-right font-mono font-bold">
                                          ₹{formatAmount(it.amount)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
