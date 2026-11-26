import React, { useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import {
  Search,
  RefreshCw,
  CheckCircle2,
  FileText,
  Printer,
  FileSpreadsheet,
  Upload,
  Download,
  ArrowLeft,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  X,
  AlertCircle,
  Wallet,
  Building2,
} from 'lucide-react';
import SearchableSelect, { convertMarathiDigits } from './SearchableSelect';
import { useAuth } from '../context/AuthContext';
import { getBusinessDateStr } from '../utils/businessDateUtils';
import { getCachedMasterArray, invalidateApiCache } from '../utils/apiCache';
import { getLockedBranchId, isHeadOfficeUser, resolveWriteBranchId } from '../utils/branchAccess';

export interface SavingBulkTransferMasterProps {
  onNavigate?: (tab: string, params?: any) => void;
}

interface BranchItem {
  branchID: number;
  branchCode?: string;
  branchName: string;
}

interface SavingSchemeLedgerOption {
  optionKey: string;
  ledgerID: number;
  ledgerName: string;
  ledgerCode?: string;
  schemeID?: number | null;
  schemeName: string;
  displayLabel: string;
  interestRate?: number;
  minimumBalance?: number;
  accountCount: number;
}

interface DynamicLedgerOption {
  ledgerID: number;
  ledgerName: string;
  ledgerCode?: string;
  groupName?: string;
}

interface BulkSavingAccountRow {
  savingAccountID: number;
  branchID: number;
  accountNo: string;
  oldAccountNo: string;
  customerID: number;
  cifNo: string;
  legacyCustomerNo?: string;
  customerName: string;
  mobileNo?: string;
  ledgerID: number;
  ledgerName: string;
  savingSchemeID?: number | null;
  schemeName: string;
  openingDate: string;
  currentBalance: number;
  availableBalance: number;
  minimumBalance: number;
  lienAmount: number;
  status: string;
  matchedTargetSavingAccountID?: number | null;
  matchedTargetAccountNo?: string;
  matchedTargetOldAccountNo?: string;
  matchedTargetCurrentBalance?: number;
}

interface ContraSavingAccountSummary {
  savingAccountID: number;
  branchID: number;
  accountNo: string;
  oldAccountNo?: string;
  legacyAccountNumber?: string;
  customerID: number;
  ledgerID: number;
  currentBalance: number;
  minimumBalance?: number;
  lienAmount?: number;
  status: string;
  customer?: {
    customerID: number;
    cifNo?: string;
    legacyCustomerNo?: string;
    firstName?: string;
    middleName?: string;
    lastName?: string;
  };
  ledger?: {
    ledgerID: number;
    ledgerName?: string;
  };
  savingScheme?: {
    settingID: number;
    schemeName?: string;
    minimumBalance?: number;
  };
}

interface BulkBatchLineItem {
  savingAccountId: number;
  accountNo: string;
  oldAccountNo: string;
  cifNo: string;
  customerName: string;
  ledgerName: string;
  drCr: string;
  amount: number;
}

interface BulkTransferBatchRow {
  voucherId: number;
  voucherNo: string;
  voucherDate: string;
  status: string;
  totalAmount: number;
  narration?: string;
  savingLineCount: number;
  contraLedgerNames?: string;
  items: BulkBatchLineItem[];
}

type DirectionMode = 'CREDIT' | 'DEBIT';
type ContraTransferUiMode = 'BANK' | 'LEDGER_OR_CIF' | 'SCHEME_TO_SCHEME';
type LedgerSubMode = 'SAVING_ACCOUNT' | 'GL_LEDGER';

const fmtMoney = (val: number | undefined | null) =>
  Number(val || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const fmtDate = (iso?: string | null) => {
  if (!iso) return '-';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const normalizeMatchToken = (raw: any): string => {
  if (raw === null || raw === undefined) return '';
  return convertMarathiDigits(String(raw)).trim().toUpperCase();
};

const SavingBulkTransferMaster: React.FC<SavingBulkTransferMasterProps> = ({ onNavigate }) => {
  const { user } = useAuth();
  const isHo = isHeadOfficeUser(user);
  const lockedBranchId = getLockedBranchId(user);
  const defaultBizDate = useMemo(() => getBusinessDateStr(user?.businessDate), [user?.businessDate]);

  const [branches, setBranches] = useState<BranchItem[]>(() => getCachedMasterArray<BranchItem>('/api/Branches'));
  const [selectedBranchId, setSelectedBranchId] = useState<number>(() =>
    lockedBranchId ?? resolveWriteBranchId(user, 1)
  );
  const [transactionDate, setTransactionDate] = useState<string>(defaultBizDate);

  // Dynamic Options from /api/SavingTransactions/bulk-transfer-options
  const [savingOptions, setSavingOptions] = useState<SavingSchemeLedgerOption[]>([]);
  const [bankLedgers, setBankLedgers] = useState<DynamicLedgerOption[]>([]);
  const [generalLedgers, setGeneralLedgers] = useState<DynamicLedgerOption[]>([]);
  const [branchSavingAccounts, setBranchSavingAccounts] = useState<ContraSavingAccountSummary[]>([]);

  // Source Saving Filter & Direction
  const [selectedSourceKey, setSelectedSourceKey] = useState<string>('');
  const [direction, setDirection] = useState<DirectionMode>('CREDIT');
  const [searchText, setSearchText] = useState<string>('');

  // Grid Rows, Selection, and Amounts
  const [accounts, setAccounts] = useState<BulkSavingAccountRow[]>([]);
  const [loadingOptions, setLoadingOptions] = useState<boolean>(false);
  const [loadingAccounts, setLoadingAccounts] = useState<boolean>(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [amountsByAccountId, setAmountsByAccountId] = useState<Record<number, string>>({});
  const [narration, setNarration] = useState<string>('');

  // Contra Transfer Mode State
  const [contraUiMode, setContraUiMode] = useState<ContraTransferUiMode>('BANK');
  const [ledgerSubMode, setLedgerSubMode] = useState<LedgerSubMode>('SAVING_ACCOUNT');
  const [selectedBankLedgerId, setSelectedBankLedgerId] = useState<number | ''>('');
  const [selectedGeneralLedgerId, setSelectedGeneralLedgerId] = useState<number | ''>('');
  const [selectedContraSavingId, setSelectedContraSavingId] = useState<number | ''>('');
  const [selectedTargetOptionKey, setSelectedTargetOptionKey] = useState<string>('');

  // Submission & Feedback State
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [lastSavedVoucher, setLastSavedVoucher] = useState<{
    voucherId: number;
    voucherNo: string;
    count: number;
    totalAmount: number;
    message: string;
  } | null>(null);

  // Excel Upload Ref
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const amountInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Saved Batches Modal State
  const [showBatchesModal, setShowBatchesModal] = useState<boolean>(false);
  const [batchesLoading, setBatchesLoading] = useState<boolean>(false);
  const [batchFromDate, setBatchFromDate] = useState<string>(defaultBizDate);
  const [batchToDate, setBatchToDate] = useState<string>(defaultBizDate);
  const [batches, setBatches] = useState<BulkTransferBatchRow[]>([]);
  const [expandedVoucherIds, setExpandedVoucherIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    setTransactionDate(defaultBizDate);
    setBatchFromDate(defaultBizDate);
    setBatchToDate(defaultBizDate);
  }, [defaultBizDate]);

  useEffect(() => {
    if (lockedBranchId && lockedBranchId > 0) {
      setSelectedBranchId(lockedBranchId);
    }
  }, [lockedBranchId]);

  useEffect(() => {
    axios
      .get('/api/Branches')
      .then((res) => {
        if (Array.isArray(res.data)) setBranches(res.data);
      })
      .catch(() => {});
  }, []);

  const selectedSourceOption = useMemo(
    () => savingOptions.find((o) => o.optionKey === selectedSourceKey) || null,
    [savingOptions, selectedSourceKey]
  );

  const availableTargetOptions = useMemo(
    () => savingOptions.filter((o) => o.optionKey !== selectedSourceKey),
    [savingOptions, selectedSourceKey]
  );

  const selectedTargetOption = useMemo(
    () => availableTargetOptions.find((o) => o.optionKey === selectedTargetOptionKey) || null,
    [availableTargetOptions, selectedTargetOptionKey]
  );

  // Load Options + Branch Saving Accounts when branch changes
  useEffect(() => {
    let active = true;
    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const [optRes, savRes] = await Promise.all([
          axios.get('/api/SavingTransactions/bulk-transfer-options', {
            params: { branchId: selectedBranchId },
          }),
          axios
            .get('/api/SavingAccounts', {
              params: { branchId: selectedBranchId },
            })
            .catch(() => ({ data: [] })),
        ]);

        if (!active) return;

        const savOpts: SavingSchemeLedgerOption[] = Array.isArray(optRes.data?.savingOptions)
          ? optRes.data.savingOptions
          : [];
        const bLedgers: DynamicLedgerOption[] = Array.isArray(optRes.data?.bankLedgers)
          ? optRes.data.bankLedgers
          : [];
        const gLedgers: DynamicLedgerOption[] = Array.isArray(optRes.data?.generalLedgers)
          ? optRes.data.generalLedgers
          : [];

        setSavingOptions(savOpts);
        setBankLedgers(bLedgers);
        setGeneralLedgers(gLedgers);

        const rawSavList: ContraSavingAccountSummary[] = Array.isArray(savRes.data)
          ? savRes.data.filter(
              (a: any) =>
                a &&
                a.status !== 'Closed' &&
                a.status !== 'Frozen' &&
                (!selectedBranchId || a.branchID === selectedBranchId)
            )
          : [];
        setBranchSavingAccounts(rawSavList);

        if (savOpts.length > 0) {
          setSelectedSourceKey((prev) =>
            savOpts.some((x) => x.optionKey === prev) ? prev : savOpts[0].optionKey
          );
          if (savOpts.length > 1) {
            setSelectedTargetOptionKey((prev) =>
              savOpts.some((x) => x.optionKey === prev && x.optionKey !== savOpts[0].optionKey)
                ? prev
                : savOpts[1].optionKey
            );
          }
        } else {
          setSelectedSourceKey('');
        }

        if (bLedgers.length > 0) {
          setSelectedBankLedgerId((prev) =>
            bLedgers.some((b) => b.ledgerID === Number(prev)) ? prev : bLedgers[0].ledgerID
          );
        } else {
          setSelectedBankLedgerId('');
        }
      } catch (err: any) {
        if (active) {
          toast.error(err?.response?.data?.message || 'बल्क ट्रान्सफर पर्याय लोड करताना अडचण आली.');
        }
      } finally {
        if (active) setLoadingOptions(false);
      }
    };

    loadOptions();
    return () => {
      active = false;
    };
  }, [selectedBranchId]);

  // Keep target option distinct from source option
  useEffect(() => {
    if (availableTargetOptions.length === 0) {
      setSelectedTargetOptionKey('');
    } else if (!availableTargetOptions.some((o) => o.optionKey === selectedTargetOptionKey)) {
      setSelectedTargetOptionKey(availableTargetOptions[0].optionKey);
    }
  }, [availableTargetOptions, selectedTargetOptionKey]);

  const fetchAccounts = async (preserveInputs = false) => {
    if (!selectedSourceOption) {
      setAccounts([]);
      return;
    }
    setLoadingAccounts(true);
    try {
      const params: any = {
        branchId: selectedBranchId,
        ledgerId: selectedSourceOption.ledgerID,
      };
      if (selectedSourceOption.schemeID) {
        params.schemeId = selectedSourceOption.schemeID;
      }
      if (contraUiMode === 'SCHEME_TO_SCHEME' && selectedTargetOption) {
        params.targetLedgerId = selectedTargetOption.ledgerID;
        if (selectedTargetOption.schemeID) {
          params.targetSchemeId = selectedTargetOption.schemeID;
        }
      }

      const res = await axios.get('/api/SavingTransactions/bulk-transfer-accounts', { params });
      const rows: BulkSavingAccountRow[] = Array.isArray(res.data) ? res.data : [];
      setAccounts(rows);

      if (!preserveInputs) {
        setSelectedIds(new Set());
        setAmountsByAccountId({});
      } else {
        const validIds = new Set(rows.map((r) => r.savingAccountID));
        setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => validIds.has(id))));
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'बचत खाती लोड करताना त्रुटी आली.');
    } finally {
      setLoadingAccounts(false);
    }
  };

  // Auto-load accounts when source scheme/ledger changes
  useEffect(() => {
    if (selectedSourceOption) {
      fetchAccounts(false);
    } else {
      setAccounts([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSourceKey, selectedBranchId]);

  // Re-fetch matched target accounts preserving entered amounts when switching to SCHEME_TO_SCHEME or changing target scheme
  useEffect(() => {
    if (contraUiMode === 'SCHEME_TO_SCHEME' && selectedSourceOption && selectedTargetOption) {
      fetchAccounts(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contraUiMode, selectedTargetOptionKey]);

  const filteredAccounts = useMemo(() => {
    const q = normalizeMatchToken(searchText);
    if (!q) return accounts;
    return accounts.filter((r) => {
      const oldNo = normalizeMatchToken(r.oldAccountNo);
      const accNo = normalizeMatchToken(r.accountNo);
      const cif = normalizeMatchToken(r.cifNo);
      const name = (r.customerName || '').toLowerCase();
      return (
        oldNo.includes(q) ||
        accNo.includes(q) ||
        cif.includes(q) ||
        name.includes(searchText.trim().toLowerCase())
      );
    });
  }, [accounts, searchText]);

  const handleAmountChange = (savingAccountId: number, rawVal: string) => {
    const clean = convertMarathiDigits(rawVal);
    setAmountsByAccountId((prev) => ({ ...prev, [savingAccountId]: clean }));

    const numeric = parseFloat(clean);
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (!Number.isNaN(numeric) && numeric > 0) {
        next.add(savingAccountId);
      } else {
        next.delete(savingAccountId);
      }
      return next;
    });
  };

  const handleToggleRow = (row: BulkSavingAccountRow) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(row.savingAccountID)) {
        next.delete(row.savingAccountID);
      } else {
        next.add(row.savingAccountID);
      }
      return next;
    });
  };

  const allFilteredSelected = useMemo(() => {
    if (filteredAccounts.length === 0) return false;
    return filteredAccounts.every((r) => selectedIds.has(r.savingAccountID));
  }, [filteredAccounts, selectedIds]);

  const handleToggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filteredAccounts.forEach((r) => next.delete(r.savingAccountID));
      } else {
        filteredAccounts.forEach((r) => {
          if (contraUiMode === 'SCHEME_TO_SCHEME' && !r.matchedTargetSavingAccountID) {
            return;
          }
          next.add(r.savingAccountID);
        });
      }
      return next;
    });
  };

  const handleFillAvailableBalanceForSelected = () => {
    const targets = selectedIds.size > 0
      ? accounts.filter((a) => selectedIds.has(a.savingAccountID))
      : filteredAccounts;

    const nextAmounts = { ...amountsByAccountId };
    const nextSelected = new Set(selectedIds);
    let filled = 0;

    for (const acc of targets) {
      if (contraUiMode === 'SCHEME_TO_SCHEME' && !acc.matchedTargetSavingAccountID) continue;
      if (acc.status === 'Dormant') continue;
      const avail = Math.max(0, Number(acc.availableBalance || 0));
      if (avail > 0) {
        nextAmounts[acc.savingAccountID] = avail.toFixed(2).replace(/\.00$/, '');
        nextSelected.add(acc.savingAccountID);
        filled++;
      }
    }

    setAmountsByAccountId(nextAmounts);
    setSelectedIds(nextSelected);
    if (filled > 0) {
      toast.success(`${filled} खात्यांची काढण्यायोग्य शिल्लक रक्कम रकान्यात भरली!`);
    } else {
      toast('काढण्यायोग्य शिल्लक (> ०) असलेली खाती आढळली नाहीत.');
    }
  };

  const handleResetForm = () => {
    setSelectedIds(new Set());
    setAmountsByAccountId({});
    setNarration('');
    setLastSavedVoucher(null);
  };

  // Totals calculation
  const { activeCheckedRows, totalSelectedAmount, overdrawnCount, missingTargetCount } = useMemo(() => {
    const checked: Array<{ row: BulkSavingAccountRow; amount: number }> = [];
    let sum = 0;
    let overdrawn = 0;
    let missingTgt = 0;

    for (const row of accounts) {
      if (!selectedIds.has(row.savingAccountID)) continue;
      const amt = Math.round((parseFloat(amountsByAccountId[row.savingAccountID] || '0') || 0) * 100) / 100;
      if (amt > 0) {
        checked.push({ row, amount: amt });
        sum += amt;
        if (direction === 'DEBIT' && amt > Number(row.availableBalance || 0) + 0.001) {
          overdrawn++;
        }
        if (contraUiMode === 'SCHEME_TO_SCHEME' && !row.matchedTargetSavingAccountID) {
          missingTgt++;
        }
      }
    }
    return {
      activeCheckedRows: checked,
      totalSelectedAmount: Math.round(sum * 100) / 100,
      overdrawnCount: overdrawn,
      missingTargetCount: missingTgt,
    };
  }, [accounts, selectedIds, amountsByAccountId, direction, contraUiMode]);

  // Options for SearchableSelects
  const bankSelectOptions = useMemo(
    () =>
      bankLedgers.map((b) => ({
        value: b.ledgerID,
        label: b.ledgerName,
        subLabel: b.groupName || 'बँक खाते',
        badge: b.ledgerCode ? `#${b.ledgerCode}` : undefined,
      })),
    [bankLedgers]
  );

  const generalLedgerSelectOptions = useMemo(
    () =>
      generalLedgers.map((g) => ({
        value: g.ledgerID,
        label: g.ledgerName,
        subLabel: g.groupName || 'जनरल लेजर',
        badge: g.ledgerCode ? `#${g.ledgerCode}` : undefined,
      })),
    [generalLedgers]
  );

  const contraSavingSelectOptions = useMemo(() => {
    return branchSavingAccounts
      .filter((s) => !selectedIds.has(s.savingAccountID))
      .map((s) => {
        const oldNo = s.oldAccountNo || s.legacyAccountNumber || '';
        const cif = s.customer?.cifNo || '';
        const cName = [s.customer?.firstName, s.customer?.middleName, s.customer?.lastName]
          .filter(Boolean)
          .join(' ')
          .trim();
        const schemeTitle = s.savingScheme?.schemeName || s.ledger?.ledgerName || 'बचत खाते';
        return {
          value: s.savingAccountID,
          label: `${oldNo ? `[जुना नं: ${oldNo}] ` : ''}${cName || s.accountNo} (${cif || s.accountNo})`,
          subLabel: `${schemeTitle} • CBS: ${s.accountNo}`,
          badge: `₹${fmtMoney(s.currentBalance)}`,
          badgeColor: 'emerald',
        };
      });
  }, [branchSavingAccounts, selectedIds]);

  const selectedContraSavingObj = useMemo(
    () =>
      branchSavingAccounts.find((s) => s.savingAccountID === Number(selectedContraSavingId)) || null,
    [branchSavingAccounts, selectedContraSavingId]
  );

  // Live Accounting Preview Text
  const accountingPreview = useMemo(() => {
    const gridLabel = selectedSourceOption?.displayLabel || 'निवडलेली बचत खाती';
    let contraLabel = 'समोरचे खाते निवडा';

    if (contraUiMode === 'BANK') {
      const b = bankLedgers.find((x) => x.ledgerID === Number(selectedBankLedgerId));
      contraLabel = b ? b.ledgerName : 'बँक लेजर निवडा';
    } else if (contraUiMode === 'LEDGER_OR_CIF') {
      if (ledgerSubMode === 'SAVING_ACCOUNT') {
        if (selectedContraSavingObj) {
          const cName = [selectedContraSavingObj.customer?.firstName, selectedContraSavingObj.customer?.lastName]
            .filter(Boolean)
            .join(' ');
          contraLabel = `${selectedContraSavingObj.ledger?.ledgerName || 'बचत खाते'} (${cName || selectedContraSavingObj.accountNo})`;
        } else {
          contraLabel = 'CIF / संस्था बचत खाते निवडा';
        }
      } else {
        const g = generalLedgers.find((x) => x.ledgerID === Number(selectedGeneralLedgerId));
        contraLabel = g ? g.ledgerName : 'जनरल लेजर निवडा';
      }
    } else if (contraUiMode === 'SCHEME_TO_SCHEME') {
      contraLabel = selectedTargetOption?.displayLabel || 'टार्गेट बचत योजना निवडा';
    }

    if (direction === 'CREDIT') {
      return { dr: contraLabel, cr: `${gridLabel} (${activeCheckedRows.length} खाती)` };
    }
    return { dr: `${gridLabel} (${activeCheckedRows.length} खाती)`, cr: contraLabel };
  }, [
    selectedSourceOption,
    contraUiMode,
    ledgerSubMode,
    bankLedgers,
    selectedBankLedgerId,
    selectedContraSavingObj,
    generalLedgers,
    selectedGeneralLedgerId,
    selectedTargetOption,
    direction,
    activeCheckedRows.length,
  ]);

  // Excel Template / Grid Export
  const handleExportExcel = () => {
    if (accounts.length === 0) {
      toast.error('एक्सपोर्ट करण्यासाठी प्रथम बचत खाती लोड करा.');
      return;
    }
    const exportRows = filteredAccounts.map((r, idx) => ({
      'अ.नं.': idx + 1,
      'बचत खाते नं. (OldAccountNo)': r.oldAccountNo || '',
      'CBS खाते नं. (AccountNo)': r.accountNo,
      'CIF क्र.': r.cifNo || '',
      'खातेदाराचे नाव': r.customerName,
      'खाते चालू दिनांक': fmtDate(r.openingDate),
      'सध्याची शिल्लक': Number(r.currentBalance || 0),
      'काढण्यायोग्य शिल्लक': Number(r.availableBalance || 0),
      'रक्कम': Number(parseFloat(amountsByAccountId[r.savingAccountID] || '0') || 0),
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'SavingBulkTransfer');
    const safeScheme = (selectedSourceOption?.ledgerName || 'Saving').replace(/[\\/:*?"<>|]/g, '_');
    XLSX.writeFile(wb, `Saving_Bulk_Transfer_${safeScheme}_${transactionDate}.xlsx`);
  };

  // Excel Upload (Milk Society Bill Sheet)
  const handleExcelFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    if (accounts.length === 0) {
      toast.error('कृपया प्रथम ठेव लेजर निवडून खाती लोड करा आणि मगच Excel अपलोड करा.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const firstSheet = wb.Sheets[wb.SheetNames[0]];
        const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        if (!rows || rows.length === 0) {
          toast.error('निवडलेल्या Excel फाईलमध्ये कोणताही डेटा आढळला नाही.');
          return;
        }

        const byOldNo = new Map<string, BulkSavingAccountRow>();
        const byAccNo = new Map<string, BulkSavingAccountRow>();
        const byCif = new Map<string, BulkSavingAccountRow>();

        accounts.forEach((acc) => {
          const oldKey = normalizeMatchToken(acc.oldAccountNo);
          if (oldKey && !byOldNo.has(oldKey)) byOldNo.set(oldKey, acc);
          const cbsKey = normalizeMatchToken(acc.accountNo);
          if (cbsKey) byAccNo.set(cbsKey, acc);
          const cifKey = normalizeMatchToken(acc.cifNo);
          if (cifKey && !byCif.has(cifKey)) byCif.set(cifKey, acc);
        });

        const nextAmounts = { ...amountsByAccountId };
        const nextSelected = new Set(selectedIds);
        let matchedCount = 0;
        let unmatchedCount = 0;

        for (const r of rows) {
          const keys = Object.keys(r);
          const accCol = keys.find((k) =>
            /oldaccountno|बचत खाते|जुना|खाते नं|खाते क्र|account\s*no|acc\s*no|sabhasad/i.test(k)
          );
          const cifCol = keys.find((k) => /cif/i.test(k));
          const amtCol = keys.find((k) => /रक्कम|amount|bill|बिल|jama|जमा|net\s*pay|रककम/i.test(k));

          if (!amtCol) continue;

          const rawAmtStr = convertMarathiDigits(String(r[amtCol] ?? '')).replace(/,/g, '').trim();
          const amt = Math.round((parseFloat(rawAmtStr) || 0) * 100) / 100;
          if (amt <= 0) continue;

          let matchedAcc: BulkSavingAccountRow | undefined;
          if (accCol) {
            const tok = normalizeMatchToken(r[accCol]);
            if (tok) {
              matchedAcc = byOldNo.get(tok) || byAccNo.get(tok);
            }
          }
          if (!matchedAcc && cifCol) {
            const cTok = normalizeMatchToken(r[cifCol]);
            if (cTok) {
              matchedAcc = byCif.get(cTok);
            }
          }

          if (matchedAcc) {
            nextAmounts[matchedAcc.savingAccountID] = String(amt);
            nextSelected.add(matchedAcc.savingAccountID);
            matchedCount++;
          } else {
            unmatchedCount++;
          }
        }

        setAmountsByAccountId(nextAmounts);
        setSelectedIds(nextSelected);

        if (matchedCount > 0) {
          toast.success(
            `Excel मधील ${matchedCount} खात्यांची रक्कम यशस्वीरित्या भरली गेली!${
              unmatchedCount > 0 ? ` (${unmatchedCount} खाती जुळली नाहीत)` : ''
            }`
          );
        } else {
          toast.error(
            'Excel फाईलमधील खाते क्रमांक जुळले नाहीत. कृपया "बचत खाते नं." आणि "रक्कम" कॉलम तपासा.'
          );
        }
      } catch {
        toast.error('Excel फाईल वाचताना त्रुटी आली. कृपया वैध .xlsx किंवा .csv फाईल वापरा.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Submit Bulk Transfer
  const handleSaveBulkTransfer = async () => {
    if (!selectedSourceOption) {
      toast.error('कृपया प्रथम ठेव लेजर / योजना निवडा.');
      return;
    }
    if (activeCheckedRows.length === 0 || totalSelectedAmount <= 0) {
      toast.error('कृपया किमान एका खात्यावर टिक (✓) करून वैध रक्कम (> ०) टाका.');
      return;
    }
    if (direction === 'DEBIT' && overdrawnCount > 0) {
      toast.error(
        `निवडलेल्या ${overdrawnCount} खात्यांमध्ये काढण्यायोग्य शिल्लकपेक्षा जास्त रक्कम टाकली आहे. कृपया लाल रंगातील खाती तपासा.`
      );
      return;
    }
    if (contraUiMode === 'SCHEME_TO_SCHEME' && missingTargetCount > 0) {
      toast.error(
        `निवडलेल्या ${missingTargetCount} खातेदारांचे समोरच्या टार्गेट योजनेत बचत खाते उपलब्ध नाही. कृपया त्यांची टिक काढा किंवा प्रथम खाते उघडा.`
      );
      return;
    }

    let backendContraMode: 'BANK' | 'SAVING_ACCOUNT' | 'GL_LEDGER' | 'SCHEME_TO_SCHEME' = 'BANK';
    let contraLedgerId: number | null = null;
    let contraSavingAccountId: number | null = null;
    let contraTargetSchemeId: number | null = null;

    if (contraUiMode === 'BANK') {
      if (!selectedBankLedgerId) {
        toast.error('कृपया बँक ट्रान्सफरसाठी बँक खाते लेजर निवडा (उदा. के.डी.सी.सी चालु खाते).');
        return;
      }
      backendContraMode = 'BANK';
      contraLedgerId = Number(selectedBankLedgerId);
    } else if (contraUiMode === 'LEDGER_OR_CIF') {
      if (ledgerSubMode === 'SAVING_ACCOUNT') {
        if (!selectedContraSavingId) {
          toast.error('कृपया समोरचे CIF / संस्था बचत खाते निवडा.');
          return;
        }
        backendContraMode = 'SAVING_ACCOUNT';
        contraSavingAccountId = Number(selectedContraSavingId);
      } else {
        if (!selectedGeneralLedgerId) {
          toast.error('कृपया लेजर ट्रान्सफरसाठी जनरल लेजर निवडा.');
          return;
        }
        backendContraMode = 'GL_LEDGER';
        contraLedgerId = Number(selectedGeneralLedgerId);
      }
    } else if (contraUiMode === 'SCHEME_TO_SCHEME') {
      if (!selectedTargetOption) {
        toast.error('कृपया समोरची टार्गेट बचत योजना / ठेव लेजर निवडा.');
        return;
      }
      backendContraMode = 'SCHEME_TO_SCHEME';
      contraLedgerId = selectedTargetOption.ledgerID;
      contraTargetSchemeId = selectedTargetOption.schemeID ?? null;
    }

    const confirmMsg =
      `तुम्हाला निवडलेल्या ${activeCheckedRows.length} बचत खात्यांचा एकूण ₹${fmtMoney(totalSelectedAmount)} चा बल्क ट्रान्सफर जतन करायचा आहे का?\n\n` +
      `• नावे (Dr): ${accountingPreview.dr}\n` +
      `• जमा (Cr): ${accountingPreview.cr}\n` +
      `(हा व्यवहार मंजुरीसाठी Pending जर्नल व्हाउचर म्हणून जतन होईल.)`;

    if (!window.confirm(confirmMsg)) return;

    setSubmitting(true);
    try {
      const payload = {
        branchId: selectedBranchId,
        transactionDate,
        savingLedgerId: selectedSourceOption.ledgerID,
        savingSchemeId: selectedSourceOption.schemeID ?? null,
        direction,
        contraMode: backendContraMode,
        contraLedgerId,
        contraSavingAccountId,
        contraTargetSchemeId,
        narration: narration.trim() || null,
        items: activeCheckedRows.map(({ row, amount }) => ({
          savingAccountId: row.savingAccountID,
          amount,
          targetSavingAccountId:
            backendContraMode === 'SCHEME_TO_SCHEME' ? row.matchedTargetSavingAccountID ?? null : null,
        })),
      };

      const res = await axios.post('/api/SavingTransactions/bulk-transfer', payload);
      invalidateApiCache('/api/savingaccounts');
      invalidateApiCache('/api/dashboard');

      setLastSavedVoucher({
        voucherId: res.data?.voucherId,
        voucherNo: res.data?.voucherNo,
        count: res.data?.processedCount || activeCheckedRows.length,
        totalAmount: res.data?.totalAmount || totalSelectedAmount,
        message: res.data?.message || 'बल्क ट्रान्सफर व्हाउचर यशस्वीरित्या जतन झाला!',
      });

      toast.success(res.data?.message || 'बल्क ट्रान्सफर व्हाउचर मंजुरीसाठी जतन झाला!');
      setSelectedIds(new Set());
      setAmountsByAccountId({});
      setNarration('');
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'बल्क ट्रान्सफर जतन करताना त्रुटी आली.');
    } finally {
      setSubmitting(false);
    }
  };

  // Load Saved Bulk Transfer Batches
  const loadBatches = async () => {
    setBatchesLoading(true);
    try {
      const res = await axios.get('/api/SavingTransactions/bulk-transfer-batches', {
        params: {
          branchId: selectedBranchId,
          fromDate: batchFromDate || undefined,
          toDate: batchToDate || undefined,
        },
      });
      setBatches(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'बल्क ट्रान्सफर यादी लोड करताना अडचण आली.');
    } finally {
      setBatchesLoading(false);
    }
  };

  const handleOpenBatchesModal = () => {
    setShowBatchesModal(true);
    loadBatches();
  };

  const toggleExpandVoucher = (voucherId: number) => {
    setExpandedVoucherIds((prev) => {
      const next = new Set(prev);
      if (next.has(voucherId)) next.delete(voucherId);
      else next.add(voucherId);
      return next;
    });
  };

  return (
    <div className="h-[calc(100vh-3.15rem)] flex flex-col gap-1.5 p-1.5 bg-slate-50 overflow-hidden font-sans">
      {/* Hidden Excel File Input */}
      <input
        ref={excelInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        onChange={handleExcelFileUpload}
        className="hidden"
      />

      {/* TOP COMPACT BAR: Header + सेव्हिंग खाते Filter Strip */}
      <div className="shrink-0 bg-white border border-slate-200 rounded-lg shadow-2xs px-2.5 py-1.5 space-y-1.5">
        {/* Strip 1: Title + Live Accounting Badge + Branch + Date + History + Back */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-6 h-6 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <Wallet size={14} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xs sm:text-sm font-black text-primary leading-tight truncate">
                बचत बल्क ट्रान्सफर{' '}
                <span className="text-[10.5px] font-semibold text-slate-500">
                  (दूध संस्था KDCC बँक बिल जमा व सेव्हिंग वर्ग)
                </span>
              </h1>
            </div>
            <div className="hidden xl:flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-primary/5 border border-primary/20 text-[10.5px] font-bold text-slate-700 truncate max-w-[440px]">
              <span className="text-rose-700 truncate">Dr नावे: {accountingPreview.dr}</span>
              <span className="text-primary font-black">➔</span>
              <span className="text-emerald-700 truncate">Cr जमा: {accountingPreview.cr}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Branch Selector */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md px-1.5 h-6">
              <Building2 size={12} className="text-primary shrink-0" />
              <span className="text-[10.5px] font-bold text-slate-600">शाखा:</span>
              <select
                value={selectedBranchId}
                disabled={!isHo}
                onChange={(e) => setSelectedBranchId(Number(e.target.value))}
                className="bg-transparent text-[11px] font-bold text-slate-800 focus:outline-none disabled:opacity-80"
              >
                {branches.map((b) => (
                  <option key={b.branchID} value={b.branchID}>
                    {b.branchName}
                  </option>
                ))}
              </select>
            </div>

            {/* Transaction Date */}
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-md px-1.5 h-6">
              <span className="text-[10.5px] font-bold text-slate-600">दिनांक:</span>
              <input
                type="date"
                value={transactionDate}
                onChange={(e) => setTransactionDate(e.target.value)}
                className="bg-transparent text-[11px] font-bold text-slate-800 focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleOpenBatchesModal}
              className="h-6 px-2 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <FileText size={12} />
              <span>यादी पहा</span>
            </button>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('saving')}
                className="h-6 px-2 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft size={12} />
                <span>मागे</span>
              </button>
            )}
          </div>
        </div>

        {/* Strip 2: सेव्हिंग खाते Filter Controls (ठेव लेजर + जमा/नावे + Excel + पहा + शोधा) */}
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* ठेव लेजर / योजना */}
            <div className="flex items-center gap-1">
              <label className="text-[11px] font-extrabold text-slate-700 whitespace-nowrap">
                ठेव लेजर:
              </label>
              <select
                value={selectedSourceKey}
                onChange={(e) => setSelectedSourceKey(e.target.value)}
                disabled={loadingOptions}
                className="h-7 min-w-[195px] max-w-[270px] rounded-md border border-slate-300 bg-white px-2 text-[11.5px] font-bold text-slate-800 focus:border-primary focus:outline-none"
              >
                {savingOptions.length === 0 && <option value="">-- ठेव लेजर उपलब्ध नाही --</option>}
                {savingOptions.map((opt) => (
                  <option key={opt.optionKey} value={opt.optionKey}>
                    {opt.displayLabel} ({opt.accountCount})
                  </option>
                ))}
              </select>
            </div>

            {/* जमा / नावे Radio */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200 h-7">
              <label
                onClick={() => setDirection('CREDIT')}
                className={`flex items-center gap-1 px-2 h-6 rounded text-[11px] font-extrabold cursor-pointer transition-colors ${
                  direction === 'CREDIT'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-white/60'
                }`}
              >
                <input
                  type="radio"
                  name="sbBulkDirection"
                  checked={direction === 'CREDIT'}
                  onChange={() => setDirection('CREDIT')}
                  className="sr-only"
                />
                <span>● जमा (Cr)</span>
              </label>
              <label
                onClick={() => setDirection('DEBIT')}
                className={`flex items-center gap-1 px-2 h-6 rounded text-[11px] font-extrabold cursor-pointer transition-colors ${
                  direction === 'DEBIT'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-white/60'
                }`}
              >
                <input
                  type="radio"
                  name="sbBulkDirection"
                  checked={direction === 'DEBIT'}
                  onChange={() => setDirection('DEBIT')}
                  className="sr-only"
                />
                <span>○ नावे (Dr)</span>
              </label>
            </div>

            {/* पहा Button */}
            <button
              type="button"
              onClick={() => fetchAccounts(true)}
              disabled={loadingAccounts || !selectedSourceOption}
              className="h-7 px-2.5 rounded-md bg-primary hover:bg-primary/90 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw size={12} className={loadingAccounts ? 'animate-spin' : ''} />
              <span>पहा</span>
            </button>

            {/* Excel Upload & Export Buttons */}
            <button
              type="button"
              onClick={() => excelInputRef.current?.click()}
              title="दूध संस्थेची बिल यादी (.xlsx / .csv) अपलोड करा"
              className="h-7 px-2 rounded-md border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Upload size={12} />
              <span>Excel अपलोड</span>
            </button>

            <button
              type="button"
              onClick={handleExportExcel}
              title="Excel टेम्पलेट / यादी डाऊनलोड करा"
              className="h-7 px-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Download size={12} />
              <span>Excel नमुना</span>
            </button>

            {direction === 'DEBIT' && (
              <button
                type="button"
                onClick={handleFillAvailableBalanceForSelected}
                title="खात्यातील काढण्यायोग्य संपूर्ण शिल्लक रक्कम रकान्यात भरा"
                className="h-7 px-2 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary text-[11px] font-bold cursor-pointer"
              >
                उपलब्ध शिल्लक भरा
              </button>
            )}
          </div>

          {/* Search Box (शोधा खाते नं.) */}
          <div className="relative flex items-center">
            <Search size={13} className="absolute left-2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="शोधा: बचत खाते नं. / नाव / CIF..."
              className="h-7 w-52 sm:w-60 pl-7 pr-6 rounded-md border border-slate-300 bg-slate-50 focus:bg-white text-[11px] font-semibold text-slate-800 focus:border-primary focus:outline-none"
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText('')}
                className="absolute right-1.5 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>

        {/* Saved Voucher Quick Banner */}
        {lastSavedVoucher && (
          <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-300 rounded-md px-2.5 py-1 text-[11px] text-emerald-900">
            <div className="flex items-center gap-1.5 font-bold truncate">
              <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
              <span className="truncate">{lastSavedVoucher.message}</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {onNavigate && (
                <button
                  type="button"
                  onClick={() => onNavigate('voucher-posting')}
                  className="px-2 py-0.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>व्हाउचर पासिंग उघडा</span>
                  <ExternalLink size={11} />
                </button>
              )}
              <button
                type="button"
                onClick={() => setLastSavedVoucher(null)}
                className="text-emerald-700 hover:text-emerald-900 cursor-pointer"
              >
                <X size={13} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CENTER FULL-HEIGHT SCROLLABLE SINGLE-LINE GRID */}
      <div className="flex-1 min-h-0 bg-white border border-slate-200 rounded-lg shadow-2xs flex flex-col overflow-hidden">
        <div className="flex-1 min-h-0 overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="bg-primary text-white sticky top-0 z-10 text-[11px] font-bold select-none">
              <tr className="h-7">
                <th className="w-8 px-2 text-center border-r border-white/15">
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={handleToggleSelectAllFiltered}
                    title="सर्व खाती निवडा / काढा"
                    className="w-3.5 h-3.5 rounded accent-white cursor-pointer"
                  />
                </th>
                <th className="w-12 px-2 text-center border-r border-white/15 whitespace-nowrap">अ.नं.</th>
                <th className="w-24 px-2 border-r border-white/15 whitespace-nowrap">बचत खाते नं.</th>
                <th className="w-32 px-2 border-r border-white/15 whitespace-nowrap">CBS खाते नं.</th>
                <th className="w-24 px-2 border-r border-white/15 whitespace-nowrap">CIF क्र.</th>
                <th className="px-2.5 border-r border-white/15 whitespace-nowrap">खातेदाराचे नाव</th>
                <th className="w-24 px-2 text-center border-r border-white/15 whitespace-nowrap">खाते चालू दिनांक</th>
                <th className="w-28 px-2 text-right border-r border-white/15 whitespace-nowrap">शिल्लक (₹)</th>
                {direction === 'DEBIT' && (
                  <th className="w-28 px-2 text-right border-r border-white/15 whitespace-nowrap">
                    काढण्यायोग्य (₹)
                  </th>
                )}
                {contraUiMode === 'SCHEME_TO_SCHEME' && (
                  <th className="w-36 px-2 border-r border-white/15 whitespace-nowrap">समोरचे बचत खाते</th>
                )}
                <th className="w-32 px-2 text-right whitespace-nowrap">रक्कम (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-[11.5px]">
              {loadingAccounts ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-500 font-semibold">
                    <RefreshCw size={18} className="inline animate-spin mr-2 text-primary" />
                    बचत खाती लोड होत आहेत...
                  </td>
                </tr>
              ) : filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400 font-semibold">
                    निवडलेल्या ठेव लेजरमध्ये कोणतीही सक्रिय बचत खाती आढळली नाहीत.
                  </td>
                </tr>
              ) : (
                filteredAccounts.map((row, idx) => {
                  const isChecked = selectedIds.has(row.savingAccountID);
                  const rawAmt = amountsByAccountId[row.savingAccountID] ?? '';
                  const numAmt = parseFloat(rawAmt) || 0;
                  const isOverdrawn =
                    direction === 'DEBIT' &&
                    isChecked &&
                    numAmt > Number(row.availableBalance || 0) + 0.001;
                  const isMissingTarget =
                    contraUiMode === 'SCHEME_TO_SCHEME' &&
                    isChecked &&
                    !row.matchedTargetSavingAccountID;

                  return (
                    <tr
                      key={row.savingAccountID}
                      className={`h-7 transition-colors whitespace-nowrap ${
                        isOverdrawn || isMissingTarget
                          ? 'bg-rose-50/90 hover:bg-rose-100/70'
                          : isChecked
                          ? 'bg-primary/5 hover:bg-primary/10'
                          : idx % 2 === 0
                          ? 'bg-white hover:bg-slate-50'
                          : 'bg-slate-50/50 hover:bg-slate-100/60'
                      }`}
                    >
                      <td className="px-2 py-0.5 text-center border-r border-slate-100">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleToggleRow(row)}
                          className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
                        />
                      </td>
                      <td className="px-2 py-0.5 text-center text-slate-500 font-semibold border-r border-slate-100">
                        {idx + 1}
                      </td>
                      <td className="px-2 py-0.5 font-extrabold text-slate-900 border-r border-slate-100">
                        {row.oldAccountNo || '-'}
                      </td>
                      <td className="px-2 py-0.5 font-mono text-[10.5px] text-slate-600 border-r border-slate-100">
                        {row.accountNo}
                      </td>
                      <td className="px-2 py-0.5 font-mono text-[10.5px] text-slate-600 border-r border-slate-100">
                        {row.cifNo || '-'}
                      </td>
                      <td
                        className="px-2.5 py-0.5 font-bold text-slate-800 border-r border-slate-100 max-w-[250px] truncate"
                        title={row.customerName}
                      >
                        {row.customerName}
                        {row.status === 'Dormant' && (
                          <span className="ml-1.5 px-1 py-0 text-[9.5px] rounded bg-amber-100 text-amber-800 font-bold">
                            Dormant
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-0.5 text-center text-slate-600 border-r border-slate-100">
                        {fmtDate(row.openingDate)}
                      </td>
                      <td className="px-2 py-0.5 text-right font-bold text-slate-800 border-r border-slate-100">
                        {fmtMoney(row.currentBalance)}
                      </td>
                      {direction === 'DEBIT' && (
                        <td
                          className={`px-2 py-0.5 text-right font-bold border-r border-slate-100 ${
                            isOverdrawn ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                          title={`किमान शिल्लक: ₹${fmtMoney(row.minimumBalance)}`}
                        >
                          {fmtMoney(row.availableBalance)}
                        </td>
                      )}
                      {contraUiMode === 'SCHEME_TO_SCHEME' && (
                        <td className="px-2 py-0.5 border-r border-slate-100">
                          {row.matchedTargetSavingAccountID ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-bold">
                              ✓ #{row.matchedTargetOldAccountNo || row.matchedTargetAccountNo}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0 rounded bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold">
                              ⚠️ खाते नाही
                            </span>
                          )}
                        </td>
                      )}
                      <td className="px-1.5 py-0.5 text-right">
                        <input
                          ref={(el) => {
                            amountInputRefs.current[idx] = el;
                          }}
                          type="text"
                          inputMode="decimal"
                          value={rawAmt}
                          placeholder="0"
                          onChange={(e) => handleAmountChange(row.savingAccountID, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === 'ArrowDown') {
                              e.preventDefault();
                              amountInputRefs.current[idx + 1]?.focus();
                              amountInputRefs.current[idx + 1]?.select();
                            } else if (e.key === 'ArrowUp' && idx > 0) {
                              e.preventDefault();
                              amountInputRefs.current[idx - 1]?.focus();
                              amountInputRefs.current[idx - 1]?.select();
                            }
                          }}
                          className={`h-6 w-28 px-1.5 text-right rounded border text-[11.5px] font-extrabold focus:outline-none ${
                            isOverdrawn
                              ? 'border-rose-500 bg-rose-50 text-rose-800'
                              : numAmt > 0
                              ? 'border-primary bg-white text-primary'
                              : 'border-slate-200 bg-slate-50/70 text-slate-700 focus:bg-white focus:border-primary'
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

      {/* BOTTOM COMPACT SUMMARY + CONTRA TRANSFER MODES + ACTION BUTTONS */}
      <div className="shrink-0 bg-white border border-slate-200 rounded-lg shadow-2xs px-2.5 py-1.5 space-y-1.5">
        {/* Footer Row 1: एकूण खातेदार | निवडलेले खातेदार | तपशिल | एकूण रक्कम */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-md px-2 h-7">
            <span className="text-[11px] font-bold text-slate-600">एकूण खातेदार:</span>
            <span className="text-xs font-black text-slate-900">{accounts.length}</span>
          </div>

          <div className="flex items-center gap-1.5 bg-primary/5 border border-primary/20 rounded-md px-2 h-7">
            <span className="text-[11px] font-bold text-slate-700">निवडलेले खातेदार:</span>
            <span className="text-xs font-black text-primary">{activeCheckedRows.length}</span>
          </div>

          <div className="flex-1 min-w-[200px] flex items-center gap-1.5">
            <label className="text-[11px] font-extrabold text-slate-700 whitespace-nowrap">
              तपशिल:
            </label>
            <input
              type="text"
              value={narration}
              onChange={(e) => setNarration(e.target.value)}
              placeholder="उदा. के.डी.सी.सी बँक दूध संस्था बिल जमा / महालक्ष्मी संस्था ते रेग्युलर सेव्हिंग वर्ग..."
              className="h-7 flex-1 rounded-md border border-slate-300 px-2 text-[11.5px] font-semibold text-slate-800 focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-1.5 bg-primary/10 border border-primary/30 rounded-md px-2.5 h-7 ml-auto">
            <span className="text-[11px] font-extrabold text-slate-700">एकूण रक्कम:</span>
            <span className="text-sm font-black text-primary">₹ {fmtMoney(totalSelectedAmount)}</span>
          </div>
        </div>

        {/* Footer Row 2: 3 Contra Transfer Modes + Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-slate-100">
          {/* Contra Mode Radio Group + Dynamic Selector */}
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
            {/* Radio Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => setContraUiMode('BANK')}
                className={`h-6 px-2 rounded text-[11px] font-extrabold cursor-pointer transition-colors ${
                  contraUiMode === 'BANK'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                ◉ बँक ट्रान्सफर
              </button>
              <button
                type="button"
                onClick={() => setContraUiMode('LEDGER_OR_CIF')}
                className={`h-6 px-2 rounded text-[11px] font-extrabold cursor-pointer transition-colors ${
                  contraUiMode === 'LEDGER_OR_CIF'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                ○ लेजर / CIF ट्रान्सफर
              </button>
              <button
                type="button"
                onClick={() => setContraUiMode('SCHEME_TO_SCHEME')}
                className={`h-6 px-2 rounded text-[11px] font-extrabold cursor-pointer transition-colors ${
                  contraUiMode === 'SCHEME_TO_SCHEME'
                    ? 'bg-primary text-white shadow-2xs'
                    : 'text-slate-700 hover:bg-white/70'
                }`}
              >
                ○ योजना ते योजना वर्ग
              </button>
            </div>

            {/* Contra Dynamic Target Input */}
            {contraUiMode === 'BANK' && (
              <div className="w-64 sm:w-72">
                <SearchableSelect
                  options={bankSelectOptions}
                  value={selectedBankLedgerId}
                  onChange={(e) => setSelectedBankLedgerId(Number(e.target.value) || '')}
                  placeholder="-- बँक खाते निवडा (उदा. के.डी.सी.सी) --"
                  searchPlaceholder="बँक लेजर शोधा..."
                  className="text-xs"
                />
              </div>
            )}

            {contraUiMode === 'LEDGER_OR_CIF' && (
              <div className="flex flex-wrap items-center gap-1.5 min-w-0">
                <div className="flex items-center bg-slate-100 rounded border border-slate-200 p-0.5 h-7">
                  <button
                    type="button"
                    onClick={() => setLedgerSubMode('SAVING_ACCOUNT')}
                    className={`px-2 h-6 rounded text-[10.5px] font-bold cursor-pointer ${
                      ledgerSubMode === 'SAVING_ACCOUNT'
                        ? 'bg-white text-primary shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    CIF / संस्था बचत खाते
                  </button>
                  <button
                    type="button"
                    onClick={() => setLedgerSubMode('GL_LEDGER')}
                    className={`px-2 h-6 rounded text-[10.5px] font-bold cursor-pointer ${
                      ledgerSubMode === 'GL_LEDGER'
                        ? 'bg-white text-primary shadow-2xs'
                        : 'text-slate-600'
                    }`}
                  >
                    जनरल लेजर
                  </button>
                </div>

                {ledgerSubMode === 'SAVING_ACCOUNT' ? (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-bold text-slate-600">CIF:</span>
                    <input
                      type="text"
                      readOnly
                      value={selectedContraSavingObj?.customer?.cifNo || ''}
                      placeholder="CIF"
                      className="h-7 w-24 px-1.5 rounded border border-slate-200 bg-slate-50 text-[11px] font-mono font-bold text-slate-700"
                    />
                    <div className="w-64 sm:w-80">
                      <SearchableSelect
                        options={contraSavingSelectOptions}
                        value={selectedContraSavingId}
                        onChange={(e) => setSelectedContraSavingId(Number(e.target.value) || '')}
                        placeholder="-- दूध संस्था / समोरचे बचत खाते निवडा --"
                        searchPlaceholder="CIF, जुना क्र. किंवा नाव शोधा..."
                        className="bg-amber-50/70 border-amber-300 text-xs"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="w-64 sm:w-72">
                    <SearchableSelect
                      options={generalLedgerSelectOptions}
                      value={selectedGeneralLedgerId}
                      onChange={(e) => setSelectedGeneralLedgerId(Number(e.target.value) || '')}
                      placeholder="-- जनरल लेजर निवडा --"
                      searchPlaceholder="लेजर नाव शोधा..."
                      className="text-xs"
                    />
                  </div>
                )}
              </div>
            )}

            {contraUiMode === 'SCHEME_TO_SCHEME' && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-700 whitespace-nowrap">
                  समोरचे ठेव लेजर:
                </span>
                <select
                  value={selectedTargetOptionKey}
                  onChange={(e) => setSelectedTargetOptionKey(e.target.value)}
                  className="h-7 min-w-[210px] rounded-md border border-primary/40 bg-primary/5 px-2 text-[11.5px] font-bold text-slate-900 focus:border-primary focus:outline-none"
                >
                  {availableTargetOptions.length === 0 && (
                    <option value="">-- दुसरे बचत लेजर उपलब्ध नाही --</option>
                  )}
                  {availableTargetOptions.map((opt) => (
                    <option key={opt.optionKey} value={opt.optionKey}>
                      {opt.displayLabel} ({opt.accountCount})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Right Action Buttons: नविन | जतन करा | बाहेर */}
          <div className="flex items-center gap-1.5 shrink-0">
            {(overdrawnCount > 0 || missingTargetCount > 0) && (
              <span className="inline-flex items-center gap-1 text-[10.5px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded">
                <AlertCircle size={12} />
                {overdrawnCount > 0
                  ? `${overdrawnCount} खात्यात अपुरी शिल्लक`
                  : `${missingTargetCount} खात्यांना समोरचे खाते नाही`}
              </span>
            )}

            <button
              type="button"
              onClick={handleResetForm}
              className="h-7 px-3 rounded-md border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-extrabold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw size={12} />
              <span>नविन</span>
            </button>

            <button
              type="button"
              onClick={handleSaveBulkTransfer}
              disabled={submitting || activeCheckedRows.length === 0 || totalSelectedAmount <= 0}
              className="h-7 px-4 rounded-md bg-primary hover:bg-primary/90 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              <Save size={13} />
              <span>{submitting ? 'जतन होत आहे...' : 'जतन करा'}</span>
            </button>

            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('saving')}
                className="h-7 px-3 rounded-md border border-slate-300 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-extrabold cursor-pointer"
              >
                बाहेर
              </button>
            )}
          </div>
        </div>
      </div>

      {/* SAVED BULK TRANSFER BATCHES MODAL (यादी पहा) */}
      {showBatchesModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-2xs flex items-center justify-center p-3">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl max-h-[88vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="bg-primary text-white px-4 py-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={16} />
                <h2 className="text-sm font-black">
                  बचत बल्क ट्रान्सफर बॅच रजिस्टर (JV-SBK व्हाउचर यादी)
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchesModal(false)}
                className="text-white/80 hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Filter Strip */}
            <div className="px-4 py-2 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-600">पासून:</span>
                <input
                  type="date"
                  value={batchFromDate}
                  onChange={(e) => setBatchFromDate(e.target.value)}
                  className="h-7 px-2 rounded border border-slate-300 bg-white text-xs font-bold"
                />
                <span className="text-xs font-bold text-slate-600">पर्यंत:</span>
                <input
                  type="date"
                  value={batchToDate}
                  onChange={(e) => setBatchToDate(e.target.value)}
                  className="h-7 px-2 rounded border border-slate-300 bg-white text-xs font-bold"
                />
                <button
                  type="button"
                  onClick={loadBatches}
                  disabled={batchesLoading}
                  className="h-7 px-3 rounded bg-primary text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw size={12} className={batchesLoading ? 'animate-spin' : ''} />
                  <span>शोधा</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="h-7 px-2.5 rounded border border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Printer size={12} />
                  <span>प्रिंट</span>
                </button>
                {onNavigate && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowBatchesModal(false);
                      onNavigate('voucher-posting');
                    }}
                    className="h-7 px-2.5 rounded bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <span>व्हाउचर पासिंग</span>
                    <ExternalLink size={12} />
                  </button>
                )}
              </div>
            </div>

            {/* Modal Table */}
            <div className="flex-1 min-h-0 overflow-auto p-3">
              {batchesLoading ? (
                <div className="py-10 text-center text-xs font-bold text-slate-500">
                  यादी लोड होत आहे...
                </div>
              ) : batches.length === 0 ? (
                <div className="py-10 text-center text-xs font-bold text-slate-400">
                  निवडलेल्या कालावधीत कोणताही बचत बल्क ट्रान्सफर बॅच सापडला नाही.
                </div>
              ) : (
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 h-8">
                      <th className="w-8 px-2"></th>
                      <th className="px-2 text-left">व्हाउचर क्र.</th>
                      <th className="px-2 text-center">दिनांक</th>
                      <th className="px-2 text-left">तपशिल</th>
                      <th className="px-2 text-center">खाती</th>
                      <th className="px-2 text-right">एकूण रक्कम (₹)</th>
                      <th className="px-2 text-center">स्थिती</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {batches.map((b) => {
                      const expanded = expandedVoucherIds.has(b.voucherId);
                      return (
                        <React.Fragment key={b.voucherId}>
                          <tr
                            onClick={() => toggleExpandVoucher(b.voucherId)}
                            className="h-8 hover:bg-slate-50 cursor-pointer"
                          >
                            <td className="px-2 text-center text-slate-500">
                              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                            </td>
                            <td className="px-2 font-mono font-bold text-primary">{b.voucherNo}</td>
                            <td className="px-2 text-center">{fmtDate(b.voucherDate)}</td>
                            <td className="px-2 max-w-md truncate font-medium text-slate-700">
                              {b.narration || '-'}
                            </td>
                            <td className="px-2 text-center font-bold">{b.savingLineCount}</td>
                            <td className="px-2 text-right font-extrabold text-slate-900">
                              ₹ {fmtMoney(b.totalAmount)}
                            </td>
                            <td className="px-2 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10.5px] font-bold ${
                                  b.status === 'Approved'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {b.status === 'Approved' ? 'पास (Approved)' : 'प्रलंबित (Pending)'}
                              </span>
                            </td>
                          </tr>
                          {expanded && (
                            <tr>
                              <td colSpan={7} className="bg-slate-50 px-6 py-2 border-b border-slate-200">
                                <table className="w-full text-[11px] bg-white border border-slate-200 rounded">
                                  <thead>
                                    <tr className="bg-slate-100 text-slate-600 h-6">
                                      <th className="px-2 text-left">जुना नं.</th>
                                      <th className="px-2 text-left">CBS खाते नं.</th>
                                      <th className="px-2 text-left">CIF</th>
                                      <th className="px-2 text-left">खातेदाराचे नाव</th>
                                      <th className="px-2 text-left">ठेव लेजर</th>
                                      <th className="px-2 text-center">जमा/नावे</th>
                                      <th className="px-2 text-right">रक्कम (₹)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {b.items.map((it, idx) => (
                                      <tr key={`${it.savingAccountId}_${idx}`} className="h-6">
                                        <td className="px-2 font-bold">{it.oldAccountNo || '-'}</td>
                                        <td className="px-2 font-mono">{it.accountNo}</td>
                                        <td className="px-2 font-mono">{it.cifNo}</td>
                                        <td className="px-2 font-semibold">{it.customerName}</td>
                                        <td className="px-2">{it.ledgerName}</td>
                                        <td className="px-2 text-center font-bold">
                                          <span
                                            className={
                                              it.drCr === 'Cr' ? 'text-emerald-700' : 'text-rose-700'
                                            }
                                          >
                                            {it.drCr === 'Cr' ? 'जमा (Cr)' : 'नावे (Dr)'}
                                          </span>
                                        </td>
                                        <td className="px-2 text-right font-bold">
                                          {fmtMoney(it.amount)}
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
};

export default SavingBulkTransferMaster;
